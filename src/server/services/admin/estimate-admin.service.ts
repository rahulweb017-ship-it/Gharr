import type { EstimateMode, EstimateScope, QualityTier } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/server/auth/session";
import { type RequestMeta, writeAudit } from "@/server/audit";
import { NotFoundError, ValidationError } from "@/server/http/errors";
import { deriveUnitPricePaise } from "@/shared/estimate";
import { requireStaff } from "./guard";
import { changedFields } from "./catalog-admin-rules";

/**
 * Admin editing of the Estimate Engine's rule and price tables.
 *
 * These tables feed NEW estimates only: a saved estimate's lines are a snapshot
 * (EstimateLine copies quantity and unit price), so nothing here rewrites a
 * customer's saved figures.
 *
 * Material prices are meant to track the shop. "Sync from shop" re-derives each
 * product-linked price as cheapest live offer ÷ pack coverage, via the same
 * `deriveUnitPricePaise` the seed uses. Unlinked rows (labour, fees) are manual.
 */

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** The rule sets that exist, so the selector can offer only real combinations. */
export async function listRuleSets(actor: Actor | null) {
  await requireStaff(actor, "ADMIN");
  const groups = await prisma.estimateRule.groupBy({
    by: ["mode", "scope", "tier"],
    _count: { _all: true },
    orderBy: [{ mode: "asc" }, { scope: "asc" }, { tier: "asc" }],
  });
  return groups.map((g) => ({ mode: g.mode, scope: g.scope, tier: g.tier, count: g._count._all }));
}

