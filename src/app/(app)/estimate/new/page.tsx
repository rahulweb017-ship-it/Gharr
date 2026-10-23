import { PageHeader } from "@/components/layout/PageHeader";
import { EstimateWizard } from "@/components/estimate/EstimateWizard";
import { getPageActor } from "@/server/auth/page-session";
import { POPULAR_CITIES, getSelectedCity } from "@/server/city";
import { listEstimateCities } from "@/server/services/estimate.service";

export const metadata = { title: "New estimate" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ mode?: string; resume?: string }>;
}

/**
 * Estimate wizard. Open to everyone — a signed-out visitor can reach a live
 * preview, and is only asked to sign in when they choose to save.
 */
export default async function NewEstimatePage({ searchParams }: PageProps) {
  const { mode, resume } = await searchParams;
  const [actor, cities, selectedCity] = await Promise.all([
    getPageActor(),
    listEstimateCities(),
    getSelectedCity(),
  ]);

  // Default to the customer's chosen city only if we can actually price it.
  const defaultCity = cities.includes(selectedCity) ? selectedCity : (cities[0] ?? selectedCity);

  return (
    <>
      <PageHeader title="Get an Estimate" backHref="/estimate" />
      <EstimateWizard
        signedIn={Boolean(actor)}
        cities={cities}
        unavailableCities={[...POPULAR_CITIES]}
        defaultCity={defaultCity}
        initialMode={mode === "RENOVATION" ? "RENOVATION" : "NEW_BUILD"}
        resume={resume === "1"}
      />
    </>
  );
}
