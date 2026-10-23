import type { Prisma, Trade } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { NotFoundError } from "@/server/http/errors";

/**
 * Worker discovery — the labour half of the marketplace and the feature neither
 * HomeRun nor Housie offers.
 *
 * Distance uses a bounding-box prefilter in SQL followed by an exact haversine
 * in application code. PostGIS would be the textbook answer, but it is another
 * extension to install and operate, and at single-city scale with a few thousand
 * workers this is both fast and exact enough.
 */

export interface WorkerFilters {
  trade?: Trade;
  /** Customer location; when supplied, results are distance-filtered and sorted. */
  lat?: number;
  lng?: number;
  pincode?: string;
  city?: string;
  availableToday?: boolean;
  verifiedOnly?: boolean;
  minRating?: number;
  rateType?: "HOURLY" | "DAILY" | "FIXED";
  maxRatePaise?: number;
  sort?: "rating" | "distance" | "experience" | "price_asc";
  page?: number;
  perPage?: number;
}

export interface WorkerListItem {
  id: string;
  displayName: string;
  photoUrl: string | null;
  primaryTrade: Trade | null;
  trades: Trade[];
  yearsExperience: number;
  completedJobs: number;
  ratingAvg: number;
  ratingCount: number;
  isVerified: boolean;
  isAvailableToday: boolean;
  baseCity: string;
  serviceRadiusKm: number;
  distanceKm: number | null;
  hourlyRatePaise: number | null;
  dailyRatePaise: number | null;
  acceptsFixedPrice: boolean;
}

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance. Accurate to well under a percent at city scale. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const WORKER_SELECT = {
  id: true,
  displayName: true,
  photoUrl: true,
  yearsExperience: true,
  completedJobs: true,
  ratingAvg: true,
  ratingCount: true,
  idVerificationStatus: true,
  isAvailableToday: true,
  baseCity: true,
  baseLat: true,
  baseLng: true,
  serviceRadiusKm: true,
  acceptsFixedPrice: true,
  skills: {
    select: { trade: true, isPrimary: true, yearsExperience: true },
    orderBy: { isPrimary: "desc" },
  },
  rates: {
    where: { isActive: true },
    select: { trade: true, rateType: true, amountPaise: true, minUnits: true },
  },
} satisfies Prisma.WorkerSelect;

type WorkerRow = Prisma.WorkerGetPayload<{ select: typeof WORKER_SELECT }>;

function toListItem(
  worker: WorkerRow,
  origin?: { lat: number; lng: number },
): WorkerListItem {
  const hourly = worker.rates.find((r) => r.rateType === "HOURLY");
  const daily = worker.rates.find((r) => r.rateType === "DAILY");
  const primary = worker.skills.find((s) => s.isPrimary) ?? worker.skills[0];

  return {
    id: worker.id,
    displayName: worker.displayName,
    photoUrl: worker.photoUrl,
    primaryTrade: primary?.trade ?? null,
    trades: worker.skills.map((s) => s.trade),
    yearsExperience: worker.yearsExperience,
    completedJobs: worker.completedJobs,
    ratingAvg: Number(worker.ratingAvg),
    ratingCount: worker.ratingCount,
    isVerified: worker.idVerificationStatus === "VERIFIED",
    isAvailableToday: worker.isAvailableToday,
    baseCity: worker.baseCity,
    serviceRadiusKm: worker.serviceRadiusKm,
    distanceKm: origin
      ? Number(
          haversineKm(origin.lat, origin.lng, worker.baseLat, worker.baseLng).toFixed(1),
        )
      : null,
    hourlyRatePaise: hourly?.amountPaise ?? null,
    dailyRatePaise: daily?.amountPaise ?? null,
    acceptsFixedPrice: worker.acceptsFixedPrice,
  };
}

export async function listWorkers(filters: WorkerFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(50, Math.max(1, filters.perPage ?? 20));

  const where: Prisma.WorkerWhereInput = {
    isActive: true,
    ...(filters.verifiedOnly ? { idVerificationStatus: "VERIFIED" } : {}),
    ...(filters.availableToday ? { isAvailableToday: true } : {}),
    ...(filters.city ? { baseCity: filters.city } : {}),
    ...(filters.minRating ? { ratingAvg: { gte: filters.minRating } } : {}),
    ...(filters.trade ? { skills: { some: { trade: filters.trade } } } : {}),
    ...(filters.rateType || filters.maxRatePaise
      ? {
          rates: {
            some: {
              isActive: true,
              ...(filters.rateType ? { rateType: filters.rateType } : {}),
              ...(filters.maxRatePaise
                ? { amountPaise: { lte: filters.maxRatePaise } }
                : {}),
            },
          },
        }
      : {}),
  };

  // Bounding box prefilter: cheap in SQL, and the exact haversine below removes
  // the corners the box wrongly includes.
  const origin =
    filters.lat != null && filters.lng != null
      ? { lat: filters.lat, lng: filters.lng }
      : undefined;

  if (origin) {
    // 60 km box comfortably covers the largest service radius in the data.
    const degLat = 60 / 111;
    const degLng = 60 / (111 * Math.cos((origin.lat * Math.PI) / 180));
    where.baseLat = { gte: origin.lat - degLat, lte: origin.lat + degLat };
    where.baseLng = { gte: origin.lng - degLng, lte: origin.lng + degLng };
  }

  const rows = await prisma.worker.findMany({
    where,
    select: WORKER_SELECT,
    orderBy:
      filters.sort === "experience"
        ? [{ yearsExperience: "desc" }]
        : [{ ratingAvg: "desc" }, { completedJobs: "desc" }],
  });

  let items = rows.map((row) => toListItem(row, origin));

  // Exact distance filter: a worker is shown only if the customer is inside the
  // radius that worker actually travels.
  if (origin) {
    items = items.filter(
      (item) => item.distanceKm != null && item.distanceKm <= item.serviceRadiusKm,
    );
  }

  if (filters.sort === "distance" && origin) {
    items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  } else if (filters.sort === "price_asc") {
    items.sort(
      (a, b) => (a.hourlyRatePaise ?? Infinity) - (b.hourlyRatePaise ?? Infinity),
    );
  }

  const total = items.length;

  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getWorkerById(id: string) {
  const worker = await prisma.worker.findFirst({
    where: { id, isActive: true },
    select: {
      ...WORKER_SELECT,
      bio: true,
      basePincode: true,
      phoneVerifiedAt: true,
      lastActiveAt: true,
      availability: {
        select: { dayOfWeek: true, startMinute: true, endMinute: true },
        orderBy: { dayOfWeek: "asc" },
      },
      reviews: {
        where: { status: "PUBLISHED" },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!worker) throw new NotFoundError("Worker");

  return {
    ...toListItem(worker),
    bio: worker.bio,
    basePincode: worker.basePincode,
    isPhoneVerified: worker.phoneVerifiedAt != null,
    lastActiveAt: worker.lastActiveAt,
    skills: worker.skills,
    rates: worker.rates.map((rate) => ({
      ...rate,
      minUnits: Number(rate.minUnits),
    })),
    availability: worker.availability,
    reviews: worker.reviews.map((review) => ({
      ...review,
      authorName: review.author.name ?? "Gharr customer",
    })),
  };
}

export type WorkerDetail = Awaited<ReturnType<typeof getWorkerById>>;

// Trade labels live in shared/ so client components can render them without
// pulling Prisma into the browser bundle.
export { TRADE_LABELS, TRADE_ORDER } from "@/shared/trades";
