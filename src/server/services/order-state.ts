import type { OrderStatus } from "@prisma/client";

/**
 * Order lifecycle, expressed as data rather than scattered conditionals.
 *
 * The blueprint's tracking flow is
 *   confirmed → accepted → packed → dispatched → out for delivery → delivered
 * with cancellation and returns layered on top.
 *
 * Declaring the machine as a table means every illegal transition is rejected by
 * one lookup, and the whole policy can be read — and unit-tested — in one place.
 */

/** SYSTEM covers webhook- and sweep-driven transitions with no human actor. */
export type TransitionRole =
  | "CUSTOMER"
  | "VENDOR"
  | "DELIVERY_PARTNER"
  | "ADMIN"
  | "SYSTEM";

export interface Transition {
  to: OrderStatus;
  roles: TransitionRole[];
  /** Human-readable label for ops consoles and timelines. */
  label: string;
}

export const ORDER_TRANSITIONS: Record<OrderStatus, Transition[]> = {
  PENDING_PAYMENT: [
    { to: "CONFIRMED", roles: ["SYSTEM", "ADMIN"], label: "Payment received" },
    { to: "CANCELLED", roles: ["CUSTOMER", "ADMIN", "SYSTEM"], label: "Cancel" },
  ],
  CONFIRMED: [
    { to: "ACCEPTED", roles: ["VENDOR", "ADMIN"], label: "Accept order" },
    { to: "CANCELLED", roles: ["CUSTOMER", "VENDOR", "ADMIN"], label: "Cancel" },
  ],
  ACCEPTED: [
    { to: "PACKED", roles: ["VENDOR", "ADMIN"], label: "Mark packed" },
    { to: "CANCELLED", roles: ["CUSTOMER", "VENDOR", "ADMIN"], label: "Cancel" },
  ],
  PACKED: [
    { to: "DISPATCHED", roles: ["VENDOR", "ADMIN"], label: "Dispatch" },
    { to: "CANCELLED", roles: ["VENDOR", "ADMIN"], label: "Cancel" },
  ],
  DISPATCHED: [
    {
      to: "OUT_FOR_DELIVERY",
      roles: ["DELIVERY_PARTNER", "VENDOR", "ADMIN"],
      label: "Out for delivery",
    },
  ],
  OUT_FOR_DELIVERY: [
    {
      to: "DELIVERED",
      roles: ["DELIVERY_PARTNER", "VENDOR", "ADMIN"],
      label: "Mark delivered",
    },
    {
      to: "DELIVERY_FAILED",
      roles: ["DELIVERY_PARTNER", "VENDOR", "ADMIN"],
      label: "Delivery failed",
    },
  ],
  DELIVERY_FAILED: [
    {
      to: "OUT_FOR_DELIVERY",
      roles: ["DELIVERY_PARTNER", "VENDOR", "ADMIN"],
      label: "Retry delivery",
    },
    { to: "CANCELLED", roles: ["ADMIN"], label: "Cancel" },
  ],
  DELIVERED: [
    { to: "RETURN_REQUESTED", roles: ["CUSTOMER"], label: "Request return" },
  ],
  RETURN_REQUESTED: [
    { to: "RETURNED", roles: ["VENDOR", "ADMIN"], label: "Accept return" },
    { to: "DELIVERED", roles: ["ADMIN"], label: "Reject return" },
  ],
  RETURNED: [
    { to: "REFUNDED", roles: ["SYSTEM", "ADMIN"], label: "Refund issued" },
  ],
  // Terminal states.
  CANCELLED: [],
  REFUNDED: [],
};

/** Statuses at which the goods have left the vendor and free cancellation ends. */
export const DISPATCH_POINT: OrderStatus[] = [
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
];

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: TransitionRole,
): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).some(
    (transition) => transition.to === to && transition.roles.includes(role),
  );
}

export function allowedTransitions(
  from: OrderStatus,
  role: TransitionRole,
): Transition[] {
  return (ORDER_TRANSITIONS[from] ?? []).filter((t) => t.roles.includes(role));
}

export function isTerminal(status: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[status] ?? []).length === 0;
}

/** Customer-facing copy for the tracking timeline. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Order confirmed",
  ACCEPTED: "Accepted by seller",
  PACKED: "Packed",
  DISPATCHED: "Dispatched",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  DELIVERY_FAILED: "Delivery attempt failed",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
  REFUNDED: "Refunded",
};

/** The happy path, in order, for rendering a progress tracker. */
export const ORDER_TIMELINE: OrderStatus[] = [
  "CONFIRMED",
  "ACCEPTED",
  "PACKED",
  "DISPATCHED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];
