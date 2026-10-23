import Link from "next/link";
import { ChevronRight, HardHat, MapPin } from "lucide-react";
import { listWorkers, TRADE_LABELS, TRADE_ORDER } from "@/server/services/worker.service";
import { listAddresses } from "@/server/services/address.service";
import { getPageActor } from "@/server/auth/page-session";
import { WorkerCard } from "@/components/labour/WorkerCard";
import { TRADE_META } from "@/components/labour/trade-meta";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, SectionHeader } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { TabLinks } from "@/components/ui/Segmented";
import { cn } from "@/lib/cn";
import type { Trade } from "@prisma/client";

export const metadata = { title: "Hire labour" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    trade?: string;
    availableToday?: string;
    sort?: string;
    /** Listing tab: absent = All, "near" = Near you, "top" = Top rated. */
    view?: string;
    lat?: string;
    lng?: string;
  }>;
}

/** "Top rated" floor. listWorkers already sorts by rating; this trims the tail. */
const TOP_RATED_MIN = 4;

function isTrade(value: string | undefined): value is Trade {
  return !!value && (TRADE_ORDER as string[]).includes(value);
}

/**
 * Worker discovery.
 *
 * With no filter this is the "Find Skilled Labour" category screen; with a
 * trade (or any filter) it becomes the worker listing. Filters live in the URL
 * rather than component state so the page stays a Server Component and a
 * filtered view is shareable — a contractor can send "electricians available
 * today" to a colleague as a link.
 */
export default async function LabourPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const trade = isTrade(params.trade) ? params.trade : undefined;

  const isListing = !!trade || !!params.availableToday || !!params.sort || !!params.view;
  if (!isListing) return <CategoriesView />;

  return <ListingView params={params} trade={trade} />;
}

