import { notFound } from "next/navigation";
import { getWorkerById } from "@/server/services/worker.service";
import { getAvailability } from "@/server/services/availability.service";
import { getCurrentUser } from "@/server/services/auth.service";
import { listAddresses } from "@/server/services/address.service";
import { requirePageActor } from "@/server/auth/page-session";
import { BookingForm } from "@/components/labour/BookingForm";
import { env } from "@/server/env";

export const metadata = { title: "Book a worker" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

/**
 * Same 30-day window as the profile calendar, so a day picked there is always
 * offered here. The server re-checks working hours over the same window.
 */
const BOOKING_WINDOW_DAYS = 30;

export default async function BookWorkerPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { date } = await searchParams;
  const actor = await requirePageActor(
    `/labour/${id}/book${date ? `?date=${encodeURIComponent(date)}` : ""}`,
  );

  let worker;
  try {
    worker = await getWorkerById(id);
  } catch {
    notFound();
  }

  const [availability, user, addresses] = await Promise.all([
    getAvailability(id, BOOKING_WINDOW_DAYS),
    getCurrentUser(actor.userId),
    listAddresses(actor.userId),
  ]);

  return (
    <BookingForm
      worker={{
        id: worker.id,
        displayName: worker.displayName,
        photoUrl: worker.photoUrl,
        skills: worker.skills.map((skill) => skill.trade),
        rates: worker.rates.map((rate) => ({
          trade: rate.trade,
          rateType: rate.rateType,
          amountPaise: rate.amountPaise,
          minUnits: rate.minUnits,
        })),
      }}
      availability={availability}
      addresses={addresses}
      addressDefaults={{
        contactName: user.name ?? undefined,
        contactPhone: user.phone,
        city: worker.baseCity,
      }}
      initialDate={date}
      platformFeePercent={env.LABOUR_COMMISSION_PERCENT}
    />
  );
}
