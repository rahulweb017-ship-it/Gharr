"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, TextInput, fieldErrors } from "@/components/ui/Field";
import { apiPatch, apiPost } from "@/lib/api-client";
import { paiseToRupees, rupeesToPaise } from "@/components/admin/catalogue/inline-edit";

/**
 * Business details and delivery settings. Registration and later edits share
 * it; money is typed in rupees and sent as paise. After registering, the
 * session is refreshed so the new VENDOR role is in the access token before
 * the portal loads.
 */

export interface VendorProfileValues {
  businessName: string;
  legalName: string | null;
  gstin: string | null;
  email: string | null;
  city: string;
  state: string;
  pincode: string;
  servicePincodes: string[];
  baseDeliveryFeePaise: number;
  perKmFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  maxDeliveryKm: number;
  minOrderPaise: number;
}

type FormState = Record<
  | "businessName" | "legalName" | "gstin" | "email" | "city" | "state" | "pincode" | "servicePincodes"
  | "baseDeliveryFee" | "perKmFee" | "freeDeliveryAbove" | "maxDeliveryKm" | "minOrder",
  string
>;

function toForm(v?: VendorProfileValues, defaultCity = ""): FormState {
  return {
    businessName: v?.businessName ?? "",
    legalName: v?.legalName ?? "",
    gstin: v?.gstin ?? "",
    email: v?.email ?? "",
    city: v?.city ?? defaultCity,
    state: v?.state ?? (defaultCity === "Hyderabad" ? "Telangana" : ""),
    pincode: v?.pincode ?? "",
    servicePincodes: (v?.servicePincodes ?? []).filter((p) => p !== v?.pincode).join(", "),
    baseDeliveryFee: v ? paiseToRupees(v.baseDeliveryFeePaise) : "0",
    perKmFee: v ? paiseToRupees(v.perKmFeePaise) : "0",
    freeDeliveryAbove: v?.freeDeliveryAbovePaise != null ? paiseToRupees(v.freeDeliveryAbovePaise) : "",
    maxDeliveryKm: String(v?.maxDeliveryKm ?? 25),
    minOrder: v ? paiseToRupees(v.minOrderPaise) : "0",
  };
}

function money(value: string): number {
  const paise = rupeesToPaise(value || "0");
  return Number.isFinite(paise) ? paise : -1;
}

