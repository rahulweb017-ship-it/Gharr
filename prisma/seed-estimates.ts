/**
 * Estimate Engine seed: quantity norms and the Hyderabad price table.
 *
 * Norms are the thumb rules Indian contractors and published BOQ guides use for
 * RCC-framed residential work (per sq ft of built-up area):
 *
 *   cement 0.4 bag · steel 4 kg · sand 1.8 cft (≈0.082 t) · 20 mm aggregate
 *   1.35 cft (≈0.057 t) · bricks 8 · binding wire ≈1% of steel · putty ≈27 sq ft
 *   per kg of wall · emulsion ≈150 sq ft per litre for two coats
 *
 * They are deliberately conservative starting points — the build plan expects
 * them to be refined with real local data. Change a number here and reseed; no
 * code changes are needed.
 *
 * Material prices are NOT typed in: each is the cheapest live offer for the
 * linked catalogue product divided by what one pack covers, so an estimate and
 * the shop can never quote different prices for the same bag of cement.
 */

import {
  type EstimateBucket,
  type EstimateMode,
  type EstimateScope,
  type PrismaClient,
  type QualityTier,
  type QuantityBasis,
  Unit,
} from "@prisma/client";
import { computeEstimate, deriveUnitPricePaise } from "../src/shared/estimate";
import { measuresFor, type EstimateInput } from "../src/shared/contracts/estimate";

const TIERS: QualityTier[] = ["BASIC", "STANDARD", "PREMIUM"];
const CITY = "Hyderabad";

type PerTier<T> = T | Record<QualityTier, T>;
const pick = <T>(value: PerTier<T>, tier: QualityTier): T =>
  typeof value === "object" && value !== null && "BASIC" in (value as object)
    ? (value as Record<QualityTier, T>)[tier]
    : (value as T);

interface ItemDef {
  label: string;
  bucket: EstimateBucket;
  unit: Unit | null;
  /** Catalogue product name the material list buys. */
  product?: PerTier<string>;
  /** Rule units one pack of the product covers. */
  coverage?: PerTier<number>;
  /** Rupees per rule unit, for lines with no product (labour). */
  rupees?: PerTier<number>;
}

