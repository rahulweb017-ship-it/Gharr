import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import { type RequestMeta, writeAudit } from "@/server/audit";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { pageArgs, requireStaff } from "./guard";
import { changedFields, variantEditErrors } from "./catalog-admin-rules";
import { UNIT_META, type Unit } from "@/shared/units";

/**
 * Admin catalogue: read the product table and correct live offers (price, MRP,
 * stock, active) on existing products, and review the products suppliers
 * submit from the supplier portal — approval is the only way a supplier's new
 * product reaches the storefront.
 *
 * Every write is ADMIN-only, runs in one transaction with its audit row, and
 * records only the fields that actually changed — an audit diff full of
 * untouched values hides the one that matters.
 */

export interface ProductListFilters {
  q?: string;
  categoryId?: string;
  status?: "active" | "inactive";
  lowStock?: boolean;
  page?: number;
  perPage?: number;
}

/** Any variant at or below its own low-stock threshold. */
function lowStockWhere(): Prisma.ProductWhereInput {
  return {
    variants: {
      some: {
        inventory: { quantityAvailable: { lte: prisma.inventory.fields.lowStockThreshold } },
      },
    },
  };
}

export async function listProducts(actor: Actor | null, filters: ProductListFilters) {
  await requireStaff(actor, "ADMIN");
  const { skip, take, page, perPage } = pageArgs(filters.page, filters.perPage);

  const and: Prisma.ProductWhereInput[] = [];
  const q = filters.q?.trim();
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { brand: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  if (filters.categoryId) and.push({ categoryId: filters.categoryId });
  if (filters.status) and.push({ isActive: filters.status === "active" });
  if (filters.lowStock) and.push(lowStockWhere());
  const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip,
      take,
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        category: { select: { name: true } },
        brand: { select: { name: true } },
        variants: {
          select: {
            pricePaise: true,
            isActive: true,
            inventory: { select: { quantityAvailable: true, lowStockThreshold: true } },
          },
        },
      },
    }),
  ]);

  const rows = products.map((p) => {
    const prices = p.variants.map((v) => v.pricePaise);
    let totalStock = 0;
    let lowStock = false;
    for (const v of p.variants) {
      const available = Number(v.inventory?.quantityAvailable ?? 0);
      totalStock += available;
      if (available <= Number(v.inventory?.lowStockThreshold ?? 0)) lowStock = true;
    }
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      isActive: p.isActive,
      categoryName: p.category.name,
      brandName: p.brand?.name ?? null,
      variantCount: p.variants.length,
      activeVariantCount: p.variants.filter((v) => v.isActive).length,
      minPricePaise: prices.length ? Math.min(...prices) : null,
      maxPricePaise: prices.length ? Math.max(...prices) : null,
      totalStock: Number(totalStock.toFixed(3)),
      lowStock,
    };
  });

  return { rows, total, page, perPage };
}

/** Category options for the list filter. */
export async function listCategoryOptions(actor: Actor | null) {
  await requireStaff(actor, "ADMIN");
  const categories = await prisma.category.findMany({
    where: { products: { some: {} } },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true },
  });
  return categories.map((c) => ({ value: c.id, label: c.name }));
}

export async function getProduct(actor: Actor | null, id: string) {
  await requireStaff(actor, "ADMIN");
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      isActive: true,
      hsnCode: true,
      taxRatePercent: true,
      ratingAvg: true,
      ratingCount: true,
      images: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      _count: { select: { estimatePrices: true } },
      variants: {
        orderBy: [{ pricePaise: "asc" }],
        select: {
          id: true,
          sku: true,
          label: true,
          unit: true,
          pricePaise: true,
          mrpPaise: true,
          isActive: true,
          vendor: { select: { id: true, businessName: true, isActive: true } },
          inventory: { select: { quantityAvailable: true, lowStockThreshold: true } },
        },
      },
    },
  });
  if (!product) throw new NotFoundError("Product");

  return {
    ...product,
    taxRatePercent: Number(product.taxRatePercent),
    ratingAvg: Number(product.ratingAvg),
    estimatePriceCount: product._count.estimatePrices,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      label: v.label,
      unit: v.unit,
      pricePaise: v.pricePaise,
      mrpPaise: v.mrpPaise,
      isActive: v.isActive,
      vendorName: v.vendor.businessName,
      vendorActive: v.vendor.isActive,
      quantityAvailable: Number(v.inventory?.quantityAvailable ?? 0),
      lowStockThreshold: Number(v.inventory?.lowStockThreshold ?? 0),
    })),
  };
}

export type AdminProductDetail = Awaited<ReturnType<typeof getProduct>>;
export type AdminVariantRow = AdminProductDetail["variants"][number];

export async function updateProduct(
  actor: Actor | null,
  id: string,
  input: { isActive: boolean },
  meta: RequestMeta = {},
) {
  const staff = await requireStaff(actor, "ADMIN");

  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, select: { id: true, isActive: true, reviewStatus: true } });
    if (!current) throw new NotFoundError("Product");
    if (current.isActive === input.isActive) return { id: current.id, isActive: current.isActive };
    if (input.isActive && current.reviewStatus !== "APPROVED") {
      throw new ConflictError("Approve this supplier submission before putting it on sale");
    }

    const updated = await tx.product.update({
      where: { id },
      data: { isActive: input.isActive },
      select: { id: true, isActive: true },
    });
    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "product.update",
      entityType: "Product",
      entityId: id,
      before: { isActive: current.isActive },
      after: { isActive: updated.isActive },
      ...meta,
    });
    return updated;
  });
}

