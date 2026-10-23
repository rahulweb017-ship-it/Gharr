import Link from "next/link";
import { BadgeCheck, Calculator, HardHat, ShoppingBag } from "lucide-react";
import { LoginForm } from "@/components/forms/LoginForm";
import { Logo } from "@/components/layout/Logo";
import { env } from "@/server/env";

export const metadata = { title: "Sign in" };

/**
 * Sign-in / sign-up.
 *
 * Navy welcome hero over a white card, per the UI boards. On desktop the hero
 * becomes the left half of a split screen with the product's three promises.
 * `?next=` returns the user to where they were headed (checkout, a saved
 * estimate draft, a booking) after verifying.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const { next, mode } = await searchParams;

  return (
    <div className="min-h-screen bg-ink-900 md:grid md:grid-cols-2 md:bg-white">
      <section className="relative overflow-hidden bg-ink-900 px-6 pt-[calc(env(safe-area-inset-top,0px)+40px)] pb-16 md:flex md:flex-col md:justify-center md:px-16 md:pb-10">
        {/* Soft orange glow and a skyline band — decoration only. */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-ink-950/60 to-transparent" />

        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-3 py-2">
            <Logo href={null} />
          </div>
          <p className="mt-8 text-sm font-medium text-ink-300">Welcome to</p>
          <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-white md:text-5xl">
            Home<span className="text-brand-400">all</span>
          </h1>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-200">
            Sign in or create an account to plan, buy and build — estimates, materials and labour in one app.
          </p>

          <ul className="mt-10 hidden flex-col gap-4 md:flex">
            {[
              { icon: Calculator, title: "Transparent estimates", body: "Every line is quantity × local price. No black-box numbers." },
              { icon: ShoppingBag, title: "Verified vendors", body: "GST and delivery shown before you pay." },
              { icon: HardHat, title: "Skilled local labour", body: "Background-checked masons, electricians and more." },
            ].map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-300">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-bold text-white">{title}</span>
                  <span className="block text-sm text-ink-300">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative -mt-8 rounded-t-(--radius-sheet) bg-white px-6 pt-7 pb-10 md:mt-0 md:flex md:flex-col md:justify-center md:rounded-none md:px-16">
        <div className="mx-auto w-full max-w-md">
          <LoginForm
            devPrefix={env.OTP_DEV_ECHO ? env.DEV_PHONE_PREFIX : null}
            next={next ?? null}
            initialMode={mode === "signup" ? "signup" : "login"}
          />

          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-400">
            <BadgeCheck aria-hidden className="size-4 text-trust-600" />
            Secure OTP sign-in · your number is never shared
          </p>
          <p className="mt-3 text-center text-xs leading-relaxed text-ink-400">
            By continuing you agree to our{" "}
            <Link href="/terms" className="font-semibold text-ink-600 underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-ink-600 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
