import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import { pageArgs, requireStaff } from "./guard";

/**
 * Read-only audit-log viewer (ADMIN only — the log itself records who looked
 * at private documents, so it is not for every staff member).
 *
 * AuditLog stores only `actorUserId`, not a relation, so actor names and phones
 * are joined in a second query for the page of rows shown.
 */

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  /** Any part of the actor's phone number. */
  actorPhone?: string;
  createdAt?: { gte?: Date; lt?: Date };
  page?: number;
  perPage?: number;
}

export async function listAudit(actor: Actor | null, filters: AuditFilters = {}) {
  await requireStaff(actor, "ADMIN");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage ?? 50);

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
    ...(filters.createdAt ? { createdAt: filters.createdAt } : {}),
  };

  const digits = filters.actorPhone?.replace(/\D/g, "") ?? "";
  if (digits) {
    const actors = await prisma.user.findMany({
      where: { phoneE164: { contains: digits } },
      select: { id: true },
      take: 50,
    });
    where.actorUserId = { in: actors.map((a) => a.id) };
  }

  const [rows, total, actions, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.groupBy({ by: ["entityType"], orderBy: { entityType: "asc" } }),
  ]);

  const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((v): v is string => !!v))];
  const users = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, phoneE164: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return {
    rows: rows.map((r) => ({ ...r, actor: r.actorUserId ? byId.get(r.actorUserId) ?? null : null })),
    total,
    page,
    perPage,
    actions: actions.map((a) => a.action),
    entityTypes: entityTypes.map((e) => e.entityType),
  };
}

export type AuditRow = Awaited<ReturnType<typeof listAudit>>["rows"][number];
