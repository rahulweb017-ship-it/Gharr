import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { ACCESS_COOKIE } from "./session";
import { verifyAccessToken } from "./tokens";

/**
 * Session helper for Server Components.
 *
 * API routes resolve the actor from the Request; pages have no Request object,
 * so they read the cookie store instead. Keeping this in one file means page
 * auth cannot quietly drift from API auth.
 *
 * This is a convenience for rendering, not an authorization boundary — the
 * service layer re-checks ownership on every read and write.
 */

export interface PageActor {
  userId: string;
  roles: Role[];
}

export async function getPageActor(): Promise<PageActor | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  return { userId: claims.sub, roles: claims.roles };
}

/** Redirects to sign-in, preserving where the user was headed. */
export async function requirePageActor(returnTo?: string): Promise<PageActor> {
  const actor = await getPageActor();
  if (!actor) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return actor;
}

export async function requirePageRole(
  roles: Role[],
  returnTo?: string,
): Promise<PageActor> {
  const actor = await requirePageActor(returnTo);
  if (!roles.some((role) => actor.roles.includes(role))) {
    redirect("/");
  }
  return actor;
}
