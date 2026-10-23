import { randomUUID } from "node:crypto";
import type { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, UnauthenticatedError, ValidationError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { putPrivate } from "@/server/storage";
import { evaluateRequirements } from "@/server/services/admin/verification-rules";
import { requireVendor } from "./vendor-scope";
import { VENDOR_DOCUMENT_TYPES, checkUpload, slugify, sniffMatches } from "./vendor-rules";

/**
 * Supplier onboarding: register a business, keep its profile current, upload
 * the KYC documents admins verify. Verification itself stays in the admin
 * console (admin/verification.service.ts) — this side only ever produces
 * PENDING records for it to review.
 */

export interface VendorProfileInput {
  businessName: string;
  legalName?: string | null;
  gstin?: string | null;
  email?: string | null;
  city: string;
  state: string;
  pincode: string;
  servicePincodes: string[];
  baseDeliveryFeePaise: number;
  perKmFeePaise: number;
  freeDeliveryAbovePaise?: number | null;
  maxDeliveryKm: number;
  minOrderPaise: number;
}

const PROFILE_SELECT = {
  id: true,
  businessName: true,
  slug: true,
  legalName: true,
  gstin: true,
  phoneE164: true,
  email: true,
  city: true,
  state: true,
  pincode: true,
  servicePincodes: true,
  status: true,
  statusNote: true,
  isActive: true,
  baseDeliveryFeePaise: true,
  perKmFeePaise: true,
  freeDeliveryAbovePaise: true,
  maxDeliveryKm: true,
  minOrderPaise: true,
  createdAt: true,
} satisfies Prisma.VendorSelect;

async function uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = slugify(name) || "supplier";
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await tx.vendor.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function dedupePincodes(pincodes: string[], own: string): string[] {
  return [...new Set([own, ...pincodes])];
}

export async function registerVendor(actor: Actor | null, input: VendorProfileInput, meta: RequestMeta = {}) {
  if (!actor) throw new UnauthenticatedError();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: actor.userId },
      select: { isActive: true, roles: true, phoneE164: true, vendor: { select: { id: true } } },
    });
    if (!user || !user.isActive) throw new ForbiddenError();
    if (user.vendor) throw new ConflictError("This account already has a supplier profile");
    if (input.gstin) {
      const clash = await tx.vendor.findFirst({ where: { gstin: input.gstin }, select: { id: true } });
      if (clash) throw new ConflictError("A supplier with this GSTIN is already registered");
    }

    const vendor = await tx.vendor.create({
      data: {
        userId: actor.userId,
        slug: await uniqueSlug(tx, input.businessName),
        phoneE164: user.phoneE164,
        businessName: input.businessName,
        legalName: input.legalName ?? null,
        gstin: input.gstin ?? null,
        email: input.email ?? null,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        servicePincodes: dedupePincodes(input.servicePincodes, input.pincode),
        baseDeliveryFeePaise: input.baseDeliveryFeePaise,
        perKmFeePaise: input.perKmFeePaise,
        freeDeliveryAbovePaise: input.freeDeliveryAbovePaise ?? null,
        maxDeliveryKm: input.maxDeliveryKm,
        minOrderPaise: input.minOrderPaise,
        // Not sellable until an admin verifies the documents.
        status: "PENDING",
        isActive: false,
      },
      select: PROFILE_SELECT,
    });

    if (!user.roles.includes("VENDOR")) {
      await tx.user.update({ where: { id: actor.userId }, data: { roles: { push: "VENDOR" } } });
    }

    await writeAudit(tx, {
      actor,
      actorRole: "VENDOR",
      action: "vendor.register",
      entityType: "Vendor",
      entityId: vendor.id,
      after: vendor,
      ...meta,
    });
    return vendor;
  });
}

/**
 * Legal identity (legal name, GSTIN) is what the admin verified against the
 * documents, so it is locked once the business is verified — a change goes
 * through support rather than silently invalidating the check.
 */