export function VendorProfileForm({
  mode,
  initial,
  defaultCity,
  identityLocked = false,
}: {
  mode: "register" | "edit";
  initial?: VendorProfileValues;
  defaultCity?: string;
  identityLocked?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toForm(initial, defaultCity));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMessage(null);

    const body = {
      businessName: form.businessName,
      ...(identityLocked ? {} : { legalName: form.legalName || null, gstin: form.gstin || null }),
      email: form.email || null,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
      servicePincodes: form.servicePincodes.split(/[\s,]+/).filter(Boolean),
      baseDeliveryFeePaise: money(form.baseDeliveryFee),
      perKmFeePaise: money(form.perKmFee),
      freeDeliveryAbovePaise: form.freeDeliveryAbove.trim() ? money(form.freeDeliveryAbove) : null,
      maxDeliveryKm: Number(form.maxDeliveryKm) || 0,
      minOrderPaise: money(form.minOrder),
    };

    const result = mode === "register" ? await apiPost("/vendor/register", body) : await apiPatch("/vendor/me", body);
    if (!result.ok) {
      setBusy(false);
      setErrors(fieldErrors(result.error.details));
      setMessage({ tone: "error", text: result.error.message });
      return;
    }

    if (mode === "register") {
      await apiPost("/auth/refresh", {});
      router.push("/supplier/documents");
      return;
    }
    setBusy(false);
    setMessage({ tone: "ok", text: "Saved" });
    router.refresh();
  }

  const err = (key: string) => errors[key] ?? null;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-3 text-sm font-bold text-ink-900">Business</legend>
        <Field label="Business / shop name" htmlFor="businessName" error={err("businessName")} className="md:col-span-2">
          <TextInput id="businessName" value={form.businessName} onChange={set("businessName")} autoComplete="organization" required invalid={!!err("businessName")} />
        </Field>
        <Field label="Legal name (as on GST)" htmlFor="legalName" error={err("legalName")} hint={identityLocked ? "Locked after verification" : undefined}>
          <TextInput id="legalName" value={form.legalName} onChange={set("legalName")} disabled={identityLocked} />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={err("gstin")} hint={identityLocked ? "Locked after verification" : "15 characters, e.g. 36AAKFK1234L1Z5"}>
          <TextInput id="gstin" value={form.gstin} onChange={set("gstin")} className="uppercase" maxLength={15} disabled={identityLocked} invalid={!!err("gstin")} />
        </Field>
        <Field label="Email for orders and payouts" htmlFor="email" error={err("email")} className="md:col-span-2">
          <TextInput id="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" invalid={!!err("email")} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-3 text-sm font-bold text-ink-900">Shop location</legend>
        <Field label="City" htmlFor="city" error={err("city")}>
          <TextInput id="city" value={form.city} onChange={set("city")} autoComplete="address-level2" invalid={!!err("city")} />
        </Field>
        <Field label="State" htmlFor="state" error={err("state")}>
          <TextInput id="state" value={form.state} onChange={set("state")} autoComplete="address-level1" invalid={!!err("state")} />
        </Field>
        <Field label="Pincode" htmlFor="pincode" error={err("pincode")}>
          <TextInput id="pincode" value={form.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} autoComplete="postal-code" invalid={!!err("pincode")} />
        </Field>
        <Field
          label="Other pincodes you deliver to"
          htmlFor="servicePincodes"
          error={Object.entries(errors).find(([k]) => k.startsWith("servicePincodes"))?.[1] ?? null}
          hint="Separate with commas. Your own pincode is always included."
          className="md:col-span-3"
        >
          <TextInput id="servicePincodes" value={form.servicePincodes} onChange={set("servicePincodes")} inputMode="numeric" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-3 text-sm font-bold text-ink-900">Delivery charges</legend>
        <Field label="Base delivery fee (₹)" htmlFor="baseDeliveryFee" error={err("baseDeliveryFeePaise")}>
          <TextInput id="baseDeliveryFee" value={form.baseDeliveryFee} onChange={set("baseDeliveryFee")} inputMode="decimal" />
        </Field>
        <Field label="Per km (₹)" htmlFor="perKmFee" error={err("perKmFeePaise")}>
          <TextInput id="perKmFee" value={form.perKmFee} onChange={set("perKmFee")} inputMode="decimal" />
        </Field>
        <Field label="Max delivery distance (km)" htmlFor="maxDeliveryKm" error={err("maxDeliveryKm")}>
          <TextInput id="maxDeliveryKm" value={form.maxDeliveryKm} onChange={set("maxDeliveryKm")} inputMode="numeric" />
        </Field>
        <Field label="Free delivery above (₹)" htmlFor="freeDeliveryAbove" error={err("freeDeliveryAbovePaise")} hint="Leave empty for no free delivery">
          <TextInput id="freeDeliveryAbove" value={form.freeDeliveryAbove} onChange={set("freeDeliveryAbove")} inputMode="decimal" />
        </Field>
        <Field label="Minimum order (₹)" htmlFor="minOrder" error={err("minOrderPaise")}>
          <TextInput id="minOrder" value={form.minOrder} onChange={set("minOrder")} inputMode="decimal" />
        </Field>
      </fieldset>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm font-medium text-red-600" : "text-sm font-medium text-trust-700"}>
          {message.text}
        </p>
      )}

      <Button type="submit" loading={busy} size="lg" className="w-full md:w-auto">
        {mode === "register" ? "Register my business" : "Save changes"}
      </Button>
    </form>
  );
}
