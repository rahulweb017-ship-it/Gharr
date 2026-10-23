import type { TicketStatus } from "@prisma/client";

/** Ticket status labels and chip tones, shared by the customer and admin views. */

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function ticketTone(status: TicketStatus) {
  if (status === "OPEN") return "warning" as const;
  if (status === "IN_PROGRESS") return "info" as const;
  // Green is reserved for success — a solved problem qualifies.
  if (status === "RESOLVED") return "trust" as const;
  return "neutral" as const;
}

export function priorityTone(priority: string) {
  if (priority === "URGENT") return "danger" as const;
  if (priority === "HIGH") return "warning" as const;
  return "neutral" as const;
}