export async function updateVendorProfile(actor: Actor | null, input: Partial<VendorProfileInput>, meta: RequestMeta = {}) {
  const me = await requireVendor(actor);

  return prisma.$transaction(async (tx) => {
    const current = await tx.vendor.findUniqueOrThrow({ where: { id: me.vendorId }, select: PROFILE_SELECT });

    const identityChanged =
      (input.legalName !== undefined && (input.legalName ?? null) !== current.legalName) ||
      (input.gstin !== undefined && (input.gstin ?? null) !== current.gstin);
    if (identityChanged && current.status === "VERIFIED") {
      throw new ConflictError("Legal name and GSTIN are locked after verification. Raise a support ticket to change them.");
    }
    if (input.gstin && input.gstin !== current.gstin) {
      const clash = await tx.vendor.findFirst({ where: { gstin: input.gstin, id: { not: me.vendorId } }, select: { id: true } });
      if (clash) throw new ConflictError("A supplier with this GSTIN is already registered");
    }

    const pincode = input.pincode ?? current.pincode;
    const data: Prisma.VendorUpdateInput = {
      ...input,
      ...(input.servicePincodes ? { servicePincodes: dedupePincodes(input.servicePincodes, pincode) } : {}),
    };

    const updated = await tx.vendor.update({ where: { id: me.vendorId }, data, select: PROFILE_SELECT });
    await writeAudit(tx, {
      actor: me,
      actorRole: "VENDOR",
      action: "vendor.profile.update",
      entityType: "Vendor",
      entityId: me.vendorId,
      before: current,
      after: updated,
      ...meta,
    });
    return updated;
  });
}

/** Null when the user has not registered as a supplier yet. */
export async function getMyVendor(actor: Actor | null) {
  if (!actor) throw new UnauthenticatedError();
  const vendor = await prisma.vendor.findUnique({
    where: { userId: actor.userId },
    select: {
      ...PROFILE_SELECT,
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, status: true, notes: true, createdAt: true, reviewedAt: true },
      },
    },
  });
  if (!vendor) return null;
  return { ...vendor, requirements: evaluateRequirements("vendor", vendor.documents) };
}

export type MyVendor = NonNullable<Awaited<ReturnType<typeof getMyVendor>>>;

export async function uploadVendorDocument(
  actor: Actor | null,
  type: DocumentType,
  file: { type: string; size: number; bytes: Uint8Array },
  meta: RequestMeta = {},
) {
  const me = await requireVendor(actor);
  if (!VENDOR_DOCUMENT_TYPES.includes(type)) throw new ValidationError("This document type is not needed for supplier verification");

  const check = checkUpload(file);
  if (!check.ok) throw new ValidationError(check.message);
  if (!sniffMatches(check.ext, file.bytes)) throw new ValidationError("The file contents do not match its type");

  // A live upload of the same type is replaced rather than stacked: admins
  // review one current GST certificate, not a history of them.
  const live = await prisma.vendorDocument.findFirst({
    where: { vendorId: me.vendorId, type, status: "VERIFIED" },
    select: { id: true },
  });
  if (live) throw new ConflictError("This document is already verified");

  const key = `vendors/${me.vendorId.toLowerCase()}/${type.toLowerCase()}-${randomUUID()}.${check.ext}`;
  await putPrivate(key, file.bytes);

  return prisma.$transaction(async (tx) => {
    await tx.vendorDocument.deleteMany({ where: { vendorId: me.vendorId, type, status: "PENDING" } });
    const doc = await tx.vendorDocument.create({
      data: { vendorId: me.vendorId, type, storageKey: key },
      select: { id: true, type: true, status: true, createdAt: true },
    });
    await writeAudit(tx, {
      actor: me,
      actorRole: "VENDOR",
      action: "vendor.document.upload",
      entityType: "VendorDocument",
      entityId: doc.id,
      after: { type, size: file.size },
      ...meta,
    });
    return doc;
  });
}
