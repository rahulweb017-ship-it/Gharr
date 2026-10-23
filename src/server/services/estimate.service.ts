import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { logger } from "@/server/logger";
import { AppError, NotFoundError, ValidationError, isAppError } from "@/server/http/errors";
import { addItem } from "@/server/services/cart.service";
import {
  computeEstimate,
  MissingPriceError,
  packsForQuantity,
  type ComputedEstimate,
  type EstimateScope,
} from "@/shared/estimate";
import {
  measuresFor,
  scopeOf,
  type BoqCartInput,
  type EstimateInput,
} from "@/shared/contracts/estimate";
import { snapQuantity, type Unit } from "@/shared/units";

/**
 * Estimate Engine service: loads the rule and price tables, runs the shared
 * calculation, and persists the result as an immutable snapshot.
 *
 * It also bridges an estimate to the marketplace — the material list (BOQ) maps
 * each material line to the best live offer for its linked product, and "Buy
 * Complete List" feeds those into the ordinary cart. The client only ever sends
 * line ids and pack counts; every price and variant is resolved here.
 */

async function runEngine(input: EstimateInput): Promise<ComputedEstimate> {
  const scope: EstimateScope = scopeOf(input);

  const [rules, prices] = await Promise.all([
    prisma.estimateRule.findMany({
      where: { mode: input.mode, scope, tier: input.tier, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.estimatePrice.findMany({ where: { city: input.city, tier: input.tier } }),
  ]);

  if (rules.length === 0) {
    throw new ValidationError("Estimates are not available for this project type yet");
  }
  if (prices.length === 0) {
    throw new ValidationError(`Estimates are not available in ${input.city} yet`);
  }

  try {
    return computeEstimate(
      measuresFor(input),
      rules.map((r) => ({
        itemKey: r.itemKey,
        label: r.label,
        bucket: r.bucket,
        basis: r.basis,
        quantityPerBasis: Number(r.quantityPerBasis),
        unit: r.unit,
        wastagePercent: Number(r.wastagePercent),
        sortOrder: r.sortOrder,
      })),
      prices.map((p) => ({
        itemKey: p.itemKey,
        unitPricePaise: p.unitPricePaise,
        productId: p.productId,
        packCoverage: Number(p.packCoverage),
      })),
    );
  } catch (error) {
    if (error instanceof MissingPriceError) {
      // A gap in the price table is an operations problem, not the customer's.
      logger.error({ city: input.city, tier: input.tier, items: error.itemKeys }, "estimate price table incomplete");
      throw new AppError("INTERNAL", "Pricing for this estimate is incomplete. Please try again later.");
    }
    throw error;
  }
}

/** Cities that have a price table, i.e. where the wizard can produce an estimate. */
export async function listEstimateCities(): Promise<string[]> {
  const rows = await prisma.estimatePrice.findMany({
    distinct: ["city"],
    select: { city: true },
    orderBy: { city: "asc" },
  });
  return rows.map((r) => r.city);
}

/** Computes without saving — for the signed-out wizard and live totals. */
export async function previewEstimate(input: EstimateInput) {
  const result = await runEngine(input);
  return { ...result, input };
}

function linesCreateData(result: ComputedEstimate) {
  return result.lines.map((l) => ({
    itemKey: l.itemKey,
    label: l.label,
    bucket: l.bucket,
    basis: l.basis,
    quantity: l.quantity,
    unit: l.unit,
    unitPricePaise: l.unitPricePaise,
    amountPaise: l.amountPaise,
    productId: l.productId,
    packCoverage: l.packCoverage,
    sortOrder: l.sortOrder,
  }));
}

function totalsData(input: EstimateInput, result: ComputedEstimate) {
  return {
    title: input.title,
    mode: input.mode,
    scope: scopeOf(input),
    tier: input.tier,
    city: input.city,
    inputs: input as unknown as Prisma.InputJsonValue,
    materialsPaise: result.materialsPaise,
    labourPaise: result.labourPaise,
    otherPaise: result.otherPaise,
    totalPaise: result.totalPaise,
  };
}

export async function createEstimate(userId: string, input: EstimateInput) {
  const result = await runEngine(input);

  const estimate = await prisma.estimate.create({
    data: {
      userId,
      ...totalsData(input, result),
      lines: { create: linesCreateData(result) },
    },
    select: { id: true },
  });

  return getEstimate(userId, estimate.id);
}

/** Re-runs the engine with edited inputs and today's prices, replacing the lines. */
export async function recomputeEstimate(userId: string, id: string, input: EstimateInput) {
  await findOwned(userId, id);
  const result = await runEngine(input);

  await prisma.$transaction([
    prisma.estimateLine.deleteMany({ where: { estimateId: id } }),
    prisma.estimate.update({
      where: { id },
      data: { ...totalsData(input, result), lines: { create: linesCreateData(result) } },
    }),
  ]);

  return getEstimate(userId, id);
}

async function findOwned(userId: string, id: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!estimate) throw new NotFoundError("Estimate");
  return estimate;
}

export async function listEstimates(userId: string) {
  return prisma.estimate.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      mode: true,
      scope: true,
      tier: true,
      city: true,
      totalPaise: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getEstimate(userId: string, id: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id, userId },
    include: { lines: { orderBy: { sortOrder: "asc" } } },
  });
  if (!estimate) throw new NotFoundError("Estimate");

  return {
    id: estimate.id,
    title: estimate.title,
    mode: estimate.mode,
    scope: estimate.scope,
    tier: estimate.tier,
    city: estimate.city,
    inputs: estimate.inputs as unknown as EstimateInput,
    materialsPaise: estimate.materialsPaise,
    labourPaise: estimate.labourPaise,
    otherPaise: estimate.otherPaise,
    totalPaise: estimate.totalPaise,
    createdAt: estimate.createdAt,
    updatedAt: estimate.updatedAt,
    lines: estimate.lines.map((l) => ({
      id: l.id,
      itemKey: l.itemKey,
      label: l.label,
      bucket: l.bucket,
      basis: l.basis,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPricePaise: l.unitPricePaise,
      amountPaise: l.amountPaise,
      productId: l.productId,
    })),
  };
}

