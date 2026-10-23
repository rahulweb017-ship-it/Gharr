import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { ConflictError, NotFoundError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { pageArgs, requireStaff } from "./guard";
import { type ManagedRole, applyRoleChange, assertNotSelf } from "./users-rules";

/**
 * Admin user management. SUPPORT can read; every write needs ADMIN.
 *
 * Suspension flips `isActive` and revokes every refresh token in the same
 * transaction. Login and refresh already refuse inactive users, and staff
 * calls re-check `isActive` in `requireStaff`, so the only remaining window is
 * an unexpired access token — at most its 15-minute lifetime.
 */

export interface UserFilters {
  q?: string;
  role?: Role;
  active?: "active" | "suspended";
  page?: number;
  perPage?: number;
}

export async function listUsers(actor: Actor | null, filters: UserFilters = {}) {
  await requireStaff(actor, "SUPPORT");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage);

  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { roles: { has: filters.role } } : {}),
    ...(filters.active === "active" ? { isActive: true } : {}),
    ...(filters.active === "suspended" ? { isActive: false } : {}),
  };
  const q = filters.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      ...(digits.length >= 3 ? [{ phoneE164: { contains: digits } }] : []),
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        id: true,
        name: true,
        phoneE164: true,
        roles: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { orders: true, bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total, page, perPage };
}

export async function getUser(actor: Actor | null, id: string) {
  const staff = await requireStaff(actor, "SUPPORT");
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneE164: true,
      phoneVerifiedAt: true,
      roles: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      vendor: { select: { id: true, businessName: true, status: true } },
      worker: { select: { id: true, displayName: true, idVerificationStatus: true } },
      addresses: {
        where: { deletedAt: null },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
        select: { id: true, type: true, contactName: true, line1: true, city: true, pincode: true, isDefault: true },
      },
      _count: { select: { orders: true, bookings: true, estimates: true, supportTickets: true } },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 5,
        select: { id: true, orderNumber: true, status: true, totalPaise: true, placedAt: true },
      },
      bookings: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, bookingNumber: true, status: true, trade: true, scheduledDate: true, estimatedTotalPaise: true },
      },
      supportTickets: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, subject: true, status: true, createdAt: true },
      },
    },
  });
  if (!user) throw new NotFoundError("User");

  const activeSessions = await prisma.refreshToken.count({
    where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } },
  });
  const lastSuspension = user.isActive
    ? null
    : await prisma.auditLog.findFirst({
        where: { entityType: "User", entityId: id, action: "user.suspend" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, after: true },
      });

  return {
    ...user,
    activeSessions,
    suspension: lastSuspension
      ? { at: lastSuspension.createdAt, reason: (lastSuspension.after as { reason?: string } | null)?.reason ?? null }
      : null,
    viewer: { id: staff.userId, level: staff.level },
  };
}

export async function suspendUser(actor: Actor | null, id: string, reason: string, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  assertNotSelf(staff.userId, id, "suspend");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!user) throw new NotFoundError("User");
  if (!user.isActive) throw new ConflictError("This account is already suspended");

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive: false } });
    const revoked = await tx.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAudit(tx, {
      actor: staff,
      actorRole: staff.level,
      action: "user.suspend",
      entityType: "User",
      entityId: id,
      before: { isActive: true },
      after: { isActive: false, reason, revokedSessions: revoked.count },
      ...meta,
    });
    return { id, isActive: false, revokedSessions: revoked.count };
  });
}

export async function reactivateUser(actor: Actor | null, id: string, reason: string | undefined, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!user) throw new NotFoundError("User");
  if (user.isActive) throw new ConflictError("This account is already active");

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive: true } });
    await writeAudit(tx, {
      actor: staff,
      actorRole: staff.level,
      action: "user.reactivate",
      entityType: "User",
      entityId: id,
      before: { isActive: false },
      after: { isActive: true, reason: reason || undefined },
      ...meta,
    });
    return { id, isActive: true };
  });
}

export async function setStaffRole(
  actor: Actor | null,
  id: string,
  role: ManagedRole,
  enabled: boolean,
  meta: RequestMeta = {},
) {
  const staff = await requireStaff(actor, "ADMIN");
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, roles: true } });
  if (!user) throw new NotFoundError("User");

  const roles = applyRoleChange(user.roles, role, enabled, { actorId: staff.userId, targetId: id });
  if (roles.length === user.roles.length && roles.every((r) => user.roles.includes(r))) {
    return { id, roles };
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { roles } });
    await writeAudit(tx, {
      actor: staff,
      actorRole: staff.level,
      action: "user.roles",
      entityType: "User",
      entityId: id,
      before: { roles: user.roles },
      after: { roles, [enabled ? "granted" : "revoked"]: role },
      ...meta,
    });
    return { id, roles };
  });
}
