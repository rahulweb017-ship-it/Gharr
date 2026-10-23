import { PageHeader } from "@/components/layout/PageHeader";
import { LocationPicker } from "@/components/account/LocationPicker";
import { getSelectedCity, LIVE_CITIES, POPULAR_CITIES } from "@/server/city";

export const metadata = { title: "Set your location" };

/**
 * City selection — prices, vendors and workers are all local, so the city is
 * the first thing that changes what a customer sees.
 */
export default async function LocationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [{ next }, city] = await Promise.all([searchParams, getSelectedCity()]);

  return (
    <div className="md:mx-auto md:max-w-xl">
      <PageHeader title="Set your location" backHref={next && next.startsWith("/") ? next : "/"} />
      <LocationPicker
        current={city}
        liveCities={[...LIVE_CITIES]}
        popularCities={[...POPULAR_CITIES]}
        next={next ?? "/"}
      />
    </div>
  );
}
