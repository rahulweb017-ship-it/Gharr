import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import type { Actor } from "@/server/auth/session";
import { writeAudit, type RequestMeta } from "@/server/audit";
import { changedFields, variantEditErrors } from "@/server/services/admin/catalog-admin-rules";
import { UNIT_META, type Unit } from "@/shared/units";
import type { OfferInput, SubmitProductInput } from "@/shared/contracts/vendor";
import { requireSellingVendor, requireVendor } from "./vendor-scope";
import { buildSearchText, slugify } from "./vendor-rules";

/**
 * A supplier's own offers: list existing catalogue products, propose new ones,
 * keep price and stock current. Every query is scoped by the caller's vendorId,
 * so one supplier can never read or touch another's offers.
 */

function offerErrors(offer: Pick<OfferInput, "pricePaise" | "mrpPaise" | "quantityAvailable" | "lowStockThreshold" | "unit" | "moqQuantity" | "stepQuantity" | "maxOrderQuantity">) {
  const allowsFraction = UNIT_META[offer.unit as Unit].allowsFraction;
  const errors = variantEditErrors({ ...offer, allowsFraction });
  if (!allowsFraction && (!Number.isInteger(offer.moqQuantity) || !Number.isInteger(offer.stepQuantity))) {
    errors.push({ field: "moqQuantity", message: "Minimum and step must be whole numbers for this unit" });
  }
  if (offer.maxOrderQuantity != null && offer.maxOrderQuantity < offer.moqQuantity) {
    errors.push({ field: "maxOrderQuantity", message: "Maximum order cannot be below the minimum" });
  }
  return errors;
}

function offerData(offer: OfferInput) {
  return {
    sku: offer.sku,
    label: offer.label,
    unit: offer.unit,
    packSize: offer.packSize,
    mrpPaise: offer.mrpPaise,
    pricePaise: offer.pricePaise,
    moqQuantity: offer.moqQuantity,
    stepQuantity: offer.stepQuantity,
    maxOrderQuantity: offer.maxOrderQuantity,
    deliveryMode: offer.deliveryMode,
    leadTimeDays: offer.leadTimeDays,
    weightKgPerUnit: offer.weightKgPerUnit,
  };
}

async function assertSkuFree(tx: Prisma.TransactionClient, vendorId: string, sku: string) {
  const taken = await tx.productVariant.findUnique({ where: { vendorId_sku: { vendorId, sku } }, select: { id: true } });
  if (taken) throw new ConflictError(`You already use SKU ${sku}`, [{ field: "sku", message: "SKU already used" }]);
}

const VARIANT_ROW = {
  id: true,
  sku: true,
  label: true,
  unit: true,
  packSize: true,
  mrpPaise: true,
  pricePaise: true,
  isActive: true,
  leadTimeDays: true,
  deliveryMode: true,
  updatedAt: true,
  inventory: { select: { quantityAvailable: true, quantityReserved: true, lowStockThreshold: true } },
  product: { select: { id: true, name: true, slug: true, images: true, isActive: true, reviewStatus: true, reviewNote: true, category: { select: { name: true } } } },
} satisfies Prisma.ProductVariantSelect;

type VariantRow = Prisma.ProductVariantGetPayload<{ select: typeof VARIANT_ROW }>;

function toRow(v: VariantRow) {
  const stock = Number(v.inventory?.quantityAvailable ?? 0);
  const threshold = Number(v.inventory?.lowStockThreshold ?? 0);
  return {
    ...v,
    packSize: Number(v.packSize),
    stock,
    reserved: Number(v.inventory?.quantityReserved ?? 0),
    lowStockThreshold: threshold,
    lowStock: v.isActive && stock <= threshold,
  };
}

export type MyVariantRow = ReturnType<typeof toRow>;

