import type { Prisma, PrismaClient } from "@prisma/client";
import type { Actor } from "@/server/auth/session";

/**
 * One helper for every audit-log write.
 *
 * Audit rows are compliance records — who changed what, from what, to what — so
 * they are written inside the same transaction as the change they describe. A
 * change that commits without its audit row (or vice versa) is exactly what an
 * auditor would flag.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  /** Null for system-driven changes (webhooks, sweeps). */
  actor: Actor | null;
  /** The role the actor acted in, e.g. "ADMIN" or "VENDOR". */
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  ipHash?: string;
}

export async function writeAudit(db: Db, entry: AuditEntry) {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actor?.userId ?? null,
      actorRole: entry.actorRole ?? (entry.actor ? entry.actor.roles[0] ?? null : "SYSTEM"),
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
      requestId: entry.requestId ?? null,
      // The column is named `ip`, but only the hash is ever stored.
      ip: entry.ipHash ?? null,
    },
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  // Round-trip drops Decimal/Date class instances into plain JSON.
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Request metadata that admin routes thread through to `writeAudit`. */
export interface RequestMeta {
  requestId?: string;
  ipHash?: string;
}
