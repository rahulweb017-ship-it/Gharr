import { BrickWall, ChevronRight, HardHat, Receipt } from "lucide-react";
import { Card } from "@/components/ui/Surface";
import { Money } from "@/components/ui/Money";
import { cn } from "@/lib/cn";
import { formatINR } from "@/shared/money";
import { formatQuantity, perUnitLabel } from "@/shared/units";
import {
  BUCKET_LABELS,
  shareOfTotal,
  type EstimateBucket,
} from "@/shared/estimate";
import type { getEstimate } from "@/server/services/estimate.service";

/**
 * The estimate's cost breakdown and its itemised table.
 *
 * The table is the product's core promise: every figure is quantity × rate and
 * can be checked with a calculator. It is therefore never collapsed away or
 * summarised further — the bucket rows above only anchor down to it.
 */

export type EstimateDetail = Awaited<ReturnType<typeof getEstimate>>;
type Line = EstimateDetail["lines"][number];

const BUCKETS: EstimateBucket[] = ["MATERIALS", "LABOUR", "OTHER"];

const BUCKET_ICONS = {
  MATERIALS: { Icon: BrickWall, tone: "bg-brand-50 text-brand-600" },
  LABOUR: { Icon: HardHat, tone: "bg-blue-50 text-blue-600" },
  OTHER: { Icon: Receipt, tone: "bg-trust-50 text-trust-600" },
} as const;

function bucketTotal(estimate: EstimateDetail, bucket: EstimateBucket): number {
  if (bucket === "MATERIALS") return estimate.materialsPaise;
  if (bucket === "LABOUR") return estimate.labourPaise;
  return estimate.otherPaise;
}

export function CostBreakdown({ estimate }: { estimate: EstimateDetail }) {
  return (
    <section aria-labelledby="breakdown-title">
      <h2 id="breakdown-title" className="mb-3 text-[17px] font-bold tracking-tight text-ink-900">
        Estimated Cost Breakdown
      </h2>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        {BUCKETS.map((bucket) => {
          const { Icon, tone } = BUCKET_ICONS[bucket];
          const amount = bucketTotal(estimate, bucket);
          return (
            <a
              key={bucket}
              href={`#items-${bucket}`}
              className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-ink-50"
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", tone)}>
                <Icon aria-hidden className="size-5" />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-ink-900">
                {BUCKET_LABELS[bucket]}
                <span className="sr-only"> — view itemised lines</span>
              </span>
              <span className="text-right">
                <Money paise={amount} className="block text-[15px] font-bold text-ink-900" />
                <span className="block text-xs text-ink-500">
                  {shareOfTotal(amount, estimate.totalPaise)}% of total
                </span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-300" />
            </a>
          );
        })}
      </Card>
    </section>
  );
}

export function TotalCard({ totalPaise }: { totalPaise: number }) {
  return (
    <div className="flex items-center gap-4 rounded-(--radius-card) border border-trust-100 bg-trust-50 p-4">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-trust-600 shadow-(--shadow-card)">
        <Receipt aria-hidden className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-trust-700">Total Estimated Cost</p>
        <Money paise={totalPaise} className="block text-[28px] leading-tight font-extrabold text-ink-900" />
      </div>
    </div>
  );
}

/** "12 bag", "10% of ₹4,20,000", or a bare count for unit-less lump sums. */
function quantityText(line: Line): string {
  if (line.basis === "PERCENT_OF_SUBTOTAL") {
    return `${Number(line.quantity.toFixed(2))}% of ${formatINR(line.unitPricePaise)}`;
  }
  return line.unit ? formatQuantity(line.quantity, line.unit) : String(Number(line.quantity.toFixed(2)));
}

function Rate({ line }: { line: Line }) {
  if (line.basis === "PERCENT_OF_SUBTOTAL") return <span className="text-ink-400">—</span>;
  return (
    <span className="tabular">
      <Money paise={line.unitPricePaise} />
      {line.unit && <span className="text-ink-500">{perUnitLabel(line.unit)}</span>}
    </span>
  );
}

export function ItemisedTable({ estimate }: { estimate: EstimateDetail }) {
  return (
    <section aria-labelledby="itemised-title">
      <h2 id="itemised-title" className="text-[17px] font-bold tracking-tight text-ink-900">
        Itemised estimate
      </h2>
      <p className="mt-0.5 mb-3 text-xs text-ink-500">
        Every line is quantity × {estimate.city} rate — check any of them with a calculator.
      </p>

      <div className="space-y-4">
        {BUCKETS.map((bucket) => {
          const lines = estimate.lines.filter((l) => l.bucket === bucket);
          if (lines.length === 0) return null;
          return (
            <Card key={bucket} className="overflow-hidden">
              {/* Anchor target for the breakdown rows; offset clears the sticky header. */}
              <h3
                id={`items-${bucket}`}
                className="flex scroll-mt-20 items-center justify-between border-b border-ink-100 bg-ink-50 px-4 py-2.5 text-sm font-bold text-ink-800 md:scroll-mt-24"
              >
                {BUCKET_LABELS[bucket]}
                <span className="text-xs font-medium text-ink-500">
                  {lines.length} {lines.length === 1 ? "item" : "items"}
                </span>
              </h3>

              {/* Phones: stacked rows, amount on the right, the maths underneath. */}
              <ul className="divide-y divide-ink-100 md:hidden">
                {lines.map((line) => (
                  <li key={line.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-ink-900">{line.label}</span>
                      <Money paise={line.amountPaise} className="shrink-0 text-sm font-bold text-ink-900" />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {quantityText(line)}
                      {line.basis !== "PERCENT_OF_SUBTOTAL" && (
                        <>
                          {" × "}
                          <Rate line={line} />
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>

              {/* md+: a proper table. */}
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">{BUCKET_LABELS[bucket]} line items</caption>
                <thead>
                  <tr className="border-b border-ink-100 text-left text-xs text-ink-500">
                    <th scope="col" className="px-4 py-2 font-semibold">Item</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">Rate</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink-900">
                        {line.label}
                      </th>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-ink-700 tabular">
                        {quantityText(line)}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap text-ink-700">
                        <Rate line={line} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap text-ink-900">
                        <Money paise={line.amountPaise} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex items-baseline justify-between border-t border-ink-100 px-4 py-2.5 text-sm">
                <span className="font-semibold text-ink-700">{BUCKET_LABELS[bucket]} subtotal</span>
                <Money paise={bucketTotal(estimate, bucket)} className="font-bold text-ink-900" />
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
