/**
 * Delivery wording shared by listing, detail, cart and checkout.
 *
 * `leadTimeDays` is a single number per offer, so the copy states it plainly
 * ("Delivers in 2 days") rather than inventing a range the data cannot back.
 */

export type DeliveryMode = "STANDARD" | "SCHEDULED" | "PICKUP";

export function deliveryEta(leadTimeDays: number, mode: string = "STANDARD"): string {
  const days = Math.max(0, Math.round(leadTimeDays));
  if (mode === "PICKUP") {
    return days <= 0 ? "Ready for pickup today" : `Ready for pickup in ${plural(days, "day")}`;
  }
  if (days <= 0) return "Same-day delivery";
  return `Delivers in ${plural(days, "day")}`;
}

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  STANDARD: "Fast delivery",
  SCHEDULED: "Scheduled (truck)",
  PICKUP: "Pickup only",
};

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
