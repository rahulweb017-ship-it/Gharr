"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiPatch } from "@/lib/api-client";

/**
 * Order fulfilment buttons for the vendor console.
 *
 * As with bookings, the available moves come from the server's state table, so
 * this renders only transitions that are already legal for this actor at this
 * status.
 */

interface Action {
  to: string;
  label: string;
}

export function OrderActions({
  orderId,
  actions,
}: {
  orderId: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(status: string) {
    setBusy(status);
    setError(null);

    const result = await apiPatch(`/orders/${orderId}/status`, { status });

    setBusy(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.to}
            size="sm"
            variant={action.to === "CANCELLED" ? "ghost" : "primary"}
            className={action.to === "CANCELLED" ? "border border-ink-200 bg-white text-red-700 hover:bg-red-50" : undefined}
            loading={busy === action.to}
            onClick={() => run(action.to)}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