export async function listMyVariants(actor: Actor | null, filters: { q?: string; lowStock?: boolean } = {}) {
  const me = await requireVendor(actor);
  const rows = await prisma.productVariant.findMany({
    where: {
      vendorId: me.vendorId,
      ...(filters.q
        ? {
            OR: [
              { sku: { contains: filters.q, mode: "insensitive" } },
              { label: { contains: filters.q, mode: "insensitive" } },
              { product: { name: { contains: filters.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ product: { name: "asc" } }, { pricePaise: "asc" }],
    take: 500,
    select: VARIANT_ROW,
  });
  const mapped = rows.map(toRow);
  return filters.lowStock ? mapped.filter((r) => r.lowStock) : mapped;
}

/** Approved catalogue products a supplier can attach an offer to. */
export async function searchCatalogue(actor: Actor | null, q: string) {
  const me = await requireVendor(actor);
  const term = q.trim().toLowerCase();
  const rows = await prisma.product.findMany({
    where: { isActive: true, reviewStatus: "APPROVED", ...(term ? { searchText: { contains: term } } : {}) },
    orderBy: { popularityScore: "desc" },
    take: 30,
    select: {
      id: true,
      name: true,
      images: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      variants: { where: { vendorId: me.vendorId }, select: { id: true } },
    },
  });
  return rows.map(({ variants, ...p }) => ({ ...p, alreadyListed: variants.length > 0 }));
}

/** Leaf categories for the new-product form. */
export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true, children: { none: {} } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, parent: { select: { name: true } } },
  });
}

export async function createVariant(actor: Actor | null, input: OfferInput & { productId: string }, meta: RequestMeta = {}) {
  const me = await requireSellingVendor(actor);
  const errors = offerErrors(input);
  if (errors.length) throw new ValidationError(errors[0].message, errors);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, isActive: true, reviewStatus: "APPROVED" },
      select: { id: true },
    });
    if (!product) throw new NotFoundError("Product");
    await assertSkuFree(tx, me.vendorId, input.sku);

    const variant = await tx.productVariant.create({
      data: {
        ...offerData(input),
        productId: product.id,
        vendorId: me.vendorId,
        inventory: { create: { quantityAvailable: input.quantityAvailable, lowStockThreshold: input.lowStockThreshold } },
      },
      select: VARIANT_ROW,
    });
    await writeAudit(tx, {
      actor: me,
      actorRole: "VENDOR",
      action: "variant.create",
      entityType: "ProductVariant",
      entityId: variant.id,
      after: { productId: product.id, ...offerData(input), stock: input.quantityAvailable },
      ...meta,
    });
    return toRow(variant);
  });
}

export interface MyVariantPatch {
  pricePaise?: number;
  mrpPaise?: number;
  isActive?: boolean;
  quantityAvailable?: number;
  lowStockThreshold?: number;
  leadTimeDays?: number;
}

/**
 * Price, MRP, active flag and stock. Pausing an offer is always allowed so a
 * supplier whose verification lapses can still stop selling; everything else
 * needs a verified account.
 */
export async function updateMyVariant(actor: Actor | null, id: string, input: MyVariantPatch, meta: RequestMeta = {}) {
  const pauseOnly = Object.keys(input).every((k) => k === "isActive") && input.isActive === false;
  const me = pauseOnly ? await requireVendor(actor) : await requireSellingVendor(actor);

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id, vendorId: me.vendorId },
      select: {
        id: true,
        pricePaise: true,
        mrpPaise: true,
        isActive: true,
        leadTimeDays: true,
        unit: true,
        inventory: { select: { quantityAvailable: true, lowStockThreshold: true } },
      },
    });
    // Another vendor's variant is reported as missing, not forbidden, so ids
    // cannot be probed.
    if (!variant) throw new NotFoundError("Listing");

    const offerBefore = { pricePaise: variant.pricePaise, mrpPaise: variant.mrpPaise, isActive: variant.isActive, leadTimeDays: variant.leadTimeDays };
    const stockBefore = {
      quantityAvailable: Number(variant.inventory?.quantityAvailable ?? 0),
      lowStockThreshold: Number(variant.inventory?.lowStockThreshold ?? 0),
    };
    const errors = variantEditErrors({
      pricePaise: input.pricePaise ?? offerBefore.pricePaise,
      mrpPaise: input.mrpPaise ?? offerBefore.mrpPaise,
      quantityAvailable: input.quantityAvailable ?? stockBefore.quantityAvailable,
      lowStockThreshold: input.lowStockThreshold ?? stockBefore.lowStockThreshold,
      allowsFraction: UNIT_META[variant.unit as Unit].allowsFraction,
    });
    if (errors.length) throw new ValidationError(errors[0].message, errors);

    const offer = changedFields(offerBefore, {
      pricePaise: input.pricePaise,
      mrpPaise: input.mrpPaise,
      isActive: input.isActive,
      leadTimeDays: input.leadTimeDays,
    });
    const stock = changedFields(stockBefore, {
      quantityAvailable: input.quantityAvailable,
      lowStockThreshold: input.lowStockThreshold,
    });

    if (offer.changed) {
      await tx.productVariant.update({ where: { id }, data: offer.after });
      await writeAudit(tx, { actor: me, actorRole: "VENDOR", action: "variant.update", entityType: "ProductVariant", entityId: id, before: offer.before, after: offer.after, ...meta });
    }
    if (stock.changed) {
      await tx.inventory.upsert({
        where: { variantId: id },
        create: { variantId: id, ...stockBefore, ...stock.after },
        update: stock.after,
      });
      await writeAudit(tx, { actor: me, actorRole: "VENDOR", action: "inventory.adjust", entityType: "ProductVariant", entityId: id, before: stock.before, after: stock.after, ...meta });
    }
    return { id, ...offerBefore, ...offer.after, ...stockBefore, ...stock.after, changed: offer.changed || stock.changed };
  });
}

