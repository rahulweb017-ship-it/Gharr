import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { pageArgs, requireStaff, staffLevel } from "./admin/guard";
import {
  type CreateTicketInput,
  type TicketUpdateInput,
  resolvedAtFor,
  statusAfterCustomerReply,
  statusAfterStaffReply,
} from "@/shared/contracts/support";

/**
 * Support tickets — the customer's complaint thread and the staff queue.
 *
 * Customer functions are scoped to the owner (foreign ids are 404). Staff
 * functions go through `requireStaff(…, "SUPPORT")`: SUPPORT has full ticket
 * access, and every staff write is audit-logged in the same transaction.
 *
 * The ticket's opening text lives on `SupportTicket.message`; replies are
 * `TicketMessage` rows. Staff authors are shown to customers as "Gharr
 * Support", never by name — the team answers, not an individual.
 */

export const SUPPORT_AUTHOR_LABEL = "Gharr Support";

// ---------------------------------------------------------------------------
// Customer side
// ---------------------------------------------------------------------------

export async function createTicket(actor: Actor, input: CreateTicketInput) {
  const [order, booking] = await Promise.all([
    input.orderId
      ? prisma.order.findFirst({ where: { id: input.orderId, userId: actor.userId }, select: { id: true } })
      : null,
    input.bookingId
      ? prisma.labourBooking.findFirst({ where: { id: input.bookingId, userId: actor.userId }, select: { id: true } })
      : null,
  ]);
  if (input.orderId && !order) throw new NotFoundError("Order");
  if (input.bookingId && !booking) throw new NotFoundError("Booking");

  // A complaint raised from an order page is about that order even if the
  // customer left the category on the default.
  const category =
    input.category !== "OTHER" ? input.category : order ? "ORDER" : booking ? "BOOKING" : "OTHER";

  return prisma.supportTicket.create({
    data: {
      userId: actor.userId,
      subject: input.subject,
      message: input.message,
      category,
      orderId: order?.id ?? null,
      bookingId: booking?.id ?? null,
    },
    select: { id: true, subject: true, status: true, category: true, createdAt: true },
  });
}

export async function listMyTickets(userId: string) {
  const tickets = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      subject: true,
      category: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      messages: { where: { isStaff: true }, select: { id: true }, take: 1 },
    },
  });
  return tickets.map(({ messages, _count, ...t }) => ({
    ...t,
    replyCount: _count.messages,
    hasStaffReply: messages.length > 0,
  }));
}

/** The customer's recent orders and bookings, for the complaint form's "about" picker. */
export async function listLinkableRecords(userId: string) {
  const [orders, bookings] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      take: 20,
      select: { id: true, orderNumber: true, placedAt: true },
    }),
    prisma.labourBooking.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, bookingNumber: true, trade: true, scheduledDate: true },
    }),
  ]);
  return { orders, bookings };
}

export async function getMyTicket(userId: string, id: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) throw new NotFoundError("Ticket");

  const links = await linkedRecords(ticket.orderId, ticket.bookingId);
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    ...links,
    thread: [
      { id: `${ticket.id}-opening`, body: ticket.message, isStaff: false, createdAt: ticket.createdAt, author: "You" },
      ...ticket.messages.map((m) => ({
        id: m.id,
        body: m.body,
        isStaff: m.isStaff,
        createdAt: m.createdAt,
        author: m.isStaff ? SUPPORT_AUTHOR_LABEL : "You",
      })),
    ],
  };
}

export async function addCustomerMessage(actor: Actor, id: string, body: string) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id, userId: actor.userId },
    select: { id: true, status: true, resolvedAt: true },
  });
  if (!ticket) throw new NotFoundError("Ticket");
  if (ticket.status === "CLOSED") {
    throw new ConflictError("This ticket is closed. Raise a new complaint if you still need help.");
  }

  const status = statusAfterCustomerReply(ticket.status);
  return prisma.$transaction(async (tx) => {
    const message = await tx.ticketMessage.create({
      data: { ticketId: id, authorId: actor.userId, body, isStaff: false },
      select: { id: true, createdAt: true },
    });
    await tx.supportTicket.update({
      where: { id },
      data: { status, resolvedAt: resolvedAtFor(status, ticket.resolvedAt, new Date()) },
    });
    return { ...message, status };
  });
}

// ---------------------------------------------------------------------------
// Staff side
// ---------------------------------------------------------------------------

export interface TicketFilters {
  status?: TicketStatus;
  priority?: string;
  category?: string;
  /** "me" = assigned to the caller; "unassigned" = nobody. */
  assigned?: "me" | "unassigned";
  q?: string;
  page?: number;
  perPage?: number;
}

