import Link from "next/link";
import { requirePageVendor } from "@/server/auth/supplier-page";
import { getEarnings } from "@/server/services/vendor/earnings.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel, StatTile } from "@/components/admin/Stat";
import { Chip } from "@/components/ui/Chip";
import { tableShell, tdClass, thClass, theadClass } from "@/components/admin/catalogue/inline-edit";
import { formatDay } from "@/lib/admin-format";
import { formatINR } from "@/shared/money";
import { cn } from "@/lib/cn";

export const metadata = { title: "Earnings" };

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default async function SupplierEarningsPage() {
  const { actor } = await requirePageVendor("/supplier/earnings");
  const e = await getEarnings(actor);
  const peak = Math.max(1, ...e.months.map((m) => m.grossPaise));

  return (
    <>
      <AdminPageHeader
        title="Earnings"
        description="Sales count once an order is delivered. Gharr's commission is deducted before payout."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Delivered sales" value={formatINR(e.lifetime.grossPaise)} hint="All time" />
        <StatTile label="Commission" value={formatINR(e.lifetime.commissionPaise)} />
        <StatTile label="Paid out" value={formatINR(e.lifetime.paidOutPaise)} />
        <StatTile label="Due to you" value={formatINR(e.lifetime.outstandingPaise)} tone={e.lifetime.outstandingPaise > 0 ? "attention" : "default"} />
      </div>

      <Panel title="Last 6 months" className="mt-6">
        <ul className="space-y-2.5">
          {[...e.months].reverse().map((m) => (
            <li key={m.month} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-ink-500">{monthLabel(m.month)}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-ink-50" aria-hidden>
                <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(m.grossPaise / peak) * 100}%` }} />
              </span>
              <span className="text-right tabular">
                <span className="font-semibold text-ink-900">{formatINR(m.grossPaise)}</span>
                <span className="ml-2 text-xs text-ink-400">{m.orders} orders</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <h2 className="mt-8 mb-3 text-base font-bold text-ink-900">Delivered orders</h2>
      {e.commissions.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-500">
          Nothing delivered in the last 6 months yet.
        </p>
      ) : (
        <div className={tableShell}>
          <table className="w-full min-w-[40rem] text-sm">
            <thead className={theadClass}>
              <tr>
                <th scope="col" className={cn(thClass, "text-left")}>Order</th>
                <th scope="col" className={cn(thClass, "text-left")}>Delivered</th>
                <th scope="col" className={cn(thClass, "text-right")}>Sale</th>
                <th scope="col" className={cn(thClass, "text-right")}>Commission</th>
                <th scope="col" className={cn(thClass, "text-right")}>You earn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {e.commissions.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    {c.order ? (
                      <Link href={`/supplier/orders/${c.order.id}`} className="font-mono text-xs font-semibold text-brand-700">
                        {c.order.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tdClass}>{formatDay(c.createdAt)}</td>
                  <td className={cn(tdClass, "text-right tabular")}>{formatINR(c.baseAmountPaise)}</td>
                  <td className={cn(tdClass, "text-right tabular text-ink-500")}>
                    {formatINR(c.commissionPaise)} <span className="text-xs">({c.ratePercent}%)</span>
                  </td>
                  <td className={cn(tdClass, "text-right font-semibold tabular")}>{formatINR(c.netPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 mb-3 text-base font-bold text-ink-900">Payouts</h2>
      {e.payouts.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-500">
          No payouts yet. Payouts are sent to the bank account on your verified bank proof.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)">
          {e.payouts.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p className="font-semibold text-ink-900">
                  {formatDay(p.periodStart)} – {formatDay(p.periodEnd)}
                </p>
                <p className="text-xs text-ink-400">
                  Gross {formatINR(p.grossPaise)} · commission {formatINR(p.commissionPaise)}
                  {p.reference ? ` · ref ${p.reference}` : ""}
                </p>
              </div>
              <span className="flex items-center gap-2">
                <span className="font-bold tabular">{formatINR(p.netPaise)}</span>
                <Chip tone={p.status === "PAID" ? "trust" : "warning"}>{p.status === "PAID" ? "Paid" : "Pending"}</Chip>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
