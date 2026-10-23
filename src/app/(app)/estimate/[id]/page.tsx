import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Hammer, House, Info, MapPin, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Surface";
import { Chip } from "@/components/ui/Chip";
import {
  CostBreakdown,
  ItemisedTable,
  TotalCard,
} from "@/components/estimate/EstimateBreakdown";
import { EstimateActions } from "@/components/estimate/EstimateActions";
import { formatDate, inputsSummary } from "@/components/estimate/estimate-format";
import { requirePageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getEstimate } from "@/server/services/estimate.service";
import { ESTIMATE_DISCLAIMER, SCOPE_LABELS, TIER_LABELS } from "@/shared/estimate";

export const metadata = { title: "Estimate Result" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Estimate result: the breakdown by bucket, the total, and — the point of the
 * whole feature — the itemised table that shows how every rupee was arrived at.
 * From here the materials become a buyable list (BOQ).
 */
export default async function EstimateResultPage({ params }: PageProps) {
  const { id } = await params;
  const actor = await requirePageActor(`/estimate/${id}`);

  let estimate;
  try {
    estimate = await getEstimate(actor.userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const ModeIcon = estimate.mode === "NEW_BUILD" ? House : Hammer;

  return (
    <div className="pb-8">
      <PageHeader
        title="Estimate Result"
        backHref="/estimate"
        actions={<EstimateActions id={estimate.id} title={estimate.title} />}
      />

      <div className="grid gap-6 px-4 pt-4 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-start md:px-0 md:pt-0 lg:gap-8">
        <div className="space-y-5 md:sticky md:top-24">
          <Card className="flex gap-3.5 p-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-50 to-brand-100 text-brand-600">
              <ModeIcon aria-hidden className="size-8" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base leading-snug font-bold break-words text-ink-900">{estimate.title}</h2>
                <Link
                  href={`/estimate/${estimate.id}/edit`}
                  className="-mt-1 -mr-1 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Edit
                </Link>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
                <MapPin aria-hidden className="size-3.5" />
                {estimate.city} · {SCOPE_LABELS[estimate.scope]}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-600">{inputsSummary(estimate.inputs)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Chip tone="brand">{TIER_LABELS[estimate.tier]} quality</Chip>
                <span className="text-[11px] text-ink-400">Priced {formatDate(estimate.updatedAt)}</span>
              </div>
            </div>
          </Card>

          <CostBreakdown estimate={estimate} />
          <TotalCard totalPaise={estimate.totalPaise} />

          <p className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-xs leading-relaxed text-blue-900">
            <Info aria-hidden className="size-4 shrink-0 text-blue-600" />
            {ESTIMATE_DISCLAIMER}
          </p>

          <div className="space-y-3">
            <ButtonLink href={`/estimate/${estimate.id}/boq`} fullWidth size="lg">
              <ClipboardList aria-hidden className="size-5" />
              View Detailed BOQ
            </ButtonLink>
            <ButtonLink href={`/estimate/${estimate.id}/boq`} variant="outline" fullWidth size="lg">
              <ShoppingCart aria-hidden className="size-5" />
              Add Materials to Cart
            </ButtonLink>
          </div>
        </div>

        <ItemisedTable estimate={estimate} />
      </div>
    </div>
  );
}
