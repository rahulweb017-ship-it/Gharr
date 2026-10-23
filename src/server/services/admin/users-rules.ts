import type { Role } from "@prisma/client";
import { ConflictError, ValidationError } from "@/server/http/errors";

/**
 * Pure rules for admin user management, separate from Prisma so they are
 * unit-testable.
 *
 * Only staff roles are managed here. VENDOR and WORKER follow from having a
 * Vendor/Worker profile, and CUSTOMER is the default everyone has — editing
 * those by hand would desynchronise the role from the profile.
 */

export const MANAGED_ROLES = ["ADMIN", "SUPPORT"] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export function assertNotSelf(actorId: string, targetId: string, what: string) {
  if (actorId === targetId) throw new ConflictError(`You can't ${what} your own account`);
}

/** The role set after granting or revoking one staff role. */
export function applyRoleChange(
  current: Role[],
  role: ManagedRole,
  enabled: boolean,
  opts: { actorId: string; targetId: string },
): Role[] {
  if (!(MANAGED_ROLES as readonly string[]).includes(role)) {
    throw new ValidationError("Only ADMIN and SUPPORT can be changed here");
  }
  if (!enabled && role === "ADMIN" && opts.actorId === opts.targetId) {
    throw new ConflictError("You can't remove your own administrator role");
  }

  const set = new Set<Role>(current);
  if (enabled) set.add(role);
  else set.delete(role);
  // Everyone keeps at least the customer role, so the account stays usable.
  if (set.size === 0) set.add("CUSTOMER");

  const order: Role[] = ["CUSTOMER", "VENDOR", "WORKER", "DELIVERY_PARTNER", "SUPPORT", "ADMIN"];
  return order.filter((r) => set.has(r));
}