export async function removeEstimate(userId: string, id: string) {
  await findOwned(userId, id);
  await prisma.estimate.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Material list (BOQ)
// ---------------------------------------------------------------------------

/** The cheapest active, in-stock offer for each product. */
async function bestOffers(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, BestOffer>();

  const variants = await prisma.productVariant.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
      inventory: { quantityAvailable: { gt: 0 } },
      vendor: { isActive: true },
    },
    orderBy: { pricePaise: "asc" },
    select: {
      id: true,
      productId: true,
      label: true,
      unit: true,
      pricePaise: true,
      moqQuantity: true,
      stepQuantity: true,
      maxOrderQuantity: true,
      vendor: { select: { businessName: true } },
      product: { select: { name: true, slug: true, images: true } },
    },
  });

  const best = new Map<string, BestOffer>();
  for (const v of variants) {
    if (best.has(v.productId)) continue; // ordered by price, first is cheapest
    best.set(v.productId, {
      variantId: v.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      imageUrl: v.product.images[0] ?? null,
      packLabel: v.label,
      vendorName: v.vendor.businessName,
      pricePaise: v.pricePaise,
      rules: {
        unit: v.unit as Unit,
        moq: Number(v.moqQuantity),
        step: Number(v.stepQuantity),
        max: v.maxOrderQuantity != null ? Number(v.maxOrderQuantity) : null,
      },
    });
  }
  return best;
}

interface BestOffer {
  variantId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  packLabel: string;
  vendorName: string;
  pricePaise: number;
  rules: { unit: Unit; moq: number; step: number; max: number | null };
}

async function loadMaterialLines(userId: string, id: string) {
  const estimate = await prisma.estimate.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      city: true,
      lines: {
        where: { bucket: "MATERIALS", productId: { not: null } },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!estimate) throw new NotFoundError("Estimate");
  return estimate;
}

export async function getBoq(userId: string, id: string) {
  const estimate = await loadMaterialLines(userId, id);
  const offers = await bestOffers([
    ...new Set(estimate.lines.map((l) => l.productId!)),
  ]);

  const items = estimate.lines.map((line) => {
    const quantity = Number(line.quantity);
    const offer = offers.get(line.productId!);
    const estimatedPaise = line.amountPaise;

    if (!offer) {
      return {
        lineId: line.id,
        label: line.label,
        estimatedQuantity: quantity,
        unit: line.unit,
        estimatedPaise,
        available: false as const,
      };
    }

    const packsNeeded = packsForQuantity(quantity, Number(line.packCoverage));
    const packs = snapQuantity(packsNeeded, offer.rules);

    return {
      lineId: line.id,
      label: line.label,
      estimatedQuantity: quantity,
      unit: line.unit,
      estimatedPaise,
      available: true as const,
      packsNeeded,
      packs,
      /** True when MOQ/step pushed the pack count above what the estimate needs. */
      roundedUp: packs > packsNeeded,
      livePaise: Math.round(offer.pricePaise * packs),
      offer: {
        variantId: offer.variantId,
        productName: offer.productName,
        productSlug: offer.productSlug,
        imageUrl: offer.imageUrl,
        packLabel: offer.packLabel,
        vendorName: offer.vendorName,
        pricePaise: offer.pricePaise,
        moq: offer.rules.moq,
        step: offer.rules.step,
        max: offer.rules.max,
        unit: offer.rules.unit,
      },
    };
  });

  return {
    estimateId: estimate.id,
    title: estimate.title,
    city: estimate.city,
    items,
  };
}

export async function addBoqToCart(userId: string, id: string, input: BoqCartInput) {
  const estimate = await loadMaterialLines(userId, id);
  const lineById = new Map(estimate.lines.map((l) => [l.id, l]));

  const unknown = input.items.filter((i) => !lineById.has(i.lineId));
  if (unknown.length) {
    // Also covers another user's line ids: they are simply not in this estimate.
    throw new NotFoundError("Estimate line");
  }

  const offers = await bestOffers([
    ...new Set(input.items.map((i) => lineById.get(i.lineId)!.productId!)),
  ]);

  const added: string[] = [];
  const failed: Array<{ lineId: string; label: string; reason: string }> = [];

  // Sequential on purpose: each addItem reads and writes the same cart row.
  for (const item of input.items) {
    const line = lineById.get(item.lineId)!;
    const offer = offers.get(line.productId!);

    if (!offer) {
      failed.push({ lineId: line.id, label: line.label, reason: "Currently out of stock" });
      continue;
    }

    try {
      await addItem(userId, offer.variantId, snapQuantity(item.quantity, offer.rules));
      added.push(line.id);
    } catch (error) {
      if (!isAppError(error)) throw error;
      failed.push({ lineId: line.id, label: line.label, reason: error.message });
    }
  }

  return { added, failed };
}
