import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { BadgeCheck, Clock3, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { getWorkerById, TRADE_LABELS } from "@/server/services/worker.service";
import { getAvailability } from "@/server/services/availability.service";
import { AvailableTodayChip, Chip, VerifiedChip } from "@/components/ui/Chip";
import { ButtonLink } from "@/components/ui/Button";
import { Card, StickyBar } from "@/components/ui/Surface";
import { Money } from "@/components/ui/Money";
import { RatingStars } from "@/components/ui/RatingStars";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkerAvatar } from "@/components/labour/WorkerCard";
import { AvailabilityCalendar } from "@/components/labour/AvailabilityCalendar";
import { cn } from "@/lib/cn";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  try {
    const worker = await getWorkerById(id);
    return { title: worker.displayName };
  } catch {
    return { title: "Worker" };
  }
}

/** The booking window the API accepts (availability route caps at 30 days). */
const AVAILABILITY_DAYS = 30;

/**
 * Worker profile.
 *
 * Leads with trust — verification, rating, years of experience — then rates,
 * then real availability. Someone deciding whether to let a stranger into their
 * home needs the evidence before the price.
 */
export default async function WorkerProfilePage({ params }: PageProps) {
  const { id } = await params;

  let worker;
  try {
    worker = await getWorkerById(id);
  } catch {
    notFound();
  }

  const availability = await getAvailability(id, AVAILABILITY_DAYS);

  const headlinePaise = worker.dailyRatePaise ?? worker.hourlyRatePaise;
  const headlineUnit = worker.dailyRatePaise != null ? "per day" : "per hour";
  const visibleRates = worker.rates.filter((rate) => rate.rateType !== "FIXED");
  const bookHref = `/labour/${worker.id}/book`;

  return (
    <div className="pb-32 md:pb-8">
      <PageHeader title="Worker Profile" backHref="/labour" />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_340px] md:items-start md:gap-8">
        <div className="flex flex-col gap-4 px-4 pt-4 md:px-0 md:pt-0">
          {/* Identity */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <span className="relative">
                <WorkerAvatar photoUrl={worker.photoUrl} size={88} priority />
                {worker.isAvailableToday && (
                  <span
                    aria-hidden
                    className="absolute right-1 bottom-1 size-4 rounded-full border-2 border-white bg-trust-500"
                  />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-bold text-ink-900">
                  {worker.displayName}
                </h2>
                {worker.primaryTrade && (
                  <p className="text-sm font-semibold text-ink-500">
                    {TRADE_LABELS[worker.primaryTrade]}
                  </p>
                )}
                <div className="mt-1">
                  {worker.ratingCount > 0 ? (
                    <RatingStars
                      rating={worker.ratingAvg}
                      count={worker.ratingCount}
                      className="text-sm"
                    />
                  ) : (
                    <span className="text-xs text-ink-400">No reviews yet</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-ink-500">
                  <MapPin aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">
                    {worker.baseCity} {worker.basePincode}
                  </span>
                </p>
              </div>
            </div>

            {/* Skill chips */}
            <div className="mt-4 flex flex-wrap gap-2">
              {worker.skills.map((skill) => (
                <Chip key={skill.trade} tone={skill.isPrimary ? "brand" : "neutral"}>
                  {TRADE_LABELS[skill.trade]} · {skill.yearsExperience}y
                </Chip>
              ))}
              {worker.isAvailableToday && <AvailableTodayChip />}
            </div>

            {/* Stat trio */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <StatTile
                icon={<Wallet aria-hidden className="size-5 text-brand-600" />}
                value={headlinePaise != null ? <Money paise={headlinePaise} /> : "—"}
                label={headlinePaise != null ? headlineUnit : "rate on request"}
              />
              <StatTile
                icon={<Clock3 aria-hidden className="size-5 text-ink-600" />}
                value={`${worker.yearsExperience}${worker.yearsExperience > 0 ? "+" : ""} yrs`}
                label="experience"
              />
              <StatTile
                icon={
                  <ShieldCheck
                    aria-hidden
                    className={cn("size-5", worker.isVerified ? "text-trust-600" : "text-ink-300")}
                  />
                }
                value={worker.isVerified ? "Verified" : "Pending"}
                label="ID check"
                tone={worker.isVerified ? "trust" : "neutral"}
              />
            </div>
          </Card>

          {worker.bio && (
            <Card className="p-4">
              <h2 className="text-[15px] font-bold text-ink-900">About</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{worker.bio}</p>
            </Card>
          )}

          {/* Availability */}
          <Card className="p-4">
            <h2 className="text-[15px] font-bold text-ink-900">Availability</h2>
            <p className="text-xs text-ink-500">Next {AVAILABILITY_DAYS} days</p>
            <div className="mt-2">
              <AvailabilityCalendar workerId={worker.id} days={availability} />
            </div>
          </Card>

          {/* Rates */}
          {visibleRates.length > 0 && (
            <Card className="overflow-hidden">
              <h2 className="px-4 pt-4 pb-2 text-[15px] font-bold text-ink-900">Rates</h2>
              <ul className="divide-y divide-ink-100">
                {visibleRates.map((rate) => (
                  <li
                    key={`${rate.trade}-${rate.rateType}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  >
                    <span className="text-ink-600">
                      {TRADE_LABELS[rate.trade]} ·{" "}
                      {rate.rateType === "HOURLY" ? "Hourly" : "Full day"}
                      {rate.rateType === "HOURLY" && rate.minUnits > 1 && (
                        <span className="ml-1 text-xs text-ink-400">(min {rate.minUnits}h)</span>
                      )}
                    </span>
                    <span className="font-bold text-ink-900">
                      <Money paise={rate.amountPaise} />
                      <span className="text-xs font-medium text-ink-400">
                        {rate.rateType === "HOURLY" ? "/hr" : "/day"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-ink-100 px-4 py-2.5 text-xs text-ink-400">
                Rates exclude materials. A {env.LABOUR_COMMISSION_PERCENT}% platform fee is
                added at booking.
              </p>
            </Card>
          )}

          {/* Service area */}
          <Card className="p-4">
            <h2 className="text-[15px] font-bold text-ink-900">Service area</h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin aria-hidden className="size-4 shrink-0 text-ink-400" />
              Works within {worker.serviceRadiusKm} km of {worker.baseCity}{" "}
              {worker.basePincode}
            </p>
          </Card>

          {/* Reviews */}
          {worker.reviews.length > 0 && (
            <section>
              <h2 className="pb-2 text-[15px] font-bold text-ink-900">
                Reviews ({worker.ratingCount})
              </h2>
              <ul className="grid gap-2 lg:grid-cols-2">
                {worker.reviews.map((review) => (
                  <li key={review.id}>
                    <Card className="h-full p-3.5">
                      <div className="flex items-center gap-2">
                        <RatingStars rating={review.rating} />
                        <span className="text-xs font-semibold text-ink-700">
                          {review.authorName}
                        </span>
                      </div>
                      {review.body && (
                        <p className="mt-1 text-[13px] text-ink-600">{review.body}</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Booking CTA — sticky bar on phones, side card from md up. */}
        <aside className="md:sticky md:top-24">
          <StickyBar>
            <div className="flex items-center gap-3 md:flex-col md:items-stretch md:gap-4 md:rounded-(--radius-card) md:border md:border-ink-100 md:bg-white md:p-5 md:shadow-(--shadow-card)">
              <div className="shrink-0">
                <p className="text-xs text-ink-400">Rate</p>
                <p className="text-lg leading-tight font-bold text-ink-900 md:text-2xl">
                  {headlinePaise != null ? <Money paise={headlinePaise} /> : "On request"}
                  {headlinePaise != null && (
                    <span className="ml-1 text-xs font-medium text-ink-400">
                      / {worker.dailyRatePaise != null ? "day" : "hour"}
                    </span>
                  )}
                </p>
              </div>
              <p className="hidden text-xs leading-relaxed text-ink-500 md:block">
                Pick a date and time next. The worker confirms before anything is
                charged.
              </p>
              <ButtonLink href={bookHref} size="lg" fullWidth className="flex-1 md:flex-none">
                <BadgeCheck aria-hidden className="size-4" />
                Request Booking
              </ButtonLink>
              {worker.isVerified && (
                <div className="hidden md:block">
                  <VerifiedChip label="ID verified by Gharr" />
                </div>
              )}
            </div>
          </StickyBar>
        </aside>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  value,
  label,
  tone = "neutral",
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  tone?: "neutral" | "trust";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-center",
        tone === "trust" ? "border-trust-100 bg-trust-50/60" : "border-ink-100 bg-ink-50/50",
      )}
    >
      {icon}
      <p className="text-[15px] leading-tight font-bold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-500">{label}</p>
    </div>
  );
}
