"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiPatch } from "@/lib/api-client";

/**
 * Buttons for whatever moves the state machine currently permits.
 *
 * The list is supplied by the server from `allowedBookingTransitions`, so this
 * component never decides what is legal — it only renders what already is. That
 * means a rule change in booking-state.ts updates both sides at once.
 */

interface Action {
  to: string;
  label: string;
}

/** Destructive moves get a confirmation and a visual warning. */
const DESTRUCTIVE = new Set([
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_WORKER",
  "NO_SHOW",
  "DISPUTED",
]);

export function BookingActions({
  bookingId,
  actions,
}: {
  bookingId: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function run(status: string) {
    setBusy(status);
    setError(null);

    const result = await apiPatch(`/bookings/${bookingId}/status`, { status });

    setBusy(null);
    setConfirming(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.refresh();
  }

  const primary = actions.filter((action) => !DESTRUCTIVE.has(action.to));
  const destructive = actions.filter((action) => DESTRUCTIVE.has(action.to));

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      {primary.map((action) => (
        <Button
          key={action.to}
          fullWidth
          size="lg"
          loading={busy === action.to}
          onClick={() => run(action.to)}
        >
          {action.label}
        </Button>
      ))}

      {destructive.map((action) =>
        confirming === action.to ? (
          <div
            key={action.to}
            role="alertdialog"
            aria-label={`${action.label}?`}
            className="rounded-(--radius-card) border border-red-100 bg-red-50/50 p-3.5"
          >
            <p className="text-[13px] font-semibold text-ink-900">
              {action.label}?
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              A late cancellation may incur a fee. This cannot be undone.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setConfirming(null)}
              >
                Keep booking
              </Button>
              <Button
                variant="danger"
                fullWidth
                loading={busy === action.to}
                onClick={() => run(action.to)}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : (
          // Neutral outline rather than orange: a cancel must never look like the CTA.
          <Button
            key={action.to}
            variant="ghost"
            fullWidth
            className="border border-ink-200 bg-white text-red-700 hover:bg-red-50"
            onClick={() => setConfirming(action.to)}
          >
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}
