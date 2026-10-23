"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api-client";

const REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery is taking too long",
  "No longer needed",
  "Other",
];

/**
 * Customer cancellation.
 *
 * A reason is required rather than optional — cancellation reasons are the
 * cheapest signal available about why orders fail, and an optional field in a
 * modal is left blank almost every time.
 */
export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);

    const result = await apiPost(`/orders/${orderId}/cancel`, { reason });
    setBusy(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      // Neutral outline rather than orange: cancelling must never look like the CTA.
      <Button
        variant="ghost"
        fullWidth
        className="border border-ink-200 bg-white text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
      >
        Cancel order
      </Button>
    );
  }

  return (
    <div className="rounded-(--radius-card) border border-red-100 bg-white p-4 shadow-(--shadow-card)">
      <h3 id="cancel-reason-title" className="text-[15px] font-bold text-ink-900">
        Why are you cancelling?
      </h3>

      <div role="radiogroup" aria-labelledby="cancel-reason-title" className="mt-2 flex flex-col gap-1.5">
        {REASONS.map((option) => (
          <label
            key={option}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm text-ink-700 transition-colors",
              reason === option ? "border-brand-600 bg-brand-50/60" : "border-ink-100 hover:border-ink-200",
            )}
          >
            <input
              type="radio"
              name="cancel-reason"
              value={option}
              checked={reason === option}
              onChange={() => setReason(option)}
              className="size-4 accent-brand-600"
            />
            {option}
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setOpen(false)}
          disabled={busy}
        >
          Keep order
        </Button>
        <Button variant="danger" fullWidth loading={busy} onClick={cancel}>
          Cancel order
        </Button>
      </div>
    </div>
  );
}
