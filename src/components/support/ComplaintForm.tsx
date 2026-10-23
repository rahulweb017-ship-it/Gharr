"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput, fieldErrors, inputClass } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory } from "@/shared/contracts/support";

/**
 * "Raise a complaint". Opened from an order or booking page, it arrives with
 * that record pre-selected, so support sees exactly what the problem is about.
 */

interface Option {
  value: string;
  label: string;
}

export function ComplaintForm({
  orders,
  bookings,
  initialOrderId,
  initialBookingId,
}: {
  orders: Option[];
  bookings: Option[];
  initialOrderId?: string;
  initialBookingId?: string;
}) {
  const router = useRouter();
  const initialAbout = initialOrderId && orders.some((o) => o.value === initialOrderId)
    ? `order:${initialOrderId}`
    : initialBookingId && bookings.some((b) => b.value === initialBookingId)
      ? `booking:${initialBookingId}`
      : "";
  const [about, setAbout] = useState(initialAbout);
  const [category, setCategory] = useState<TicketCategory>(
    initialAbout.startsWith("order:") ? "ORDER" : initialAbout.startsWith("booking:") ? "BOOKING" : "OTHER",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function pickAbout(value: string) {
    setAbout(value);
    if (value.startsWith("order:") && category === "OTHER") setCategory("ORDER");
    if (value.startsWith("booking:") && category === "OTHER") setCategory("BOOKING");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    const [kind, id] = about.split(":");
    const result = await apiPost<{ id: string }>("/support/tickets", {
      subject,
      message,
      category,
      orderId: kind === "order" ? id : undefined,
      bookingId: kind === "booking" ? id : undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setErrors(fieldErrors(result.error.details));
      setFormError(result.error.message);
      return;
    }
    router.push(`/account/support/${result.data.id}?new=1`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {(orders.length > 0 || bookings.length > 0) && (
        <Field label="What is it about?" htmlFor="complaint-about">
          <SelectInput id="complaint-about" value={about} onChange={(e) => pickAbout(e.target.value)}>
            <option value="">Not about a specific order or booking</option>
            {orders.length > 0 && (
              <optgroup label="Orders">
                {orders.map((o) => (
                  <option key={o.value} value={`order:${o.value}`}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
            {bookings.length > 0 && (
              <optgroup label="Labour bookings">
                {bookings.map((b) => (
                  <option key={b.value} value={`booking:${b.value}`}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            )}
          </SelectInput>
        </Field>
      )}

      <Field label="Topic" htmlFor="complaint-category" error={errors.category}>
        <SelectInput id="complaint-category" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
          {TICKET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {TICKET_CATEGORY_LABELS[c]}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Subject" htmlFor="complaint-subject" error={errors.subject}>
        <TextInput
          id="complaint-subject"
          value={subject}
          maxLength={120}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Two tile boxes arrived broken"
          invalid={!!errors.subject}
        />
      </Field>

      <Field label="Tell us what happened" htmlFor="complaint-message" error={errors.message}>
        <textarea
          id="complaint-message"
          rows={5}
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={!!errors.message || undefined}
          className={cn(inputClass, "h-auto py-2.5")}
        />
      </Field>

      {formError && Object.keys(errors).length === 0 && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {formError}
        </p>
      )}

      <Button type="submit" loading={busy} fullWidth>
        Send to Gharr Support
      </Button>
    </form>
  );
}
