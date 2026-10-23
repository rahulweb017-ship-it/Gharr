import { z } from "zod";

/**
 * Support-ticket contract, shared by the customer API, the admin API and the
 * web forms (and later the React Native app).
 */

export const TICKET_CATEGORIES = ["ORDER", "BOOKING", "PAYMENT", "ACCOUNT", "OTHER"] as const;
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  ORDER: "Materials order",
  BOOKING: "Labour booking",
  PAYMENT: "Payment or refund",
  ACCOUNT: "My account",
  OTHER: "Something else",
};

const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v ? v : undefined));

export const CreateTicketInput = z.object({
  subject: z.string().trim().min(4, "Add a short subject").max(120),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(4000),
  category: z.enum(TICKET_CATEGORIES).default("OTHER"),
  orderId: optionalId,
  bookingId: optionalId,
});
export type CreateTicketInput = z.infer<typeof CreateTicketInput>;

export const TicketReplyInput = z.object({
  body: z.string().trim().min(1, "Write a reply").max(4000),
});
export type TicketReplyInput = z.infer<typeof TicketReplyInput>;

/** Staff-side changes. Every field is optional; at least one must be set. */
export const TicketUpdateInput = z
  .object({
    status: z.enum(TICKET_STATUSES).optional(),
    priority: z.enum(TICKET_PRIORITIES).optional(),
    /** A staff user id, or null to unassign. */
    assignedToId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined || v.assignedToId !== undefined, {
    message: "Nothing to change",
  });
export type TicketUpdateInput = z.infer<typeof TicketUpdateInput>;

// ---------------------------------------------------------------------------
// Ticket rules — pure, shared by the service and its tests.
// ---------------------------------------------------------------------------

export type TicketStatusValue = (typeof TICKET_STATUSES)[number];

/**
 * A customer replying to a resolved ticket means it is not resolved: it goes
 * back to OPEN so it re-enters the queue. CLOSED is final — the customer is
 * asked to raise a new ticket instead.
 */
export function statusAfterCustomerReply(status: TicketStatusValue): TicketStatusValue {
  return status === "RESOLVED" ? "OPEN" : status;
}

/** A staff reply picks the ticket up if nobody had yet. */
export function statusAfterStaffReply(status: TicketStatusValue): TicketStatusValue {
  return status === "OPEN" ? "IN_PROGRESS" : status;
}

/**
 * `resolvedAt` records when the customer's problem was solved: set on the first
 * move to RESOLVED/CLOSED, kept through RESOLVED → CLOSED, cleared on reopen.
 */
export function resolvedAtFor(
  next: TicketStatusValue,
  current: Date | null,
  now: Date,
): Date | null {
  if (next === "RESOLVED" || next === "CLOSED") return current ?? now;
  return null;
}

/** SLA hint for the queue: how long an unresolved ticket has been waiting. */
export function ticketAge(createdAt: Date, now: Date): { label: string; tone: "neutral" | "warning" | "danger" } {
  const hours = Math.max(0, (now.getTime() - createdAt.getTime()) / 3_600_000);
  const label = hours < 1 ? `${Math.max(1, Math.round(hours * 60))}m` : hours < 48 ? `${Math.floor(hours)}h` : `${Math.floor(hours / 24)}d`;
  const tone = hours >= 48 ? "danger" : hours >= 24 ? "warning" : "neutral";
  return { label, tone };
}
