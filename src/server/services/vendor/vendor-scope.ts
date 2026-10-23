import type { VerificationStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";

/**
 * Which vendor a signed-in user acts for.
 *
 * Scoping is by the Vendor row linked to the user, never by the VENDOR role in
 * the access token: the role claim can be up to 15 minutes stale right after
 * registration or suspension, while the link and status are read fresh here.
 */

export interface VendorActor extends Actor {
  vendorId: string;
  status: VerificationStatus;
  isActive: boolean;
}

/** The vendor profile a VENDOR actor acts for; without one it may see nothing. */
export async function vendorIdFor(actor: Actor): Promise<string> {
  const vendor = await prisma.vendor.findUnique({
    where: { userId: actor.userId },
    select: { id: true },
  });
  if (!vendor) throw new ForbiddenError("No vendor profile is linked to this account");
  return vendor.id;
}

export async function requireVendor(actor: Actor | null): Promise<VendorActor> {
  if (!actor) throw new UnauthenticatedError();
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { isActive: true, vendor: { select: { id: true, status: true, isActive: true } } },
  });
  if (!user || !user.isActive) throw new ForbiddenError();
  if (!user.vendor) throw new ForbiddenError("No vendor profile is linked to this account");
  return { ...actor, vendorId: user.vendor.id, status: user.vendor.status, isActive: user.vendor.isActive };
}

/** Selling (listings, stock) is only for verified, active suppliers. */
export async function requireSellingVendor(actor: Actor | null): Promise<VendorActor> {
  const vendor = await requireVendor(actor);
  if (vendor.status !== "VERIFIED" || !vendor.isActive) {
    throw new ConflictError("Your business must be verified before you can list products");
  }
  return vendor;
}