export async function bulkUpdateStock(actor: Actor | null, items: Array<{ variantId: string; quantityAvailable: number }>, meta: RequestMeta = {}) {
  const me = await requireSellingVendor(actor);
  const ids = [...new Set(items.map((i) => i.variantId))];

  return prisma.$transaction(async (tx) => {
    const owned = await tx.productVariant.findMany({
      where: { id: { in: ids }, vendorId: me.vendorId },
      select: { id: true, unit: true, inventory: { select: { quantityAvailable: true } } },
    });
    if (owned.length !== ids.length) throw new NotFoundError("Listing");
    const byId = new Map(owned.map((v) => [v.id, v]));

    let updated = 0;
    for (const item of items) {
      const v = byId.get(item.variantId)!;
      if (!UNIT_META[v.unit as Unit].allowsFraction && !Number.isInteger(item.quantityAvailable)) {
        throw new ValidationError("Stock must be a whole number for this unit", [{ field: item.variantId, message: "Whole numbers only" }]);
      }
      const before = Number(v.inventory?.quantityAvailable ?? 0);
      if (before === item.quantityAvailable) continue;
      await tx.inventory.upsert({
        where: { variantId: v.id },
        create: { variantId: v.id, quantityAvailable: item.quantityAvailable },
        update: { quantityAvailable: item.quantityAvailable },
      });
      await writeAudit(tx, {
        actor: me,
        actorRole: "VENDOR",
        action: "inventory.adjust",
        entityType: "ProductVariant",
        entityId: v.id,
        before: { quantityAvailable: before },
        after: { quantityAvailable: item.quantityAvailable },
        ...meta,
      });
      updated++;
    }
    return { updated };
  });
}

/**
 * Proposes a product the catalogue lacks. It is created hidden (inactive,
 * PENDING) together with the supplier's first offer, and only an admin
 * approval puts it on the storefront.
 */
export async function submitProduct(actor: Actor | null, input: SubmitProductInput, meta: RequestMeta = {}) {
  const me = await requireSellingVendor(actor);
  const errors = offerErrors(input.offer);
  if (errors.length) throw new ValidationError(errors[0].message, errors.map((e) => ({ ...e, field: `offer.${e.field}` })));

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true, name: true } });
    if (!category) throw new ValidationError("Choose a valid category", [{ field: "categoryId", message: "Unknown category" }]);
    await assertSkuFree(tx, me.vendorId, input.offer.sku);

    // Match an existing brand by name; new brand names are left in the
    // description for the admin to create, so suppliers cannot litter the
    // brand list.
    const brand = input.brandName
      ? await tx.brand.findFirst({ where: { name: { equals: input.brandName, mode: "insensitive" } }, select: { id: true, name: true } })
      : null;
    const description = input.brandName && !brand ? `${input.description}\n\nBrand: ${input.brandName}` : input.description;

    const product = await tx.product.create({
      data: {
        slug: `${slugify(input.name) || "product"}-${randomUUID().slice(0, 6)}`,
        name: input.name,
        categoryId: category.id,
        brandId: brand?.id ?? null,
        shortDescription: input.shortDescription,
        description,
        images: input.images,
        hsnCode: input.hsnCode,
        taxRatePercent: input.taxRatePercent,
        searchText: buildSearchText({ name: input.name, brand: brand?.name ?? input.brandName, category: category.name, short: input.shortDescription }),
        isActive: false,
        reviewStatus: "PENDING",
        submittedByVendorId: me.vendorId,
        variants: {
          create: {
            ...offerData(input.offer),
            vendorId: me.vendorId,
            inventory: { create: { quantityAvailable: input.offer.quantityAvailable, lowStockThreshold: input.offer.lowStockThreshold } },
          },
        },
      },
      select: { id: true, name: true, slug: true, reviewStatus: true },
    });
    await writeAudit(tx, {
      actor: me,
      actorRole: "VENDOR",
      action: "product.submit",
      entityType: "Product",
      entityId: product.id,
      after: { name: input.name, categoryId: category.id, offer: offerData(input.offer) },
      ...meta,
    });
    return product;
  });
}

export async function listMySubmissions(actor: Actor | null) {
  const me = await requireVendor(actor);
  return prisma.product.findMany({
    where: { submittedByVendorId: me.vendorId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, slug: true, reviewStatus: true, reviewNote: true, isActive: true, createdAt: true, category: { select: { name: true } } },
  });
}