export async function listRules(
  actor: Actor | null,
  set: { mode: EstimateMode; scope: EstimateScope; tier: QualityTier },
) {
  await requireStaff(actor, "ADMIN");
  const rules = await prisma.estimateRule.findMany({
    where: set,
    orderBy: [{ sortOrder: "asc" }, { itemKey: "asc" }],
  });
  return rules.map((r) => ({
    id: r.id,
    itemKey: r.itemKey,
    label: r.label,
    bucket: r.bucket,
    basis: r.basis,
    quantityPerBasis: Number(r.quantityPerBasis),
    unit: r.unit,
    wastagePercent: Number(r.wastagePercent),
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

export type AdminRuleRow = Awaited<ReturnType<typeof listRules>>[number];

export interface RuleUpdateInput {
  label?: string;
  quantityPerBasis?: number;
  wastagePercent?: number;
  isActive?: boolean;
}

export async function updateRule(actor: Actor | null, id: string, input: RuleUpdateInput, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");

  const errors: Array<{ field: string; message: string }> = [];
  if (input.label !== undefined && input.label.trim().length < 2) {
    errors.push({ field: "label", message: "Label is too short" });
  }
  if (input.quantityPerBasis !== undefined && !(input.quantityPerBasis > 0)) {
    errors.push({ field: "quantityPerBasis", message: "Quantity per basis must be greater than 0" });
  }
  if (input.wastagePercent !== undefined && !(input.wastagePercent >= 0 && input.wastagePercent <= 100)) {
    errors.push({ field: "wastagePercent", message: "Wastage must be between 0 and 100%" });
  }
  if (errors.length) throw new ValidationError(errors[0].message, errors);

  return prisma.$transaction(async (tx) => {
    const rule = await tx.estimateRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundError("Estimate rule");

    const before = {
      label: rule.label,
      quantityPerBasis: Number(rule.quantityPerBasis),
      wastagePercent: Number(rule.wastagePercent),
      isActive: rule.isActive,
    };
    const change = changedFields(before, {
      label: input.label?.trim(),
      quantityPerBasis: input.quantityPerBasis,
      wastagePercent: input.wastagePercent,
      isActive: input.isActive,
    });
    if (!change.changed) return { id, ...before, changed: false };

    await tx.estimateRule.update({ where: { id }, data: change.after });
    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "estimate.rule_update",
      entityType: "EstimateRule",
      entityId: id,
      before: { itemKey: rule.itemKey, mode: rule.mode, scope: rule.scope, tier: rule.tier, ...change.before },
      after: change.after,
      ...meta,
    });
    return { id, ...before, ...change.after, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/**
 * Cheapest live offer per product — the same definition the material list
 * uses: an active variant, in stock, from an active vendor.
 */
async function cheapestLiveOffers(productIds: string[]) {
  const best = new Map<string, number>();
  if (productIds.length === 0) return best;
  const variants = await prisma.productVariant.findMany({
    where: {
      productId: { in: productIds },
      isActive: true,
      inventory: { quantityAvailable: { gt: 0 } },
      vendor: { isActive: true },
    },
    orderBy: { pricePaise: "asc" },
    select: { productId: true, pricePaise: true },
  });
  for (const v of variants) if (!best.has(v.productId)) best.set(v.productId, v.pricePaise);
  return best;
}

/** Live derived price for a row, or why there is none. */
function liveDerived(
  row: { productId: string | null; packCoverage: number; product: { isActive: boolean } | null },
  offers: Map<string, number>,
): { pricePaise: number } | { reason: string } {
  if (!row.productId || !row.product) return { reason: "No linked product (manual price)" };
  if (!row.product.isActive) return { reason: "Linked product is inactive" };
  if (!(row.packCoverage > 0)) return { reason: "Pack coverage must be greater than 0" };
  const packPrice = offers.get(row.productId);
  if (packPrice == null) return { reason: "No active in-stock offer" };
  return { pricePaise: deriveUnitPricePaise(packPrice, row.packCoverage) };
}

export async function listPriceCities(actor: Actor | null) {
  await requireStaff(actor, "ADMIN");
  const rows = await prisma.estimatePrice.findMany({ distinct: ["city"], select: { city: true }, orderBy: { city: "asc" } });
  return rows.map((r) => r.city);
}

export async function listPrices(actor: Actor | null, set: { city: string; tier: QualityTier }) {
  await requireStaff(actor, "ADMIN");
  const [prices, rules] = await Promise.all([
    prisma.estimatePrice.findMany({
      where: set,
      orderBy: { itemKey: "asc" },
      include: { product: { select: { id: true, name: true, isActive: true } } },
    }),
    // The unit a price is "per" is defined by the rules that use the item.
    prisma.estimateRule.findMany({
      where: { tier: set.tier },
      select: { itemKey: true, unit: true, label: true },
      orderBy: { mode: "asc" },
    }),
  ]);
  const ruleByItem = new Map<string, { unit: (typeof rules)[number]["unit"]; label: string }>();
  for (const r of rules) if (!ruleByItem.has(r.itemKey)) ruleByItem.set(r.itemKey, { unit: r.unit, label: r.label });

  const offers = await cheapestLiveOffers(prices.flatMap((p) => (p.productId ? [p.productId] : [])));

  return prices.map((p) => {
    const packCoverage = Number(p.packCoverage);
    const live = liveDerived({ productId: p.productId, packCoverage, product: p.product }, offers);
    const livePricePaise = "pricePaise" in live ? live.pricePaise : null;
    return {
      id: p.id,
      itemKey: p.itemKey,
      label: ruleByItem.get(p.itemKey)?.label ?? null,
      unit: ruleByItem.get(p.itemKey)?.unit ?? null,
      unitPricePaise: p.unitPricePaise,
      packCoverage,
      productId: p.productId,
      productName: p.product?.name ?? null,
      livePricePaise,
      liveNote: "reason" in live ? live.reason : null,
      driftPercent: livePricePaise != null ? driftPercent(p.unitPricePaise, livePricePaise) : null,
      updatedAt: p.updatedAt,
    };
  });
}

export type AdminPriceRow = Awaited<ReturnType<typeof listPrices>>[number];

/** Signed % change from the stored price to the live one, to one decimal. */
export function driftPercent(storedPaise: number, livePaise: number): number {
  if (storedPaise === livePaise) return 0;
  if (storedPaise <= 0) return 100;
  return Math.round(((livePaise - storedPaise) / storedPaise) * 1000) / 10;
}

export interface PriceUpdateInput {
  unitPricePaise?: number;
  packCoverage?: number;
}

export async function updatePrice(actor: Actor | null, id: string, input: PriceUpdateInput, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");

  const errors: Array<{ field: string; message: string }> = [];
  if (input.unitPricePaise !== undefined && !(Number.isInteger(input.unitPricePaise) && input.unitPricePaise > 0)) {
    errors.push({ field: "unitPricePaise", message: "Unit price must be a positive whole number of paise" });
  }
  if (input.packCoverage !== undefined && !(input.packCoverage > 0)) {
    errors.push({ field: "packCoverage", message: "Pack coverage must be greater than 0" });
  }
  if (errors.length) throw new ValidationError(errors[0].message, errors);

  return prisma.$transaction(async (tx) => {
    const row = await tx.estimatePrice.findUnique({ where: { id } });
    if (!row) throw new NotFoundError("Estimate price");

    const before = { unitPricePaise: row.unitPricePaise, packCoverage: Number(row.packCoverage) };
    const change = changedFields(before, input);
    if (!change.changed) return { id, ...before, changed: false };

    await tx.estimatePrice.update({ where: { id }, data: change.after });
    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "estimate.price_update",
      entityType: "EstimatePrice",
      entityId: id,
      before: { city: row.city, tier: row.tier, itemKey: row.itemKey, ...change.before },
      after: change.after,
      ...meta,
    });
    return { id, ...before, ...change.after, changed: true };
  });
}

export interface SyncResult {
  updated: number;
  unchanged: number;
  skipped: Array<{ itemKey: string; tier: QualityTier; reason: string }>;
  changes: Array<{ itemKey: string; tier: QualityTier; fromPaise: number; toPaise: number }>;
}

/**
 * Re-derives every product-linked price in a city (optionally one tier) from
 * the shop. Rows with no live offer keep their last price and are reported as
 * skipped, so an out-of-stock day never zeroes an estimate line.
 */
export async function syncPrices(
  actor: Actor | null,
  input: { city: string; tier?: QualityTier },
  meta: RequestMeta = {},
): Promise<SyncResult> {
  const staff = await requireStaff(actor, "ADMIN");

  const rows = await prisma.estimatePrice.findMany({
    where: { city: input.city, ...(input.tier ? { tier: input.tier } : {}) },
    orderBy: [{ tier: "asc" }, { itemKey: "asc" }],
    include: { product: { select: { isActive: true } } },
  });
  if (rows.length === 0) throw new NotFoundError("Estimate price table");

  const linked = rows.filter((r) => r.productId);
  const offers = await cheapestLiveOffers(linked.map((r) => r.productId!));

  const result: SyncResult = { updated: 0, unchanged: 0, skipped: [], changes: [] };
  const updates: Array<{ id: string; unitPricePaise: number }> = [];

  for (const row of linked) {
    const live = liveDerived({ productId: row.productId, packCoverage: Number(row.packCoverage), product: row.product }, offers);
    if ("reason" in live) {
      result.skipped.push({ itemKey: row.itemKey, tier: row.tier, reason: live.reason });
    } else if (live.pricePaise === row.unitPricePaise) {
      result.unchanged += 1;
    } else {
      updates.push({ id: row.id, unitPricePaise: live.pricePaise });
      result.changes.push({ itemKey: row.itemKey, tier: row.tier, fromPaise: row.unitPricePaise, toPaise: live.pricePaise });
    }
  }
  result.updated = updates.length;

  await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.estimatePrice.update({ where: { id: u.id }, data: { unitPricePaise: u.unitPricePaise } });
    }
    // One summary row per sync: the individual changes are in `after`.
    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "estimate.price_sync",
      entityType: "EstimatePrice",
      entityId: input.tier ? `${input.city}:${input.tier}` : input.city,
      before: { changes: result.changes.map((c) => ({ itemKey: c.itemKey, tier: c.tier, unitPricePaise: c.fromPaise })) },
      after: {
        city: input.city,
        tier: input.tier ?? "ALL",
        updated: result.updated,
        unchanged: result.unchanged,
        skipped: result.skipped,
        changes: result.changes.map((c) => ({ itemKey: c.itemKey, tier: c.tier, unitPricePaise: c.toPaise })),
      },
      ...meta,
    });
  });

  return result;
}
