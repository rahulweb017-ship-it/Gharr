"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { apiPost } from "@/lib/api-client";

/**
 * Outcome picker for the test gateway.
 *
 * Failure and abandonment are offered alongside success on purpose — those are
 * the paths that actually break in production, and they need to be as easy to
 * reproduce as the happy one.
 */
export function MockGateway({
  paymentId,
  firstOrderId,
  alreadySettled,
}: {
  paymentId: string;
  providerOrderId: string;
  firstOrderId: string | null;
  alreadySettled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(outcome: "success" | "failure") {
    setBusy(outcome);
    setError(null);

    const result = await apiPost(`/payments/mock/${paymentId}/complete`, {
      outcome,
    });

    setBusy(null);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    router.push(
      firstOrderId
        ? `/orders/${firstOrderId}?placed=${outcome === "success" ? "1" : "0"}`
        : "/orders",
    );
    router.refresh();
  }

  if (alreadySettled) {
    return (
      <div className="text-center">
        <p className="text-sm text-ink-500">This payment has already been settled.</p>
        <Button
          variant="outline"
          fullWidth
          className="mt-3"
          onClick={() => router.push("/orders")}
        >
          View orders
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <Button
        fullWidth
        size="lg"
        loading={busy === "success"}
        onClick={() => settle("success")}
      >
        Pay successfully
      </Button>

      <Button
        variant="outline"
        fullWidth
        loading={busy === "failure"}
        onClick={() => settle("failure")}
      >
        Simulate a failed payment
      </Button>

      <Button variant="ghost" fullWidth onClick={() => router.push("/orders")}>
        Abandon and go back
      </Button>
    </div>
  );
}
