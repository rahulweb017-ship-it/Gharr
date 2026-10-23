import type { PaymentStatus } from "@prisma/client";
import { Money } from "@/components/ui/Money";
import { ActionButton } from "@/components/admin/ActionButton";
import { formatDateTime } from "@/lib/admin-format";
import { PaymentStatusChip } from "./StatusChips";

/**
 * Refund rows for one order or booking. A REFUND_PENDING row is a refund the
 * gateway has not confirmed — it keeps the provider's error so an admin can
 * see why before retrying.
 */

export interface RefundRow {
  id: string;
  amountPaise: number;
  reason: string;
  status: PaymentStatus;
  processedAt: Date | string | null;
  failureMessage: string | null;
  createdAt: Date | string;
}

export function RefundsTable({ refunds, canWrite }: { refunds: RefundRow[]; canWrite: boolean }) {
  if (refunds.length === 0) return <p className="text-sm text-ink-500">No refunds yet.</p>;

  return (
    <ul className="divide-y divide-ink-100 rounded-xl border border-ink-100">
      {refunds.map((r) => (
        <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
              <Money paise={r.amountPaise} showPaise />
              <PaymentStatusChip status={r.status} />
            </p>
            <p className="mt-1 text-sm text-ink-600">{r.reason}</p>
            <p className="mt-0.5 text-xs text-ink-400">
              Requested {formatDateTime(r.createdAt)}
              {r.processedAt ? ` · processed ${formatDateTime(r.processedAt)}` : ""}
            </p>
            {r.failureMessage && r.status === "REFUND_PENDING" && (
              <p className="mt-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{r.failureMessage}</p>
            )}
          </div>
          {canWrite && r.status === "REFUND_PENDING" && (
            <ActionButton
              label="Retry"
              path={`/admin/refunds/${r.id}/retry`}
              confirm={{
                title: "Retry this refund?",
                message: "The gateway is asked again with the same idempotency key, so it cannot pay out twice.",
                confirmLabel: "Retry refund",
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