export interface VariantUpdateInput {
  pricePaise?: number;
  mrpPaise?: number;
  isActive?: boolean;
  quantityAvailable?: number;
  lowStockThreshold?: number;
}

export async function updateVariant(
  actor: Actor | null,
  id: string,
  input: VariantUpdateInput,
  meta: RequestMeta = {},
) {
  const staff = await requireStaff(actor, "ADMIN");

  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({
      where: { id },
      select: {
        id: true,
        pricePaise: true,
        mrpPaise: true,
        isActive: true,
        unit: true,
        inventory: { select: { quantityAvailable: true, lowStockThreshold: true } },
      },
    });
    if (!variant) throw new NotFoundError("Variant");

    const offerBefore = { pricePaise: variant.pricePaise, mrpPaise: variant.mrpPaise, isActive: variant.isActive };
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
    });
    const stock = changedFields(stockBefore, {
      quantityAvailable: input.quantityAvailable,
      lowStockThreshold: input.lowStockThreshold,
    });

    if (offer.changed) {
      await tx.productVariant.update({ where: { id }, data: offer.after });
      await writeAudit(tx, {
        actor: staff,
        actorRole: "ADMIN",
        action: "variant.update",
        entityType: "ProductVariant",
        entityId: id,
        before: offer.before,
        after: offer.after,
        ...meta,
      });
    }

    if (stock.changed) {
      // Seeded variants always have a row, but an upsert keeps a variant that
      // never had one from failing its first stock adjustment.
      await tx.inventory.upsert({
        where: { variantId: id },
        create: { variantId: id, ...stockBefore, ...stock.after },
        update: stock.after,
      });
      await writeAudit(tx, {
        actor: staff,
        actorRole: "ADMIN",
        action: "inventory.adjust",
        entityType: "ProductVariant",
        entityId: id,
        before: stock.before,
        after: stock.after,
        ...meta,
      });
    }

    return {
      id,
      ...offerBefore,
      ...offer.after,
      ...stockBefore,
      ...stock.after,
      changed: offer.changed || stock.changed,
    };
  });
}

// ---------------------------------------------------------------------------
// Supplier submissions
// ---------------------------------------------------------------------------

export async function listPendingProducts(actor: Actor | null) {
  await requireStaff(actor, "ADMIN");
  const rows = await prisma.product.findMany({
    where: { reviewStatus: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      images: true,
      hsnCode: true,
      taxRatePercent: true,
      createdAt: true,
      category: { select: { name: true } },
      brand: { select: { name: true } },
      submittedByVendor: { select: { id: true, businessName: true, status: true } },
      variants: {
        select: { id: true, sku: true, label: true, unit: true, packSize: true, mrpPaise: true, pricePaise: true, inventory: { select: { quantityAvailable: true } } },
      },
    },
  });
  return rows.map((p) => ({
    ...p,
    taxRatePercent: Number(p.taxRatePercent),
    variants: p.variants.map((v) => ({ ...v, packSize: Number(v.packSize), stock: Number(v.inventory?.quantityAvailable ?? 0) })),
  }));
}

export type PendingProduct = Awaited<ReturnType<typeof listPendingProducts>>[number];

export async function reviewProduct(
  actor: Actor | null,
  id: string,
  input: { decision: "APPROVED" | "REJECTED"; note?: string | null },
  meta: RequestMeta = {},
) {
  const staff = await requireStaff(actor, "ADMIN");
  const note = input.note?.trim() || null;
  if (input.decision === "REJECTED" && (!note || note.length < 5)) {
    throw new ValidationError("Tell the supplier why it was rejected", [{ field: "note", message: "At least 5 characters" }]);
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id },
      select: { id: true, name: true, reviewStatus: true, isActive: true, submittedByVendor: { select: { userId: true } } },
    });
    if (!product) throw new NotFoundError("Product");
    if (product.reviewStatus !== "PENDING") throw new ConflictError("This product has already been reviewed");

    const approved = input.decision === "APPROVED";
    const updated = await tx.product.update({
      where: { id },
      data: { reviewStatus: input.decision, reviewNote: approved ? null : note, isActive: approved },
      select: { id: true, reviewStatus: true, isActive: true, reviewNote: true },
    });

    const userId = product.submittedByVendor?.userId;
    if (userId) {
      await tx.notification.create({
        data: {
          userId,
          type: `product.review.${input.decision.toLowerCase()}`,
          title: approved ? "Product approved" : "Product not approved",
          body: approved
            ? `${product.name} is now live on Gharr.`
            : `${product.name} was not approved: ${note}`,
          data: { productId: id },
        },
      });
    }

    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "product.review",
      entityType: "Product",
      entityId: id,
      before: { reviewStatus: product.reviewStatus, isActive: product.isActive },
      after: updated,
      ...meta,
    });
    return updated;
  });
}
