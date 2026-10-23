"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { inputClass } from "@/components/ui/Field";
import { apiPatch, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { parseIndianPhone, formatPhone } from "@/shared/phone";

/**
 * Phone-OTP sign-in and sign-up.
 *
 * "Login" and "Sign up" are the same OTP flow — verifying an unknown number
 * creates the account — but the boards show both tabs, and offering "Sign up"
 * lets a first-time user give their name up front instead of being asked after
 * the code.
 *
 * All steps live in one component because each needs the previous step's phone
 * number, and on a patchy connection a navigation between steps is where users
 * drop out.
 */

type Mode = "login" | "signup";
type Step = "phone" | "code" | "name";

/** Only same-origin paths are honoured, so ?next= cannot bounce users off-site. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function LoginForm({
  devPrefix,
  next,
  initialMode = "login",
}: {
  devPrefix: string | null;
  next: string | null;
  initialMode?: Mode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);
  const destination = safeNext(next);

  // Resend cooldown mirrors the server's 60-second per-phone limit, so the
  // button is never offered when the request would be rejected.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function finish() {
    router.push(destination);
    router.refresh();
  }

  async function requestOtp(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);

    const parsed = parseIndianPhone(phone);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    if (mode === "signup" && name.trim().length < 2) {
      setError("Enter your name");
      return;
    }

    setBusy(true);
    const result = await apiPost<{ devCode?: string }>("/auth/send-otp", {
      phone: parsed.e164,
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setDevCode(result.data.devCode ?? null);
    setStep("code");
    setResendIn(60);
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);

    const parsed = parseIndianPhone(phone);
    const trimmedName = name.trim();

    const result = await apiPost<{ user: { isNewUser: boolean; name: string | null } }>(
      "/auth/verify-otp",
      {
        phone: parsed.ok ? parsed.e164 : phone,
        code,
        ...(trimmedName.length >= 2 ? { name: trimmedName } : {}),
      },
    );

    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    // Signed in. A brand-new account that came through "Login" has no name yet;
    // ask once. The session already exists, so this is a profile update — the
    // one-time code is spent and must not be sent again.
    if (result.data.user.isNewUser && !result.data.user.name) {
      setStep("name");
      return;
    }

    finish();
  }

  async function submitName(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const result = await apiPatch("/auth/me", { name: name.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    finish();
  }

  if (step === "name") {
    return (
      <form onSubmit={submitName} noValidate>
        <h2 className="text-xl font-bold text-ink-900">Welcome to Gharr</h2>
        <p className="mt-1 text-sm text-ink-500">What should we call you?</p>
        <IconInput icon={<User aria-hidden className="size-5" />} className="mt-5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
            aria-label="Your name"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none"
          />
        </IconInput>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <Button type="submit" fullWidth size="lg" loading={busy} className="mt-5" disabled={name.trim().length < 2}>
          Continue
        </Button>
        <button type="button" onClick={finish} className="mt-3 w-full text-center text-sm font-semibold text-ink-400">
          Skip for now
        </button>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form onSubmit={submitCode} noValidate>
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
            setError(null);
          }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Change number
        </button>

        <h2 className="text-xl font-bold text-ink-900">Enter the code</h2>
        <p className="mt-1 text-sm text-ink-500">Sent to {formatPhone(`+91${phone}`)}</p>

        <input
          ref={codeRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="mt-5 h-14 w-full rounded-xl border border-ink-200 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          aria-label="Verification code"
        />

        {devCode && (
          <p className="mt-3 rounded-lg bg-brand-50 p-2.5 text-center text-xs text-brand-800">
            Demo code: <strong className="font-mono font-bold">{devCode}</strong>
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <Button type="submit" fullWidth size="lg" loading={busy} className="mt-5" disabled={code.length !== 6}>
          {mode === "signup" ? "Create account" : "Verify & sign in"}
        </Button>

        <button
          type="button"
          onClick={() => requestOtp()}
          disabled={resendIn > 0 || busy}
          className="mt-4 w-full text-center text-sm font-semibold text-brand-700 disabled:text-ink-300"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestOtp} noValidate>
      <Segmented
        label="Sign in or create an account"
        options={[
          { value: "login", label: "Login" },
          { value: "signup", label: "Sign up" },
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setError(null);
        }}
      />

      <div className="mt-5 flex flex-col gap-3">
        {mode === "signup" && (
          <IconInput icon={<User aria-hidden className="size-5" />}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoComplete="name"
              aria-label="Full name"
              className="h-12 flex-1 bg-transparent text-[15px] outline-none"
            />
          </IconInput>
        )}

        <IconInput icon={<Phone aria-hidden className="size-5" />}>
          <span className="text-[15px] font-semibold text-ink-500">+91</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Mobile number"
            className="h-12 flex-1 bg-transparent text-[15px] tracking-wide outline-none"
            aria-label="Mobile number"
            aria-invalid={error ? true : undefined}
          />
        </IconInput>
      </div>

      <p className="mt-2 text-xs text-ink-400">
        We&apos;ll text you a 6-digit code. No password needed.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={busy}
        className="mt-5"
        disabled={phone.length !== 10 || (mode === "signup" && name.trim().length < 2)}
      >
        {mode === "signup" ? "Send code & sign up" : "Send code"}
      </Button>

      {devPrefix && (
        <p className="mt-4 rounded-lg bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
          <strong className="font-semibold text-ink-700">Demo mode:</strong> use{" "}
          <code className="font-mono">9000000001</code>,{" "}
          <code className="font-mono">9000000002</code> or{" "}
          <code className="font-mono">9000000009</code> (admin), or any{" "}
          <code className="font-mono">90000000xx</code> for a new account. The code is always{" "}
          <code className="font-mono">000000</code>.
        </p>
      )}
    </form>
  );
}

function IconInput({
  icon,
  className,
  children,
}: {
  icon: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        inputClass,
        "flex items-center gap-2.5 px-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-100",
        className,
      )}
    >
      <span className="text-ink-400">{icon}</span>
      {children}
    </div>
  );
}
