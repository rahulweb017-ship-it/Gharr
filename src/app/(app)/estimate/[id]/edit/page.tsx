import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { EstimateWizard } from "@/components/estimate/EstimateWizard";
import { requirePageActor } from "@/server/auth/page-session";
import { POPULAR_CITIES } from "@/server/city";
import { NotFoundError } from "@/server/http/errors";
import { getEstimate, listEstimateCities } from "@/server/services/estimate.service";

export const metadata = { title: "Edit estimate" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Edit reuses the wizard with the saved inputs. Saving re-runs the engine with
 * today's prices, so the result may move even if no input changed.
 */
export default async function EditEstimatePage({ params }: PageProps) {
  const { id } = await params;
  const actor = await requirePageActor(`/estimate/${id}/edit`);

  let estimate;
  try {
    estimate = await getEstimate(actor.userId, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const cities = await listEstimateCities();

  return (
    <>
      <PageHeader title="Edit Estimate" subtitle={estimate.title} backHref={`/estimate/${id}`} />
      <EstimateWizard
        signedIn
        cities={cities}
        unavailableCities={[...POPULAR_CITIES]}
        defaultCity={estimate.city}
        estimateId={estimate.id}
        initial={estimate.inputs}
      />
    </>
  );
}
