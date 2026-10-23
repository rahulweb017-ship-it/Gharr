import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, House, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Card, EmptyState } from "@/components/ui/Surface";
import { BoqList } from "@/components/estimate/BoqList";
import { requirePageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getBoq } from "@/server/services/estimate.service";

export const metadata = { title: "Material List (BOQ)" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Material list generated from an estimate. Offers are resolved fresh on every
 * visit, so stock and prices are today's, not the estimate's.
 */
export default async function BoqPage({ params }: PageProps) {
  const { id } = await params;
  const actor = await requirePageActor(`/estimate/${id}/boq`);

  let boq;
  try {
    boq = await getBoq(actor.userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="md:mx-auto md:max-w-3xl md:pb-8">
      <PageHeader title="Material List (BOQ)" backHref={`/estimate/${id}`} />

      <div className="px-4 pt-4 pb-3 md:px-0 md:pt-0">
        <Card className="flex items-center gap-3.5 p-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-50 to-brand-100 text-brand-600">
            <House aria-hidden className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink-900">{boq.title}</p>
            <p className="flex items-center gap-1 text-xs text-ink-500">
              <MapPin aria-hidden className="size-3.5" />
              {boq.city}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-400">Auto-generated from your estimate</p>
          </div>
          <Link
            href={`/estimate/${id}/edit`}
            className="shrink-0 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
          >
            Edit Estimate
          </Link>
        </Card>
      </div>

      {boq.items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-7" />}
          title="No materials to buy yet"
          description="This estimate has no materials we can match to products in your city right now."
          action={<ButtonLink href={`/estimate/${id}`} variant="secondary">Back to estimate</ButtonLink>}
        />
      ) : (
        <BoqList boq={boq} />
      )}
    </div>
  );
}
