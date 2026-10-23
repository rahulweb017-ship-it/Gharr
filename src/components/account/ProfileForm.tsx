"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, fieldErrors } from "@/components/ui/Field";
import { apiPatch } from "@/lib/api-client";
import { formatPhone } from "@/shared/phone";

/** Name and email. The phone number is the sign-in identity, so it is read-only. */
export function ProfileForm({ name: initialName, email: initialEmail, phone }: { name: string; email: string; phone: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    setSaved(false);

    const result = await apiPatch("/auth/me", { name, email });
    setBusy(false);

    if (!result.ok) {
      const byField = fieldErrors(result.error.details);
      setErrors(byField);
      if (Object.keys(byField).length === 0) setFormError(result.error.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)">
      <Field label="Full name" htmlFor="profile-name" error={errors.name}>
        <TextInput id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" invalid={!!errors.name} />
      </Field>
      <Field label="Email (optional)" htmlFor="profile-email" error={errors.email} hint="For invoices and order updates">
        <TextInput
          id="profile-email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          invalid={!!errors.email}
        />
      </Field>
      <Field label="Mobile number" htmlFor="profile-phone" hint="Your sign-in number can't be changed here">
        <TextInput id="profile-phone" value={formatPhone(phone)} disabled readOnly />
      </Field>

      {formError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}
      {saved && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-trust-50 p-3 text-sm font-medium text-trust-700">
          <CheckCircle2 aria-hidden className="size-4" /> Saved
        </p>
      )}

      <Button type="submit" loading={busy} fullWidth>
        Save changes
      </Button>
    </form>
  );
}