const ITEMS: Record<string, ItemDef> = {
  cement: { label: "Cement (OPC 53, 50 kg bags)", bucket: "MATERIALS", unit: Unit.BAG, product: "UltraTech Cement OPC 53 Grade" },
  steel: { label: "TMT steel bars", bucket: "MATERIALS", unit: Unit.KG, product: "Tata Tiscon 550SD TMT Bar 12mm" },
  binding_wire: { label: "Binding wire", bucket: "MATERIALS", unit: Unit.KG, product: "Binding Wire 18 Gauge" },
  sand: { label: "M-Sand", bucket: "MATERIALS", unit: Unit.TONNE, product: "M-Sand (Manufactured Sand)" },
  aggregate: { label: "20 mm aggregate", bucket: "MATERIALS", unit: Unit.TONNE, product: "20mm Crushed Stone Aggregate" },
  bricks: { label: "Red clay bricks", bucket: "MATERIALS", unit: Unit.PIECE, product: "Red Clay Bricks (Class A)" },
  waterproofing: { label: "Integral waterproofing", bucket: "MATERIALS", unit: Unit.LITRE, product: "Dr. Fixit LW+ Integral Waterproofing Compound", coverage: 5 },
  floor_tiles: {
    label: "Floor tiles",
    bucket: "MATERIALS",
    unit: Unit.SQFT,
    product: {
      BASIC: "Somany Anti-Skid Bathroom Tile 300x300mm",
      STANDARD: "Kajaria Vitrified Floor Tile 600x600mm Glossy Ivory",
      PREMIUM: "Kajaria Vitrified Floor Tile 600x600mm Glossy Ivory",
    },
    coverage: { BASIC: 9, STANDARD: 16, PREMIUM: 16 },
  },
  bath_floor_tiles: { label: "Anti-skid floor tiles", bucket: "MATERIALS", unit: Unit.SQFT, product: "Somany Anti-Skid Bathroom Tile 300x300mm", coverage: 9 },
  wall_tiles: { label: "Wall tiles (bath & kitchen dado)", bucket: "MATERIALS", unit: Unit.SQFT, product: "Johnson Ceramic Wall Tile 300x600mm", coverage: 12 },
  tile_adhesive: { label: "Tile adhesive", bucket: "MATERIALS", unit: Unit.KG, product: "Tile Adhesive C1 Grade 20kg", coverage: 20 },
  grout: { label: "Epoxy tile grout", bucket: "MATERIALS", unit: Unit.KG, product: "Epoxy Tile Grout 1kg" },
  putty: { label: "Wall putty", bucket: "MATERIALS", unit: Unit.KG, product: "Wall Putty 20kg", coverage: 20 },
  paint: {
    label: "Emulsion paint (2 coats)",
    bucket: "MATERIALS",
    unit: Unit.LITRE,
    product: {
      BASIC: "Berger Weathercoat Anti-Dust Exterior Paint",
      STANDARD: "Asian Paints Apex Ultima Exterior Emulsion",
      PREMIUM: "Asian Paints Royale Luxury Interior Emulsion",
    },
    coverage: { BASIC: 10, STANDARD: 20, PREMIUM: 20 },
  },
  wiring: { label: "Copper wiring (90 m coils)", bucket: "MATERIALS", unit: Unit.PIECE, product: "Polycab FR PVC Insulated Copper Wire 1.5 sq.mm (90m)" },
  switches: { label: "Modular switches", bucket: "MATERIALS", unit: Unit.PIECE, product: "Anchor Roma Modular Switch 16A" },
  mcb: { label: "Distribution MCB", bucket: "MATERIALS", unit: Unit.PIECE, product: "Havells 32A Double Pole MCB" },
  cpvc: { label: "CPVC water lines (3 m)", bucket: "MATERIALS", unit: Unit.PIECE, product: "Astral CPVC Pipe 1 inch (3m)" },
  drainage: { label: "PVC drainage pipe (3 m)", bucket: "MATERIALS", unit: Unit.PIECE, product: "Supreme PVC Drainage Pipe 4 inch (3m)" },
  wc: { label: "Western closet", bucket: "MATERIALS", unit: Unit.PIECE, product: "Cera Floor-Mounted Western Closet (S-Trap)" },
  basin: { label: "Wash basin", bucket: "MATERIALS", unit: Unit.PIECE, product: "Hindware Wall-Mounted Wash Basin" },
  mixer: { label: "Basin mixer", bucket: "MATERIALS", unit: Unit.PIECE, product: "Jaquar Continental Single Lever Basin Mixer" },
  sink: { label: "Kitchen sink", bucket: "MATERIALS", unit: Unit.PIECE, product: "Parryware Stainless Steel Kitchen Sink (Single Bowl)" },
  plywood: {
    label: "Plywood for cabinets",
    bucket: "MATERIALS",
    unit: Unit.SQFT,
    product: {
      BASIC: "Greenply Commercial MR Plywood 12mm",
      STANDARD: "Greenply Commercial MR Plywood 12mm",
      PREMIUM: "Century Ply Club Prime BWP Plywood 19mm",
    },
  },
  doors: { label: "Flush doors (rooms)", bucket: "MATERIALS", unit: Unit.PIECE, product: "Flush Door 32mm (7 x 3 ft)" },
  doors_bath: { label: "Flush doors (bathrooms)", bucket: "MATERIALS", unit: Unit.PIECE, product: "Flush Door 32mm (7 x 3 ft)" },
  windows: { label: "UPVC windows (4 × 4 ft)", bucket: "MATERIALS", unit: Unit.PIECE, product: "UPVC Sliding Window 4 x 4 ft (2 Track)" },

  labour_civil: { label: "Civil labour (structure & masonry)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 380, STANDARD: 450, PREMIUM: 550 } },
  labour_finishing: { label: "Finishing labour (tiling, paint, MEP)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 110, STANDARD: 140, PREMIUM: 190 } },
  labour_bathroom: { label: "Bathroom labour (demolition, plumbing, tiling)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 300, STANDARD: 380, PREMIUM: 500 } },
  labour_kitchen: { label: "Kitchen labour (civil, carpentry, tiling)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 350, STANDARD: 450, PREMIUM: 600 } },
  labour_flooring: { label: "Flooring labour (laying & finishing)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 35, STANDARD: 45, PREMIUM: 60 } },
  labour_painting: { label: "Painting labour (per sq ft of wall)", bucket: "LABOUR", unit: Unit.SQFT, rupees: { BASIC: 12, STANDARD: 16, PREMIUM: 22 } },
};

/** Percentage lines carry no price row; their label and bucket live on the rule. */
const PERCENT_ITEMS: Record<string, { label: string; bucket: EstimateBucket }> = {
  sundries: { label: "Sundry materials & hardware", bucket: "MATERIALS" },
  design_approvals: { label: "Design, drawings & approvals", bucket: "OTHER" },
  contingency: { label: "Contingency", bucket: "OTHER" },
};

interface RuleDef {
  itemKey: string;
  basis: QuantityBasis;
  qty: PerTier<number>;
  wastage?: number;
  /** Tiers this line applies to; all by default. */
  tiers?: QualityTier[];
}

const RULES: Array<{ mode: EstimateMode; scope: EstimateScope; rules: RuleDef[] }> = [
  {
    mode: "NEW_BUILD",
    scope: "WHOLE_HOUSE",
    rules: [
      { itemKey: "cement", basis: "BUILTUP_SQFT", qty: 0.4 },
      { itemKey: "steel", basis: "BUILTUP_SQFT", qty: 4 },
      { itemKey: "binding_wire", basis: "BUILTUP_SQFT", qty: 0.04 },
      { itemKey: "sand", basis: "BUILTUP_SQFT", qty: 0.082 },
      { itemKey: "aggregate", basis: "BUILTUP_SQFT", qty: 0.057 },
      { itemKey: "bricks", basis: "BUILTUP_SQFT", qty: 8, wastage: 5 },
      { itemKey: "waterproofing", basis: "BUILTUP_SQFT", qty: 0.08 },
      { itemKey: "floor_tiles", basis: "FLOOR_SQFT", qty: 1, wastage: 8 },
      { itemKey: "wall_tiles", basis: "PER_BATHROOM", qty: 150, wastage: 8 },
      { itemKey: "tile_adhesive", basis: "PER_BATHROOM", qty: 75 },
      { itemKey: "putty", basis: "WALL_SQFT", qty: 0.037 },
      { itemKey: "paint", basis: "WALL_SQFT", qty: 0.0075, wastage: 5 },
      { itemKey: "wiring", basis: "BUILTUP_SQFT", qty: 0.0067 },
      { itemKey: "switches", basis: "PER_ROOM", qty: 8 },
      { itemKey: "mcb", basis: "PER_FLOOR", qty: 1 },
      { itemKey: "cpvc", basis: "PER_BATHROOM", qty: 12 },
      { itemKey: "drainage", basis: "PER_BATHROOM", qty: 4 },
      { itemKey: "wc", basis: "PER_BATHROOM", qty: 1 },
      { itemKey: "basin", basis: "PER_BATHROOM", qty: 1 },
      { itemKey: "mixer", basis: "PER_BATHROOM", qty: 1, tiers: ["STANDARD", "PREMIUM"] },
      { itemKey: "sink", basis: "FIXED", qty: 1 },
      { itemKey: "doors", basis: "PER_ROOM", qty: 1 },
      { itemKey: "doors_bath", basis: "PER_BATHROOM", qty: 1 },
      { itemKey: "windows", basis: "PER_ROOM", qty: 2 },
      { itemKey: "sundries", basis: "PERCENT_OF_SUBTOTAL", qty: { BASIC: 10, STANDARD: 12, PREMIUM: 18 } },
      { itemKey: "labour_civil", basis: "BUILTUP_SQFT", qty: 1 },
      { itemKey: "labour_finishing", basis: "BUILTUP_SQFT", qty: 1 },
      { itemKey: "design_approvals", basis: "PERCENT_OF_SUBTOTAL", qty: { BASIC: 4, STANDARD: 5, PREMIUM: 6 } },
      { itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", qty: 8 },
    ],
  },
  {
    mode: "RENOVATION",
    scope: "BATHROOM",
    rules: [
      { itemKey: "bath_floor_tiles", basis: "FLOOR_SQFT", qty: 1, wastage: 8 },
      // Walls of a bathroom tiled to 7 ft are roughly 4× its floor area.
      { itemKey: "wall_tiles", basis: "FLOOR_SQFT", qty: 4, wastage: 8 },
      { itemKey: "tile_adhesive", basis: "FLOOR_SQFT", qty: 2.5 },
      { itemKey: "grout", basis: "FLOOR_SQFT", qty: 0.03 },
      { itemKey: "waterproofing", basis: "FLOOR_SQFT", qty: 0.1 },
      { itemKey: "cpvc", basis: "FIXED", qty: 6 },
      { itemKey: "drainage", basis: "FIXED", qty: 2 },
      { itemKey: "wc", basis: "PER_BATHROOM", qty: 1 },
      { itemKey: "basin", basis: "PER_BATHROOM", qty: 1 },
      { itemKey: "mixer", basis: "PER_BATHROOM", qty: 1, tiers: ["STANDARD", "PREMIUM"] },
      { itemKey: "labour_bathroom", basis: "FLOOR_SQFT", qty: 1 },
      { itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", qty: 10 },
    ],
  },
  {
    mode: "RENOVATION",
    scope: "KITCHEN",
    rules: [
      { itemKey: "floor_tiles", basis: "FLOOR_SQFT", qty: 1, wastage: 8 },
      { itemKey: "wall_tiles", basis: "FLOOR_SQFT", qty: 1.2, wastage: 8 },
      { itemKey: "tile_adhesive", basis: "FLOOR_SQFT", qty: 1.1 },
      { itemKey: "plywood", basis: "FLOOR_SQFT", qty: 1.5, wastage: 10 },
      { itemKey: "sink", basis: "FIXED", qty: 1 },
      { itemKey: "cpvc", basis: "FIXED", qty: 4 },
      { itemKey: "switches", basis: "FIXED", qty: 6 },
      { itemKey: "wiring", basis: "FIXED", qty: 1 },
      { itemKey: "labour_kitchen", basis: "FLOOR_SQFT", qty: 1 },
      { itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", qty: 10 },
    ],
  },
  {
    mode: "RENOVATION",
    scope: "FLOORING",
    rules: [
      { itemKey: "floor_tiles", basis: "FLOOR_SQFT", qty: 1, wastage: 8 },
      { itemKey: "tile_adhesive", basis: "FLOOR_SQFT", qty: 0.5, wastage: 5 },
      { itemKey: "grout", basis: "FLOOR_SQFT", qty: 0.01, tiers: ["PREMIUM"] },
      { itemKey: "labour_flooring", basis: "FLOOR_SQFT", qty: 1 },
      { itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", qty: 8 },
    ],
  },
  {
    mode: "RENOVATION",
    scope: "PAINTING",
    rules: [
      { itemKey: "putty", basis: "WALL_SQFT", qty: 0.037, tiers: ["STANDARD", "PREMIUM"] },
      { itemKey: "paint", basis: "WALL_SQFT", qty: 0.0075, wastage: 5 },
      { itemKey: "labour_painting", basis: "WALL_SQFT", qty: 1 },
      { itemKey: "contingency", basis: "PERCENT_OF_SUBTOTAL", qty: 5 },
    ],
  },
];

export async function seedEstimates(prisma: PrismaClient, demoUserId?: string) {
  await prisma.estimateLine.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.estimatePrice.deleteMany();
  await prisma.estimateRule.deleteMany();

  // --- Rules ---
  let ruleCount = 0;
  for (const group of RULES) {
    for (const tier of TIERS) {
      const rows = group.rules
        .filter((r) => !r.tiers || r.tiers.includes(tier))
        .map((r, index) => {
          const percent = PERCENT_ITEMS[r.itemKey];
          const item = ITEMS[r.itemKey];
          if (!percent && !item) throw new Error(`Estimate rule references unknown item: ${r.itemKey}`);
          return {
            mode: group.mode,
            scope: group.scope,
            tier,
            itemKey: r.itemKey,
            label: percent?.label ?? item.label,
            bucket: percent?.bucket ?? item.bucket,
            basis: r.basis,
            quantityPerBasis: pick(r.qty, tier),
            unit: percent ? null : item.unit,
            wastagePercent: r.wastage ?? 0,
            sortOrder: (index + 1) * 10,
          };
        });
      await prisma.estimateRule.createMany({ data: rows });
      ruleCount += rows.length;
    }
  }

  // --- Prices ---
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      variants: {
        where: { isActive: true },
        orderBy: { pricePaise: "asc" },
        take: 1,
        select: { pricePaise: true },
      },
    },
  });
  const productByName = new Map(products.map((p) => [p.name, p]));

  const priceRows = [];
  for (const [itemKey, item] of Object.entries(ITEMS)) {
    for (const tier of TIERS) {
      if (item.product) {
        const name = pick(item.product, tier);
        const product = productByName.get(name);
        const cheapest = product?.variants[0];
        if (!product || !cheapest) throw new Error(`Estimate item ${itemKey} links to missing product: ${name}`);
        const coverage = pick(item.coverage ?? 1, tier);
        priceRows.push({
          city: CITY,
          tier,
          itemKey,
          unitPricePaise: deriveUnitPricePaise(cheapest.pricePaise, coverage),
          productId: product.id,
          packCoverage: coverage,
        });
      } else if (item.rupees != null) {
        priceRows.push({
          city: CITY,
          tier,
          itemKey,
          unitPricePaise: Math.round(pick(item.rupees, tier) * 100),
          productId: null,
          packCoverage: 1,
        });
      } else {
        throw new Error(`Estimate item ${itemKey} has neither a product nor a price`);
      }
    }
  }
  await prisma.estimatePrice.createMany({ data: priceRows });

  console.log(`  ${ruleCount} estimate rules / ${priceRows.length} ${CITY} prices`);

  if (demoUserId) await seedDemoEstimate(prisma, demoUserId);
}

/** One saved estimate, computed by the same shared engine the API uses. */
async function seedDemoEstimate(prisma: PrismaClient, userId: string) {
  const input: EstimateInput = {
    mode: "NEW_BUILD",
    title: "My Dream Home",
    city: CITY,
    tier: "STANDARD",
    plotSqft: 1200,
    builtUpSqft: 1800,
    floors: 2,
    rooms: 3,
    bathrooms: 3,
  };

  const [rules, prices] = await Promise.all([
    prisma.estimateRule.findMany({ where: { mode: "NEW_BUILD", scope: "WHOLE_HOUSE", tier: "STANDARD", isActive: true } }),
    prisma.estimatePrice.findMany({ where: { city: CITY, tier: "STANDARD" } }),
  ]);

  const result = computeEstimate(
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

  await prisma.estimate.create({
    data: {
      userId,
      title: input.title,
      mode: input.mode,
      scope: "WHOLE_HOUSE",
      tier: input.tier,
      city: input.city,
      inputs: input,
      materialsPaise: result.materialsPaise,
      labourPaise: result.labourPaise,
      otherPaise: result.otherPaise,
      totalPaise: result.totalPaise,
      lines: { create: result.lines },
    },
  });

  console.log(`  1 demo estimate (₹${Math.round(result.totalPaise / 100).toLocaleString("en-IN")} for 1,800 sq ft)`);
}