export async function listTickets(actor: Actor | null, filters: TicketFilters = {}) {
  const staff = await requireStaff(actor, "SUPPORT");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage);

  const where: Prisma.SupportTicketWhereInput = {
    ...(filters.status ? { status: filters.status } : { status: { in: ["OPEN", "IN_PROGRESS"] } }),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.assigned === "me" ? { assignedToId: staff.userId } : {}),
    ...(filters.assigned === "unassigned" ? { assignedToId: null } : {}),
  };
  const q = filters.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
      ...(digits.length >= 4 ? [{ user: { phoneE164: { contains: digits } } }] : []),
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      // Oldest first: the queue is worked in the order customers have waited.
      orderBy: [{ createdAt: "asc" }],
      skip,
      take,
      select: {
        id: true,
        subject: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resolvedAt: true,
        orderId: true,
        bookingId: true,
        user: { select: { id: true, name: true, phoneE164: true } },
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { rows, total, page, perPage, viewerId: staff.userId };
}

export async function getTicket(actor: Actor | null, id: string) {
  const staff = await requireStaff(actor, "SUPPORT");
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, phoneE164: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true } } },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Ticket");

  const [links, staffUsers] = await Promise.all([
    linkedRecords(ticket.orderId, ticket.bookingId),
    listStaffUsers(),
  ]);
  return { ...ticket, ...links, staffUsers, viewer: { id: staff.userId, level: staff.level } };
}

export async function staffReply(actor: Actor | null, id: string, body: string, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "SUPPORT");
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, userId: true, subject: true, status: true, assignedToId: true },
  });
  if (!ticket) throw new NotFoundError("Ticket");
  if (ticket.status === "CLOSED") throw new ConflictError("Reopen the ticket before replying");

  const status = statusAfterStaffReply(ticket.status);
  return prisma.$transaction(async (tx) => {
    const message = await tx.ticketMessage.create({
      data: { ticketId: id, authorId: staff.userId, body, isStaff: true },
      select: { id: true, createdAt: true },
    });
    await tx.supportTicket.update({
      where: { id },
      // Replying to an unowned ticket takes ownership of it.
      data: { status, assignedToId: ticket.assignedToId ?? staff.userId },
    });
    await tx.notification.create({
      data: {
        userId: ticket.userId,
        type: "support.reply",
        title: "Gharr Support replied",
        body: ticket.subject,
        data: { ticketId: id },
      },
    });
    await writeAudit(tx, {
      actor: staff,
      actorRole: staff.level,
      action: "ticket.reply",
      entityType: "SupportTicket",
      entityId: id,
      before: { status: ticket.status },
      after: { status, messageId: message.id, length: body.length },
      ...meta,
    });
    return { ...message, status };
  });
}

export async function updateTicket(
  actor: Actor | null,
  id: string,
  input: TicketUpdateInput,
  meta: RequestMeta = {},
) {
  const staff = await requireStaff(actor, "SUPPORT");
  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: { id: true, status: true, priority: true, assignedToId: true, resolvedAt: true },
  });
  if (!ticket) throw new NotFoundError("Ticket");

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId },
      select: { roles: true, isActive: true },
    });
    if (!assignee || !assignee.isActive || !staffLevel(assignee.roles)) {
      throw new ValidationError("Tickets can only be assigned to active staff", [
        { field: "assignedToId", message: "Not a staff member" },
      ]);
    }
  }

  const data: Prisma.SupportTicketUncheckedUpdateInput = {};
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.assignedToId !== undefined) data.assignedToId = input.assignedToId;
  if (input.status !== undefined) {
    data.status = input.status;
    data.resolvedAt = resolvedAtFor(input.status, ticket.resolvedAt, new Date());
  }

  return prisma.$transaction(async (tx) => {
    const after = await tx.supportTicket.update({
      where: { id },
      data,
      select: { id: true, status: true, priority: true, assignedToId: true, resolvedAt: true },
    });
    await writeAudit(tx, {
      actor: staff,
      actorRole: staff.level,
      action: "ticket.update",
      entityType: "SupportTicket",
      entityId: id,
      before: ticket,
      after,
      ...meta,
    });
    return after;
  });
}

/** Active staff for the assignee picker. */
export async function listStaffUsers() {
  return prisma.user.findMany({
    where: { isActive: true, roles: { hasSome: ["ADMIN", "SUPPORT"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, phoneE164: true, roles: true },
  });
}

/** Order/booking numbers for a ticket's links; the ids are plain columns. */
async function linkedRecords(orderId: string | null, bookingId: string | null) {
  const [order, booking] = await Promise.all([
    orderId
      ? prisma.order.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, status: true } })
      : null,
    bookingId
      ? prisma.labourBooking.findUnique({ where: { id: bookingId }, select: { id: true, bookingNumber: true, status: true } })
      : null,
  ]);
  return { order, booking };
}
