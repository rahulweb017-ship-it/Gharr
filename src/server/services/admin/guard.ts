import type { Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, UnauthenticatedError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";

/**
 * Staff authorisation for the admin console.
 *
 * Access-token claims can be up to 15 minutes old, so a just-suspended or
 * just-demoted admin could otherwise keep acting until expiry. Every admin
 * service call re-reads roles and `isActive` from the database — one indexed
 * primary-key lookup, negligible next to the work an admin action does.
 *
 * ADMIN can do everything; SUPPORT can work tickets and read orders, bookings
 * and users.
 */

export type StaffLevel = "ADMIN" | "SUPPORT";

export interface StaffActor extends Actor {
  level: StaffLevel;
  name: string | null;
}

export async function requireStaff(actor: Actor | null, minimum: StaffLevel): Promise<StaffActor> {
  if (!actor) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { roles: true, isActive: true, name: true },
  });
  if (!user || !user.isActive) throw new ForbiddenError();

  const level = staffLevel(user.roles);
  if (!level) throw new ForbiddenError();
  if (minimum === "ADMIN" && level !== "ADMIN") {
    throw new ForbiddenError("This action needs an administrator");
  }

  return { userId: actor.userId, roles: user.roles, level, name: user.name };
}

export function staffLevel(roles: Role[]): StaffLevel | null {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("SUPPORT")) return "SUPPORT";
  return null;
}

/** Shared pagination for admin list endpoints and pages. */
export function pageArgs(page = 1, perPage = 25) {
  const safePage = Math.max(1, Math.floor(page));
  const safePer = Math.min(100, Math.max(5, Math.floor(perPage)));
  return { skip: (safePage - 1) * safePer, take: safePer, page: safePage, perPage: safePer };
}
