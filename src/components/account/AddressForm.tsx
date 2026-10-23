"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, fieldErrors } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { apiPatch, apiPost } from "@/lib/api-client";

/**
 * Add / edit an address. Used by the address book, checkout step ① and the
 * labour booking form — one form, so validation and wording never drift.
 *
 * Validation lives in the shared AddressInput contract and runs on the server;
 * the form renders whatever field errors come back.
 */

export interface SavedAddress {
  id: string;
  type: "HOME" | "SITE" | "OFFICE";
  contactName: string;
  contactPhone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin?: string | null;
  isDefault: boolean;
}

const TYPES = [
  { value: "HOME", label: "Home" },
  { value: "SITE", label: "Site" },
  { value: "OFFICE", label: "Office" },
] as const;

export function AddressForm({
  initial,
  defaults,
  onSaved,
  onCancel,
  submitLabel,
}: {
  /** Present when editing. */
  initial?: SavedAddress;
  /** Prefill for a new address, e.g. the signed-in user's name and phone. */
  defaults?: { contactName?: string; contactPhone?: string; city?: string };
  onSaved: (address: SavedAddress) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [form, setForm] = useState({
    type: initial?.type ?? "HOME",
    contactName: initial?.contactName ?? defaults?.contactName ?? "",
    contactPhone: (initial?.contactPhone ?? defaults?.contactPhone ?? "").replace(/^\+91/, ""),
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    landmark: initial?.landmark ?? "",
    city: initial?.city ?? defaults?.city ?? "Hyderabad",
    state: initial?.state ?? "Telangana",
    pincode: initial?.pincode ?? "",
    isDefault: initial?.isDefault ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);

    const body = form;
    const result = initial
      ? await apiPatch<SavedAddress>(`/addresses/${initial.id}`, body)
      : await apiPost<SavedAddress>("/addresses", body);

    setBusy(false);

    if (!result.ok) {
      const byField = fieldErrors(result.error.details);
      setErrors(byField);
      if (Object.keys(byField).length === 0) setFormError(result.error.message);
      return;
    }

    onSaved(result.data);
  }

  const id = (name: string) => `address-${name}`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Segmented
        label="Address type"
        options={TYPES}
        value={form.type}
        onChange={(type) => setForm((f) => ({ ...f, type }))}
        size="sm"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact name" htmlFor={id("name")} error={errors.contactName}>
          <TextInput id={id("name")} value={form.contactName} onChange={set("contactName")} autoComplete="name" invalid={!!errors.contactName} />
        </Field>
        <Field label="Mobile number" htmlFor={id("phone")} error={errors.contactPhone}>
          <TextInput
            id={id("phone")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={form.contactPhone}
            onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
            placeholder="98765 43210"
            invalid={!!errors.contactPhone}
          />
        </Field>
      </div>

      <Field label="House / flat no., building, street" htmlFor={id("line1")} error={errors.line1}>
        <TextInput id={id("line1")} value={form.line1} onChange={set("line1")} autoComplete="address-line1" invalid={!!errors.line1} />
      </Field>
      <Field label="Area / locality (optional)" htmlFor={id("line2")} error={errors.line2}>
        <TextInput id={id("line2")} value={form.line2} onChange={set("line2")} autoComplete="address-line2" />
      </Field>
      <Field label="Landmark (optional)" htmlFor={id("landmark")} error={errors.landmark} hint="Helps the delivery partner find the site">
        <TextInput id={id("landmark")} value={form.landmark} onChange={set("landmark")} />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Pincode" htmlFor={id("pincode")} error={errors.pincode}>
          <TextInput
            id={id("pincode")}
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
            invalid={!!errors.pincode}
          />
        </Field>
        <Field label="City" htmlFor={id("city")} error={errors.city}>
          <TextInput id={id("city")} value={form.city} onChange={set("city")} autoComplete="address-level2" invalid={!!errors.city} />
        </Field>
        <Field label="State" htmlFor={id("state")} error={errors.state} className="col-span-2 sm:col-span-1">
          <TextInput id={id("state")} value={form.state} onChange={set("state")} autoComplete="address-level1" invalid={!!errors.state} />
        </Field>
      </div>

      {!initial?.isDefault && (
        <label className="flex items-center gap-2.5 text-sm font-medium text-ink-700">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            className="size-4 accent-brand-600"
          />
          Make this my default address
        </label>
      )}

      {formError && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" loading={busy} className="flex-1">
          {submitLabel ?? (initial ? "Save changes" : "Save address")}
        </Button>
      </div>
    </form>
  );
}

/** One-line summary used in pickers and order screens. */
export function formatAddress(a: Pick<SavedAddress, "line1" | "line2" | "landmark" | "city" | "pincode">): string {
  return [a.line1, a.line2, a.landmark, `${a.city} ${a.pincode}`].filter(Boolean).join(", ");
}
