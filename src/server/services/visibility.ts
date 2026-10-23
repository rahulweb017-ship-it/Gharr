import type { Prisma, VerificationStatus } from "@prisma/client";

/**
 * What a shopper is allowed to see and buy.
 *
 * Suppliers now register themselves, so the catalogue holds offers from vendors
 * that are not yet verified (or have been suspended) and products a supplier
 * proposed that no admin has approved. One rule, used by listings, product
 * pages, search, facets, cart and the BOQ — so a hidden offer can never leak
 * through a path that forgot to check.
 */

export const SELLABLE_VENDOR = {
  status: "VERIFIED",
  isActive: true,
} as const satisfies Prisma.VendorWhereInput;

export const SELLABLE_VARIANT = {
  isActive: true,
  vendor: SELLABLE_VENDOR,
} as const satisfies Prisma.ProductVariantWhereInput;

export const VISIBLE_PRODUCT = {
  isActive: true,
  reviewStatus: "APPROVED",
} as const satisfies Prisma.ProductWhereInput;

/** In-memory twin of SELLABLE_VARIANT for rows already loaded (the cart). */
export function isSellable(variant: {
  isActive: boolean;
  vendor: { status: VerificationStatus; isActive: boolean };
}): boolean {
  return variant.isActive && variant.vendor.status === "VERIFIED" && variant.vendor.isActive;
}
