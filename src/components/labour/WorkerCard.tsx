import Image from "next/image";
import Link from "next/link";
import { MapPin, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink } from "@/components/ui/Button";
import { Money } from "@/components/ui/Money";
import { RatingStars } from "@/components/ui/RatingStars";
import { AvailableTodayChip, VerifiedChip } from "@/components/ui/Chip";
import { TRADE_LABELS } from "@/shared/trades";
import type { WorkerListItem } from "@/server/services/worker.service";

/**
 * Worker card.
 *
 * Hiring a stranger to work inside your home is a trust decision, so the card
 * leads with the signals that support it — verification, rating and years of
 * experience — before it shows price.
 */

/** Round avatar with a neutral silhouette when the worker has no photo. */
export function WorkerAvatar({
  photoUrl,
  size,
  className,
  priority,
}: {
  photoUrl: string | null;
  /** Pixel size, used for both the box and the image `sizes` hint. */
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-100 text-ink-300",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <UserRound aria-hidden className="size-1/2" />
      )}
    </span>
  );
}

/**
 * The headline rate. Day rates are what customers compare in the boards, so a
 * DAILY rate wins; otherwise the hourly rate is shown with its own unit.
 */
function HeadlineRate({ worker }: { worker: WorkerListItem }) {
  const paise = worker.dailyRatePaise ?? worker.hourlyRatePaise;

  if (paise == null) {
    return worker.acceptsFixedPrice ? (
      <span className="text-sm font-semibold text-ink-700">Fixed-price quotes</span>
    ) : null;
  }

  return (
    <span className="text-ink-900">
      <Money paise={paise} className="text-base font-bold" />
      <span className="ml-1 text-xs font-medium text-ink-500">
        / {worker.dailyRatePaise != null ? "day" : "hour"}
      </span>
    </span>
  );
}

export function WorkerCard({
  worker,
  className,
}: {
  worker: WorkerListItem;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-(--radius-card) border border-ink-100 bg-white p-3.5",
        "shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)",
        className,
      )}
    >
      {/* Body and CTA are sibling links — a link inside a link is invalid HTML. */}
      <Link href={`/labour/${worker.id}`} className="flex flex-1 gap-3">
        <WorkerAvatar photoUrl={worker.photoUrl} size={64} />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="truncate text-[15px] font-bold text-ink-900">
            {worker.displayName}
          </h3>
          {worker.primaryTrade && (
            <p className="text-xs font-semibold text-ink-500">
              {TRADE_LABELS[worker.primaryTrade]}
              {worker.trades.length > 1 && (
                <span className="font-medium text-ink-400">
                  {" "}
                  +{worker.trades.length - 1} more
                </span>
              )}
            </p>
          )}

          {worker.ratingCount > 0 ? (
            <RatingStars rating={worker.ratingAvg} count={worker.ratingCount} />
          ) : (
            <span className="text-xs text-ink-400">New on Gharr</span>
          )}

          <p className="flex min-w-0 items-center gap-1 text-xs text-ink-500">
            <MapPin aria-hidden className="size-3 shrink-0" />
            <span className="truncate">
              {worker.baseCity}
              {worker.distanceKm != null && ` (${worker.distanceKm} km)`}
              {" · "}
              {worker.yearsExperience} {worker.yearsExperience === 1 ? "year" : "years"} exp.
            </span>
          </p>

          {(worker.isVerified || worker.isAvailableToday) && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {worker.isVerified && <VerifiedChip />}
              {worker.isAvailableToday && <AvailableTodayChip />}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-ink-100 pt-3">
        <HeadlineRate worker={worker} />
        <ButtonLink href={`/labour/${worker.id}/book`} size="sm" className="h-10 px-4">
          Book Now
        </ButtonLink>
      </div>
    </article>
  );
}

/** Compact horizontal rail for the Home screen. */
export function WorkerRail({ workers }: { workers: WorkerListItem[] }) {
  if (workers.length === 0) return null;

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1 md:px-0">
      {workers.map((worker) => {
        const paise = worker.dailyRatePaise ?? worker.hourlyRatePaise;
        return (
          <Link
            key={worker.id}
            href={`/labour/${worker.id}`}
            className="flex w-[148px] shrink-0 flex-col items-center gap-2 rounded-(--radius-card) border border-ink-100 bg-white p-3 text-center shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-raised)"
          >
            <WorkerAvatar photoUrl={worker.photoUrl} size={64} />

            <div className="w-full min-w-0">
              <p className="truncate text-[13px] font-bold text-ink-900">
                {worker.displayName}
              </p>
              {worker.primaryTrade && (
                <p className="truncate text-[11px] font-semibold text-ink-500">
                  {TRADE_LABELS[worker.primaryTrade]}
                </p>
              )}
            </div>

            {worker.ratingCount > 0 && (
              <RatingStars rating={worker.ratingAvg} count={worker.ratingCount} />
            )}

            {paise != null && (
              <span className="text-[13px] font-bold text-ink-900">
                <Money paise={paise} />
                <span className="text-[11px] font-medium text-ink-400">
                  /{worker.dailyRatePaise != null ? "day" : "hr"}
                </span>
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