async function CategoriesView() {
  // Prefer workers who can come today; fall back to the best-rated so the
  // section is never empty on a quiet day.
  const today = await listWorkers({ availableToday: true, verifiedOnly: true, perPage: 6 });
  const workers =
    today.items.length > 0
      ? today
      : await listWorkers({ verifiedOnly: true, sort: "rating", perPage: 6 });
  const showingToday = today.items.length > 0;

  return (
    <div className="pb-8">
      <PageHeader
        title="Find Skilled Labour"
        subtitle="Verified professionals for your project"
      />

      <section aria-label="Trades" className="px-4 pt-4 md:px-0 md:pt-0">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          {TRADE_ORDER.map((option) => {
            const meta = TRADE_META[option];
            const Icon = meta.icon;
            return (
              <li key={option}>
                <Link
                  href={`/labour?trade=${option}`}
                  className="flex h-full flex-col items-center gap-2.5 rounded-(--radius-card) border border-ink-100 bg-white px-3 py-4 text-center shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)"
                >
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-2xl",
                      meta.tint,
                    )}
                  >
                    <Icon aria-hidden className="size-7" strokeWidth={1.75} />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-ink-900">
                      {TRADE_LABELS[option]}
                    </span>
                    <span className="block text-xs text-ink-500">{meta.subtitle}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {workers.items.length > 0 && (
        <section className="pt-8">
          <SectionHeader
            title={showingToday ? "Available today" : "Top rated workers"}
            action="View all"
            href={showingToday ? "/labour?availableToday=1" : "/labour?view=top"}
          />
          <ul className="grid gap-3 px-4 md:grid-cols-2 md:px-0 lg:grid-cols-3">
            {workers.items.map((worker) => (
              <li key={worker.id}>
                <WorkerCard worker={worker} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

async function ListingView({
  params,
  trade,
}: {
  params: Awaited<PageProps["searchParams"]>;
  trade: Trade | undefined;
}) {
  const { availableToday, sort, view } = params;
  const availableOnly = availableToday === "1";

  // "Near you" needs an origin. Explicit coordinates win; otherwise we narrow to
  // the city of the customer's default address, since saved addresses do not
  // expose coordinates to pages.
  let origin: { lat: number; lng: number } | undefined;
  let nearCity: string | undefined;
  let nearNote: string | null = null;

  if (view === "near") {
    const lat = Number(params.lat);
    const lng = Number(params.lng);
    if (params.lat && params.lng && Number.isFinite(lat) && Number.isFinite(lng)) {
      origin = { lat, lng };
    } else {
      const actor = await getPageActor();
      const addresses = actor ? await listAddresses(actor.userId) : [];
      const home = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (home) {
        nearCity = home.city;
        nearNote = `Showing workers based in ${home.city}, near your saved address.`;
      } else {
        nearNote = actor
          ? "Add a saved address to see workers near you."
          : "Sign in and save an address to see workers near you.";
      }
    }
  }

  const listingSort: "rating" | "distance" | "experience" | "price_asc" =
    view === "near"
      ? origin
        ? "distance"
        : "rating"
      : view === "top"
        ? "rating"
        : ((sort as "rating" | "experience" | "price_asc") ?? "rating");

  const baseFilters = {
    trade,
    availableToday: availableOnly,
    verifiedOnly: true,
    sort: listingSort,
    perPage: 50,
    ...(origin ?? {}),
    ...(view === "top" ? { minRating: TOP_RATED_MIN } : {}),
  };

  let workers = await listWorkers({ ...baseFilters, city: nearCity });

  // A city with no matching workers yet should not look like a broken filter.
  if (nearCity && workers.items.length === 0) {
    workers = await listWorkers(baseFilters);
    nearNote = `No workers based in ${nearCity} yet — showing everyone who serves the area.`;
  }

  const buildHref = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    const merged = {
      trade,
      availableToday,
      sort,
      view,
      lat: params.lat,
      lng: params.lng,
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `/labour?${qs}` : "/labour";
  };

  const title = trade
    ? TRADE_META[trade].plural
    : availableOnly
      ? "Available today"
      : "All workers";

  const tabs = [
    { label: "All", href: buildHref({ view: undefined }), active: !view },
    {
      label: "Near you",
      href: buildHref({ view: "near", sort: undefined }),
      active: view === "near",
    },
    {
      label: "Top rated",
      href: buildHref({ view: "top", sort: undefined }),
      active: view === "top",
    },
  ];

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold",
      active
        ? "border-brand-600 bg-brand-50 text-brand-700"
        : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
    );

  return (
    <div className="pb-8">
      <PageHeader
        title={title}
        subtitle={`${workers.total} verified ${workers.total === 1 ? "worker" : "workers"}`}
        backHref="/labour"
      >
        <TabLinks tabs={tabs} />

        {/* Secondary filters the listing already supported. */}
        <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto">
          <Link
            href={buildHref({ availableToday: availableOnly ? undefined : "1" })}
            className={chipClass(availableOnly)}
            aria-pressed={availableOnly}
          >
            Available today
          </Link>
          {!view &&
            [
              { key: "experience", label: "Most experienced" },
              { key: "price_asc", label: "Lowest rate" },
            ].map((option) => {
              const active = sort === option.key;
              return (
                <Link
                  key={option.key}
                  href={buildHref({ sort: active ? undefined : option.key })}
                  className={chipClass(active)}
                  aria-pressed={active}
                >
                  {option.label}
                </Link>
              );
            })}
        </div>
      </PageHeader>

      {nearNote && (
        <p className="mx-4 mt-3 flex items-start gap-2 rounded-xl bg-ink-50 px-3 py-2.5 text-xs text-ink-600 md:mx-0 md:mt-0 md:mb-4">
          <MapPin aria-hidden className="mt-px size-3.5 shrink-0 text-ink-400" />
          <span className="flex-1">{nearNote}</span>
          {nearNote.startsWith("Add") && (
            <Link
              href="/account/addresses"
              className="inline-flex items-center font-semibold text-brand-700"
            >
              Add <ChevronRight aria-hidden className="size-3.5" />
            </Link>
          )}
        </p>
      )}

      {workers.items.length === 0 ? (
        <EmptyState
          icon={<HardHat aria-hidden className="size-7" />}
          title="No workers match"
          description="Try a different trade, or clear the availability filter."
          action={
            <ButtonLink href={trade ? `/labour?trade=${trade}` : "/labour"} variant="outline">
              Clear filters
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-3 p-4 md:grid-cols-2 md:p-0 lg:grid-cols-3">
          {workers.items.map((worker) => (
            <li key={worker.id}>
              <WorkerCard worker={worker} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
