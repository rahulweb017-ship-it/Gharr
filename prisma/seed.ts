/**
 * Gharr development seed.
 *
 * Produces a believable single-city marketplace (Hyderabad) rather than lorem
 * ipsum: real brand names, real trade rates, real GST slabs and real MOQ rules.
 * Demo data that lies about the domain hides exactly the bugs that matter —
 * a cement bag that can be bought one at a time, or sand priced per piece.
 *
 * Run:  npm run db:seed
 * Reset and reseed:  npm run db:reset
 */

import {
  AvailabilityExceptionType,
  CouponScope,
  CouponType,
  DeliveryMode,
  PrismaClient,
  Role,
  Trade,
  Unit,
  VerificationStatus,
} from "@prisma/client";

import { seedEstimates } from "./seed-estimates";
import { seedAdminDemo } from "./seed-admin";

const prisma = new PrismaClient();

/** Authoring helper — seed data is written in rupees and stored in paise. */
const rs = (rupees: number) => Math.round(rupees * 100);

/** Deterministic placeholder imagery, so reseeding does not reshuffle the UI. */
const img = (seed: string, w = 800, h = 800) =>
  `https://picsum.photos/seed/gharr-${seed}/${w}/${h}`;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// ---------------------------------------------------------------------------
// Categories — the 15 material categories from the blueprint
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { name: "Cement & Concrete", iconKey: "cement" },
  { name: "Bricks & Blocks", iconKey: "bricks" },
  { name: "Steel & TMT", iconKey: "steel" },
  { name: "Sand & Aggregate", iconKey: "sand" },
  { name: "Tiles & Flooring", iconKey: "tiles" },
  { name: "Paint & Waterproofing", iconKey: "paint" },
  { name: "Electrical", iconKey: "electrical" },
  { name: "Plumbing", iconKey: "plumbing" },
  { name: "Sanitaryware", iconKey: "sanitary" },
  { name: "Hardware & Tools", iconKey: "tools" },
  { name: "Plywood & Boards", iconKey: "plywood" },
  { name: "Doors & Windows", iconKey: "doors" },
  { name: "False Ceiling & POP", iconKey: "ceiling" },
  { name: "Adhesives & Chemicals", iconKey: "adhesives" },
  { name: "Home Repair Essentials", iconKey: "repair" },
];

const BRANDS = [
  "UltraTech", "ACC", "Ambuja", "Dalmia Bharat", "JK Cement", "Shree Cement",
  "Tata Tiscon", "JSW Steel", "SAIL", "Kamdhenu",
  "Asian Paints", "Berger", "Nerolac", "Dulux", "Dr. Fixit",
  "Kajaria", "Somany", "Nitco", "Johnson",
  "Havells", "Polycab", "Finolex", "Anchor", "Legrand",
  "Astral", "Supreme", "Prince", "Ashirvad",
  "Jaquar", "Cera", "Hindware", "Parryware",
  "Century Ply", "Greenply", "Action Tesa",
  "Fevicol", "Bosch", "Stanley", "Taparia", "Gyproc",
];

// ---------------------------------------------------------------------------
// Vendors — eight Hyderabad building-material suppliers
// ---------------------------------------------------------------------------

const VENDORS = [
  {
    businessName: "Sri Balaji Building Materials",
    area: "Kukatpally", pincode: "500072", phone: "+919848012345",
    baseDeliveryFee: rs(250), perKmFee: rs(18), freeAbove: rs(25000),
    maxKm: 30, minOrder: rs(2000), rating: 4.5, ratingCount: 312,
  },
  {
    businessName: "Hyderabad Cement Depot",
    area: "Miyapur", pincode: "500049", phone: "+919848023456",
    baseDeliveryFee: rs(300), perKmFee: rs(20), freeAbove: rs(30000),
    maxKm: 35, minOrder: rs(3000), rating: 4.3, ratingCount: 198,
  },
  {
    businessName: "Deccan Steel & Hardware",
    area: "Secunderabad", pincode: "500003", phone: "+919848034567",
    baseDeliveryFee: rs(400), perKmFee: rs(22), freeAbove: rs(50000),
    maxKm: 40, minOrder: rs(5000), rating: 4.6, ratingCount: 421,
  },
  {
    businessName: "Charminar Tiles & Sanitary",
    area: "Malakpet", pincode: "500036", phone: "+919848045678",
    baseDeliveryFee: rs(200), perKmFee: rs(15), freeAbove: rs(20000),
    maxKm: 25, minOrder: rs(1500), rating: 4.2, ratingCount: 267,
  },
  {
    businessName: "Sai Electricals & Plumbing",
    area: "Ameerpet", pincode: "500016", phone: "+919848056789",
    baseDeliveryFee: rs(120), perKmFee: rs(12), freeAbove: rs(8000),
    maxKm: 20, minOrder: rs(500), rating: 4.4, ratingCount: 534,
  },
  {
    businessName: "Telangana Timber & Plywood",
    area: "Balanagar", pincode: "500037", phone: "+919848067890",
    baseDeliveryFee: rs(350), perKmFee: rs(20), freeAbove: rs(35000),
    maxKm: 30, minOrder: rs(4000), rating: 4.1, ratingCount: 143,
  },
  {
    businessName: "Nizam Paints & Chemicals",
    area: "Mehdipatnam", pincode: "500028", phone: "+919848078901",
    baseDeliveryFee: rs(150), perKmFee: rs(14), freeAbove: rs(10000),
    maxKm: 22, minOrder: rs(800), rating: 4.5, ratingCount: 389,
  },
  {
    businessName: "Godavari Sand & Aggregates",
    area: "Uppal", pincode: "500039", phone: "+919848089012",
    baseDeliveryFee: rs(800), perKmFee: rs(35), freeAbove: rs(60000),
    maxKm: 50, minOrder: rs(8000), rating: 4.0, ratingCount: 96,
  },
];

// ---------------------------------------------------------------------------
// Products
//
// `offers` lists which vendors stock the item and at what price, which is what
// produces multi-seller product pages and multi-vendor carts.
// ---------------------------------------------------------------------------

interface SeedOffer {
  vendor: number;
  price: number;
  mrp: number;
  stock: number;
  /** Overrides the product default when a vendor sells a different pack. */
  label?: string;
  moq?: number;
  step?: number;
  deliveryMode?: DeliveryMode;
  leadTimeDays?: number;
}

interface SeedProduct {
  name: string;
  category: string;
  brand: string;
  unit: Unit;
  packSize: number;
  label: string;
  moq: number;
  step?: number;
  taxRate: number;
  weightKg?: number;
  deliveryMode?: DeliveryMode;
  short: string;
  description: string;
  specs: Record<string, string>;
  hsn: string;
  popularity: number;
  offers: SeedOffer[];
}

const PRODUCTS: SeedProduct[] = [
  // --- Cement & Concrete ---------------------------------------------------
  {
    name: "UltraTech Cement OPC 53 Grade",
    category: "Cement & Concrete", brand: "UltraTech",
    unit: Unit.BAG, packSize: 50, label: "50 kg bag", moq: 10, step: 5,
    taxRate: 28, weightKg: 50, deliveryMode: DeliveryMode.SCHEDULED,
    short: "High-strength OPC 53 cement for structural concrete work.",
    description:
      "Ordinary Portland Cement, 53 grade, suited to RCC columns, beams, slabs and other load-bearing structural work. Delivers high early strength and consistent setting. Store on a raised platform away from moisture and use within 90 days of manufacture.",
    specs: { Grade: "OPC 53", Standard: "IS 269:2015", "Compressive strength": "53 MPa at 28 days", "Initial setting": "30 minutes", "Bag weight": "50 kg" },
    hsn: "2523", popularity: 980,
    offers: [
      { vendor: 0, price: rs(385), mrp: rs(420), stock: 2400 },
      { vendor: 1, price: rs(379), mrp: rs(420), stock: 3600 },
      { vendor: 2, price: rs(392), mrp: rs(420), stock: 850 },
    ],
  },
  {
    name: "ACC Gold Water Shield PPC Cement",
    category: "Cement & Concrete", brand: "ACC",
    unit: Unit.BAG, packSize: 50, label: "50 kg bag", moq: 10, step: 5,
    taxRate: 28, weightKg: 50, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Water-repellent PPC cement for plastering and masonry.",
    description:
      "Portland Pozzolana Cement with a water-repelling additive, intended for plastering, brickwork and general non-structural concrete. Improves workability and reduces surface cracking in Hyderabad's dry summers.",
    specs: { Grade: "PPC", Standard: "IS 1489-1:2015", Application: "Plaster, masonry, general concrete", "Bag weight": "50 kg" },
    hsn: "2523", popularity: 870,
    offers: [
      { vendor: 0, price: rs(368), mrp: rs(405), stock: 1800 },
      { vendor: 1, price: rs(362), mrp: rs(405), stock: 2900 },
    ],
  },
  {
    name: "Ambuja Plus Roof Special Cement",
    category: "Cement & Concrete", brand: "Ambuja",
    unit: Unit.BAG, packSize: 50, label: "50 kg bag", moq: 10, step: 5,
    taxRate: 28, weightKg: 50, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Cement formulated for roof slabs and reduced shrinkage cracking.",
    description:
      "Blended cement engineered for roof casting, offering lower heat of hydration and reduced shrinkage. Recommended where slabs are exposed to direct sun during curing.",
    specs: { Grade: "PPC", Standard: "IS 1489-1:2015", Application: "Roof slab casting", "Bag weight": "50 kg" },
    hsn: "2523", popularity: 610,
    offers: [{ vendor: 1, price: rs(395), mrp: rs(430), stock: 1200 }],
  },
  {
    name: "JK Cement Ready-Mix Plaster",
    category: "Cement & Concrete", brand: "JK Cement",
    unit: Unit.BAG, packSize: 40, label: "40 kg bag", moq: 5, step: 5,
    taxRate: 28, weightKg: 40,
    short: "Pre-mixed plaster needing only water — no site sand required.",
    description:
      "Factory-blended plaster of cement, graded sand and polymers. Mixes with water alone, removing sand screening and river-sand sourcing from the job. Covers roughly 20 sq.ft per bag at 12 mm thickness.",
    specs: { "Bag weight": "40 kg", Coverage: "~20 sq.ft at 12 mm", Mixing: "Water only", "Shelf life": "6 months" },
    hsn: "3824", popularity: 520,
    offers: [
      { vendor: 0, price: rs(340), mrp: rs(375), stock: 640 },
      { vendor: 6, price: rs(348), mrp: rs(375), stock: 410 },
    ],
  },

  // --- Bricks & Blocks -----------------------------------------------------
  {
    name: "Red Clay Bricks (Class A)",
    category: "Bricks & Blocks", brand: "Kamdhenu",
    unit: Unit.PIECE, packSize: 1, label: "Per brick", moq: 500, step: 100,
    taxRate: 5, weightKg: 3.2, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Table-moulded Class A clay bricks for load-bearing walls.",
    description:
      "First-class table-moulded burnt clay bricks with uniform edges and minimal breakage. Suitable for load-bearing and partition walls. Sold loose; delivery is by tipper with a minimum of 500 bricks.",
    specs: { Size: "230 x 110 x 75 mm", Class: "Class A (first class)", "Compressive strength": "> 7.5 N/mm²", "Water absorption": "< 15%" },
    hsn: "6904", popularity: 750,
    offers: [
      { vendor: 0, price: rs(9.5), mrp: rs(11), stock: 80000 },
      { vendor: 7, price: rs(8.9), mrp: rs(11), stock: 150000 },
    ],
  },
  {
    name: "AAC Lightweight Block 600x200x150mm",
    category: "Bricks & Blocks", brand: "Kamdhenu",
    unit: Unit.PIECE, packSize: 1, label: "600 x 200 x 150 mm", moq: 100, step: 25,
    taxRate: 18, weightKg: 12, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Autoclaved aerated concrete blocks — lighter walls, faster work.",
    description:
      "AAC blocks weigh roughly a third of equivalent brickwork, cutting dead load on the structure and speeding up wall construction. Good thermal insulation, which measurably reduces cooling load in Hyderabad summers.",
    specs: { Size: "600 x 200 x 150 mm", Density: "550-650 kg/m³", "Thermal conductivity": "0.16 W/mK", "Fire rating": "4 hours" },
    hsn: "6810", popularity: 480,
    offers: [{ vendor: 0, price: rs(62), mrp: rs(72), stock: 6500 }],
  },
  {
    name: "Solid Concrete Block 400x200x150mm",
    category: "Bricks & Blocks", brand: "Kamdhenu",
    unit: Unit.PIECE, packSize: 1, label: "400 x 200 x 150 mm", moq: 100, step: 50,
    taxRate: 18, weightKg: 18, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Dense concrete blocks for boundary walls and load-bearing work.",
    description:
      "Machine-pressed solid concrete blocks offering high compressive strength for compound walls, retaining walls and load-bearing masonry.",
    specs: { Size: "400 x 200 x 150 mm", "Compressive strength": "> 4 N/mm²", Type: "Solid" },
    hsn: "6810", popularity: 390,
    offers: [{ vendor: 7, price: rs(38), mrp: rs(45), stock: 9200 }],
  },

  // --- Steel & TMT ---------------------------------------------------------
  {
    name: "Tata Tiscon 550SD TMT Bar 12mm",
    category: "Steel & TMT", brand: "Tata Tiscon",
    unit: Unit.KG, packSize: 1, label: "12 mm — per kg", moq: 100, step: 10,
    taxRate: 18, weightKg: 1, deliveryMode: DeliveryMode.SCHEDULED,
    short: "High-ductility TMT reinforcement bar for columns and beams.",
    description:
      "Fe 550SD thermo-mechanically treated bar with superior ductility for seismic resistance. The 12 mm diameter is the workhorse size for columns and beams in residential construction. One 12 m length weighs about 10.6 kg.",
    specs: { Grade: "Fe 550SD", Diameter: "12 mm", Standard: "IS 1786:2008", "Length": "12 m", "Weight per metre": "0.888 kg" },
    hsn: "7214", popularity: 920,
    offers: [
      { vendor: 2, price: rs(62), mrp: rs(70), stock: 45000 },
      { vendor: 0, price: rs(64.5), mrp: rs(70), stock: 18000 },
    ],
  },
  {
    name: "JSW Neosteel 550D TMT Bar 16mm",
    category: "Steel & TMT", brand: "JSW Steel",
    unit: Unit.KG, packSize: 1, label: "16 mm — per kg", moq: 100, step: 10,
    taxRate: 18, weightKg: 1, deliveryMode: DeliveryMode.SCHEDULED,
    short: "16 mm TMT bar for heavily loaded columns and footings.",
    description:
      "Fe 550D grade reinforcement for main columns, footings and long-span beams. Uniform rib pattern gives strong bond with concrete.",
    specs: { Grade: "Fe 550D", Diameter: "16 mm", Standard: "IS 1786:2008", "Weight per metre": "1.58 kg" },
    hsn: "7214", popularity: 700,
    offers: [{ vendor: 2, price: rs(61), mrp: rs(69), stock: 38000 }],
  },
  {
    name: "Binding Wire 18 Gauge",
    category: "Steel & TMT", brand: "SAIL",
    unit: Unit.KG, packSize: 1, label: "Per kg", moq: 5, step: 1,
    taxRate: 18, weightKg: 1,
    short: "Annealed binding wire for tying reinforcement steel.",
    description:
      "Soft annealed mild-steel wire used to tie reinforcement bars at intersections. Roughly 8-10 kg is needed per tonne of reinforcement.",
    specs: { Gauge: "18 SWG", Material: "Mild steel, annealed", Finish: "Black" },
    hsn: "7217", popularity: 340,
    offers: [{ vendor: 2, price: rs(78), mrp: rs(92), stock: 1400 }],
  },

  // --- Sand & Aggregate ----------------------------------------------------
  {
    name: "River Sand (Screened)",
    category: "Sand & Aggregate", brand: "Kamdhenu",
    unit: Unit.TONNE, packSize: 1, label: "Per tonne", moq: 3, step: 1,
    taxRate: 5, weightKg: 1000, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Screened river sand for plastering and concrete work.",
    description:
      "Natural river sand, screened to remove silt and organic matter. Suitable for plastering and concreting. Supplied by tipper; a standard load is 3 tonnes (roughly 100 cft).",
    specs: { Type: "Natural river sand", Zone: "Zone II", "Silt content": "< 3%", "Minimum load": "3 tonnes" },
    hsn: "2505", popularity: 810,
    offers: [{ vendor: 7, price: rs(2350), mrp: rs(2600), stock: 900 }],
  },
  {
    name: "M-Sand (Manufactured Sand)",
    category: "Sand & Aggregate", brand: "Kamdhenu",
    unit: Unit.TONNE, packSize: 1, label: "Per tonne", moq: 3, step: 1,
    taxRate: 5, weightKg: 1000, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Crushed manufactured sand — consistent grading, no silt.",
    description:
      "Crushed-rock sand with controlled particle grading and effectively zero silt. More consistent than river sand and unaffected by seasonal mining restrictions.",
    specs: { Type: "Manufactured sand", Standard: "IS 383:2016", "Silt content": "Nil", "Minimum load": "3 tonnes" },
    hsn: "2517", popularity: 640,
    offers: [{ vendor: 7, price: rs(1850), mrp: rs(2100), stock: 1500 }],
  },
  {
    name: "20mm Crushed Stone Aggregate",
    category: "Sand & Aggregate", brand: "Kamdhenu",
    unit: Unit.TONNE, packSize: 1, label: "20 mm — per tonne", moq: 3, step: 1,
    taxRate: 5, weightKg: 1000, deliveryMode: DeliveryMode.SCHEDULED,
    short: "20 mm coarse aggregate for structural concrete.",
    description:
      "Crushed granite aggregate, 20 mm nominal size, for RCC slabs, columns and beams. Washed to remove dust.",
    specs: { Size: "20 mm nominal", Standard: "IS 383:2016", Type: "Crushed granite", "Minimum load": "3 tonnes" },
    hsn: "2517", popularity: 580,
    offers: [{ vendor: 7, price: rs(1450), mrp: rs(1650), stock: 2200 }],
  },

  // --- Tiles & Flooring ----------------------------------------------------
  {
    name: "Kajaria Vitrified Floor Tile 600x600mm Glossy Ivory",
    category: "Tiles & Flooring", brand: "Kajaria",
    unit: Unit.BOX, packSize: 16, label: "Box of 4 (16 sq.ft)", moq: 5, step: 1,
    taxRate: 18, weightKg: 22,
    short: "Double-charge vitrified tile with a glossy ivory finish.",
    description:
      "600 x 600 mm double-charge vitrified tiles for living rooms and bedrooms. Low water absorption and high abrasion resistance. Each box covers 16 sq.ft — order about 8% extra for cutting wastage.",
    specs: { Size: "600 x 600 mm", Finish: "Glossy", "Tiles per box": "4", "Coverage per box": "16 sq.ft", "Water absorption": "< 0.5%", Thickness: "9 mm" },
    hsn: "6907", popularity: 690,
    offers: [
      { vendor: 3, price: rs(680), mrp: rs(820), stock: 480 },
      { vendor: 0, price: rs(710), mrp: rs(820), stock: 190 },
    ],
  },
  {
    name: "Somany Anti-Skid Bathroom Tile 300x300mm",
    category: "Tiles & Flooring", brand: "Somany",
    unit: Unit.BOX, packSize: 9, label: "Box of 9 (9 sq.ft)", moq: 3, step: 1,
    taxRate: 18, weightKg: 13,
    short: "Matt anti-skid ceramic tile for bathroom and balcony floors.",
    description:
      "300 x 300 mm ceramic floor tile with a textured anti-skid surface rated for wet areas. Each box covers 9 sq.ft.",
    specs: { Size: "300 x 300 mm", Finish: "Matt anti-skid", "Tiles per box": "9", "Coverage per box": "9 sq.ft", Application: "Bathroom, balcony" },
    hsn: "6907", popularity: 550,
    offers: [{ vendor: 3, price: rs(395), mrp: rs(480), stock: 720 }],
  },
  {
    name: "Johnson Ceramic Wall Tile 300x600mm",
    category: "Tiles & Flooring", brand: "Johnson",
    unit: Unit.BOX, packSize: 6, label: "Box of 6 (12 sq.ft)", moq: 3, step: 1,
    taxRate: 18, weightKg: 16,
    short: "Glazed ceramic wall tile for kitchens and bathrooms.",
    description:
      "300 x 600 mm glazed ceramic wall tile with a stain-resistant surface. Each box covers 12 sq.ft.",
    specs: { Size: "300 x 600 mm", Finish: "Glossy glazed", "Tiles per box": "6", "Coverage per box": "12 sq.ft", Application: "Wall only" },
    hsn: "6907", popularity: 430,
    offers: [{ vendor: 3, price: rs(520), mrp: rs(640), stock: 560 }],
  },

  // --- Paint & Waterproofing ----------------------------------------------
  {
    name: "Asian Paints Apex Ultima Exterior Emulsion",
    category: "Paint & Waterproofing", brand: "Asian Paints",
    unit: Unit.BUCKET, packSize: 20, label: "20 L bucket", moq: 1, step: 1,
    taxRate: 18, weightKg: 26,
    short: "Premium exterior emulsion with a 10-year performance warranty.",
    description:
      "High-build exterior emulsion with dirt-resistance and anti-algal properties, formulated for harsh sun and monsoon exposure. Covers roughly 100-120 sq.ft per litre for two coats on a primed surface.",
    specs: { Coverage: "100-120 sq.ft/L (2 coats)", Finish: "Sheen", Warranty: "10 years", "Pack size": "20 L", "Drying time": "4-6 hours between coats" },
    hsn: "3209", popularity: 720,
    offers: [
      { vendor: 6, price: rs(7850), mrp: rs(9200), stock: 140 },
      { vendor: 0, price: rs(8100), mrp: rs(9200), stock: 45 },
    ],
  },
  {
    name: "Asian Paints Royale Luxury Interior Emulsion",
    category: "Paint & Waterproofing", brand: "Asian Paints",
    unit: Unit.BUCKET, packSize: 20, label: "20 L bucket", moq: 1, step: 1,
    taxRate: 18, weightKg: 25,
    short: "Low-VOC luxury interior emulsion with a soft sheen.",
    description:
      "Premium interior emulsion with a smooth, washable finish and low VOC content. Covers approximately 140-160 sq.ft per litre for two coats.",
    specs: { Coverage: "140-160 sq.ft/L (2 coats)", Finish: "Soft sheen", VOC: "Low", "Pack size": "20 L" },
    hsn: "3209", popularity: 660,
    offers: [{ vendor: 6, price: rs(8900), mrp: rs(10400), stock: 95 }],
  },
  {
    name: "Dr. Fixit LW+ Integral Waterproofing Compound",
    category: "Paint & Waterproofing", brand: "Dr. Fixit",
    unit: Unit.CAN, packSize: 5, label: "5 L can", moq: 2, step: 1,
    taxRate: 18, weightKg: 5.5,
    short: "Liquid admixture that waterproofs concrete and plaster from within.",
    description:
      "Integral waterproofing liquid added to the concrete or plaster mix. Reduces permeability and shrinkage cracking. Dose at 200 ml per 50 kg cement bag.",
    specs: { Dosage: "200 ml per 50 kg cement", Application: "Concrete, plaster, mortar", "Pack size": "5 L" },
    hsn: "3824", popularity: 470,
    offers: [{ vendor: 6, price: rs(680), mrp: rs(790), stock: 320 }],
  },
  {
    name: "Berger Weathercoat Anti-Dust Exterior Paint",
    category: "Paint & Waterproofing", brand: "Berger",
    unit: Unit.BUCKET, packSize: 10, label: "10 L bucket", moq: 1, step: 1,
    taxRate: 18, weightKg: 13,
    short: "Exterior emulsion with a dust-shedding surface.",
    description:
      "Exterior wall paint with a low-tack film that sheds dust with rainfall — useful on roadside elevations.",
    specs: { Coverage: "90-110 sq.ft/L (2 coats)", Finish: "Matt", "Pack size": "10 L" },
    hsn: "3209", popularity: 380,
    offers: [{ vendor: 6, price: rs(3450), mrp: rs(4100), stock: 210 }],
  },

  // --- Electrical ----------------------------------------------------------
  {
    name: "Polycab FR PVC Insulated Copper Wire 1.5 sq.mm (90m)",
    category: "Electrical", brand: "Polycab",
    unit: Unit.PIECE, packSize: 1, label: "90 m coil", moq: 1, step: 1,
    taxRate: 18, weightKg: 1.6,
    short: "Flame-retardant copper wire for lighting circuits.",
    description:
      "1.5 sq.mm single-core flame-retardant copper wire, the standard choice for lighting and fan circuits. 90 metre coil.",
    specs: { "Cross section": "1.5 sq.mm", Conductor: "Electrolytic copper", Insulation: "FR PVC", Length: "90 m", Voltage: "1100 V" },
    hsn: "8544", popularity: 620,
    offers: [
      { vendor: 4, price: rs(1290), mrp: rs(1580), stock: 260 },
      { vendor: 0, price: rs(1340), mrp: rs(1580), stock: 80 },
    ],
  },
  {
    name: "Havells 32A Double Pole MCB",
    category: "Electrical", brand: "Havells",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 0.25,
    short: "Double-pole miniature circuit breaker for heavy appliance circuits.",
    description:
      "32 A double-pole MCB with C-curve tripping, for air-conditioner and geyser circuits. DIN-rail mounted.",
    specs: { Rating: "32 A", Poles: "Double pole", Curve: "C", "Breaking capacity": "10 kA", Mounting: "DIN rail" },
    hsn: "8536", popularity: 510,
    offers: [{ vendor: 4, price: rs(640), mrp: rs(820), stock: 340 }],
  },
  {
    name: "Anchor Roma Modular Switch 16A",
    category: "Electrical", brand: "Anchor",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 5, step: 1,
    taxRate: 18, weightKg: 0.05,
    short: "16 A modular one-way switch, Roma series.",
    description:
      "16 A one-way modular switch compatible with standard Roma plates. Silver-alloy contacts rated for 40,000 operations.",
    specs: { Rating: "16 A", Type: "One-way", Series: "Roma", Colour: "White" },
    hsn: "8536", popularity: 450,
    offers: [{ vendor: 4, price: rs(96), mrp: rs(135), stock: 1800 }],
  },
  {
    name: "Finolex 4 sq.mm Copper Wire (90m)",
    category: "Electrical", brand: "Finolex",
    unit: Unit.PIECE, packSize: 1, label: "90 m coil", moq: 1, step: 1,
    taxRate: 18, weightKg: 4.1,
    short: "4 sq.mm copper wire for air-conditioner and power circuits.",
    description:
      "4 sq.mm flame-retardant copper wire for high-load circuits such as air conditioners and geysers.",
    specs: { "Cross section": "4 sq.mm", Insulation: "FR PVC", Length: "90 m", Voltage: "1100 V" },
    hsn: "8544", popularity: 400,
    offers: [{ vendor: 4, price: rs(3280), mrp: rs(3900), stock: 120 }],
  },

  // --- Plumbing ------------------------------------------------------------
  {
    name: "Astral CPVC Pipe 1 inch (3m)",
    category: "Plumbing", brand: "Astral",
    unit: Unit.PIECE, packSize: 1, label: "3 m length", moq: 5, step: 1,
    taxRate: 18, weightKg: 1.2,
    short: "CPVC pipe rated for hot and cold water supply.",
    description:
      "1 inch CPVC pipe suitable for both hot and cold water lines, rated to 93°C. Sold in 3 metre lengths.",
    specs: { Diameter: '1 inch (25 mm)', Material: "CPVC", "Pressure class": "SDR 11", "Max temperature": "93°C", Length: "3 m" },
    hsn: "3917", popularity: 540,
    offers: [{ vendor: 4, price: rs(485), mrp: rs(590), stock: 460 }],
  },
  {
    name: "Supreme PVC Drainage Pipe 4 inch (3m)",
    category: "Plumbing", brand: "Supreme",
    unit: Unit.PIECE, packSize: 1, label: "3 m length", moq: 3, step: 1,
    taxRate: 18, weightKg: 3.4,
    short: "4 inch PVC pipe for soil and waste drainage lines.",
    description:
      "110 mm PVC drainage pipe for soil, waste and rainwater lines. Ring-fit jointing.",
    specs: { Diameter: "4 inch (110 mm)", Material: "PVC", Type: "SWR", Length: "3 m" },
    hsn: "3917", popularity: 420,
    offers: [{ vendor: 4, price: rs(760), mrp: rs(920), stock: 280 }],
  },
  {
    name: "Jaquar Continental Single Lever Basin Mixer",
    category: "Plumbing", brand: "Jaquar",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 1.8,
    short: "Chrome-finish single-lever basin mixer with a 10-year warranty.",
    description:
      "Single-lever basin mixer in chrome with a ceramic cartridge rated for 500,000 cycles. Includes 450 mm braided connection hoses.",
    specs: { Finish: "Chrome", Cartridge: "35 mm ceramic", Warranty: "10 years", Includes: "2 connection hoses" },
    hsn: "8481", popularity: 460,
    offers: [{ vendor: 3, price: rs(4250), mrp: rs(5400), stock: 85 }],
  },

  // --- Sanitaryware --------------------------------------------------------
  {
    name: "Hindware Wall-Mounted Wash Basin",
    category: "Sanitaryware", brand: "Hindware",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 14,
    short: "Vitreous china wall-hung basin in white.",
    description:
      "Wall-mounted vitreous china wash basin with a single tap hole and overflow. Mounting brackets included.",
    specs: { Material: "Vitreous china", Size: "550 x 400 mm", Colour: "White", "Tap holes": "1", Mounting: "Wall hung" },
    hsn: "6910", popularity: 410,
    offers: [{ vendor: 3, price: rs(2650), mrp: rs(3400), stock: 60 }],
  },
  {
    name: "Cera Floor-Mounted Western Closet (S-Trap)",
    category: "Sanitaryware", brand: "Cera",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 26,
    short: "One-piece floor-mounted WC with soft-close seat.",
    description:
      "Floor-mounted western closet with S-trap outlet and dual-flush cistern. Soft-close seat cover included.",
    specs: { Type: "Floor mounted", Trap: "S-trap, 220 mm", Flush: "Dual flush 3/6 L", Includes: "Soft-close seat" },
    hsn: "6910", popularity: 440,
    offers: [{ vendor: 3, price: rs(7900), mrp: rs(9800), stock: 42 }],
  },
  {
    name: "Parryware Stainless Steel Kitchen Sink (Single Bowl)",
    category: "Sanitaryware", brand: "Parryware",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 6.5,
    short: "304-grade stainless single-bowl sink with drainboard.",
    description:
      "Single-bowl kitchen sink with drainboard in 304-grade stainless steel, satin finish. Waste coupling included.",
    specs: { Material: "SS 304", Size: "37 x 18 inch", Bowls: "1 with drainboard", Finish: "Satin", Thickness: "1.0 mm" },
    hsn: "7324", popularity: 370,
    offers: [{ vendor: 3, price: rs(3850), mrp: rs(4900), stock: 75 }],
  },

  // --- Hardware & Tools ----------------------------------------------------
  {
    name: "Bosch GSB 500W Impact Drill Kit",
    category: "Hardware & Tools", brand: "Bosch",
    unit: Unit.PIECE, packSize: 1, label: "Kit", moq: 1, step: 1,
    taxRate: 18, weightKg: 2.4,
    short: "500 W reversible impact drill with a 100-piece accessory set.",
    description:
      "500 W impact drill with forward/reverse and variable speed, supplied with a 100-piece bit and accessory set. Drills masonry, wood and metal.",
    specs: { Power: "500 W", "No-load speed": "2800 rpm", Chuck: "10 mm keyed", Includes: "100-piece accessory set", Warranty: "1 year" },
    hsn: "8467", popularity: 480,
    offers: [{ vendor: 2, price: rs(3290), mrp: rs(4550), stock: 110 }],
  },
  {
    name: "Taparia Steel Measuring Tape 5m",
    category: "Hardware & Tools", brand: "Taparia",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 0.2,
    short: "5 metre steel measuring tape with auto-lock.",
    description:
      "5 metre steel measuring tape with nylon coating, auto-lock mechanism and belt clip. Marked in both metric and imperial.",
    specs: { Length: "5 m", Width: "19 mm", Blade: "Nylon-coated steel", Lock: "Auto lock" },
    hsn: "9017", popularity: 300,
    offers: [{ vendor: 2, price: rs(245), mrp: rs(340), stock: 520 }],
  },
  {
    name: "Stanley Claw Hammer 500g",
    category: "Hardware & Tools", brand: "Stanley",
    unit: Unit.PIECE, packSize: 1, label: "Each", moq: 1, step: 1,
    taxRate: 18, weightKg: 0.6,
    short: "500 g claw hammer with a shock-absorbing grip.",
    description:
      "Forged steel claw hammer with a fibreglass handle and shock-absorbing grip.",
    specs: { Weight: "500 g", Handle: "Fibreglass", Head: "Forged steel" },
    hsn: "8205", popularity: 280,
    offers: [{ vendor: 2, price: rs(520), mrp: rs(680), stock: 240 }],
  },

  // --- Plywood & Boards ----------------------------------------------------
  {
    name: "Century Ply Club Prime BWP Plywood 19mm",
    category: "Plywood & Boards", brand: "Century Ply",
    unit: Unit.SQFT, packSize: 1, label: "19 mm — per sq.ft", moq: 32, step: 8,
    taxRate: 18, weightKg: 1.1,
    short: "Boiling-waterproof marine-grade plywood for kitchens and wardrobes.",
    description:
      "19 mm BWP-grade plywood with a borer-and-termite-proof treatment, for kitchen cabinetry and wardrobes. A standard 8 x 4 ft sheet is 32 sq.ft.",
    specs: { Thickness: "19 mm", Grade: "BWP (IS 710)", "Sheet size": "8 x 4 ft (32 sq.ft)", Treatment: "Borer and termite proof", Warranty: "Lifetime" },
    hsn: "4412", popularity: 520,
    offers: [{ vendor: 5, price: rs(148), mrp: rs(185), stock: 3200 }],
  },
  {
    name: "Greenply Commercial MR Plywood 12mm",
    category: "Plywood & Boards", brand: "Greenply",
    unit: Unit.SQFT, packSize: 1, label: "12 mm — per sq.ft", moq: 32, step: 8,
    taxRate: 18, weightKg: 0.7,
    short: "Moisture-resistant commercial plywood for interior joinery.",
    description:
      "12 mm MR-grade commercial plywood for interior partitions, false ceilings and light furniture. A standard 8 x 4 ft sheet is 32 sq.ft.",
    specs: { Thickness: "12 mm", Grade: "MR (IS 303)", "Sheet size": "8 x 4 ft (32 sq.ft)", Application: "Interior only" },
    hsn: "4412", popularity: 410,
    offers: [{ vendor: 5, price: rs(78), mrp: rs(98), stock: 5600 }],
  },
  {
    name: "Action Tesa HDHMR Board 18mm",
    category: "Plywood & Boards", brand: "Action Tesa",
    unit: Unit.SQFT, packSize: 1, label: "18 mm — per sq.ft", moq: 32, step: 8,
    taxRate: 18, weightKg: 1.3,
    short: "High-density board with a smooth face for laminates and paint.",
    description:
      "18 mm high-density high-moisture-resistant board offering a flat, uniform surface ideal for laminate and paint finishes.",
    specs: { Thickness: "18 mm", Type: "HDHMR", "Sheet size": "8 x 4 ft (32 sq.ft)", Density: "> 800 kg/m³" },
    hsn: "4411", popularity: 350,
    offers: [{ vendor: 5, price: rs(112), mrp: rs(140), stock: 2400 }],
  },

  // --- Doors & Windows -----------------------------------------------------
  {
    name: "Flush Door 32mm (7 x 3 ft)",
    category: "Doors & Windows", brand: "Century Ply",
    unit: Unit.PIECE, packSize: 1, label: "7 x 3 ft", moq: 1, step: 1,
    taxRate: 18, weightKg: 24,
    short: "Solid-core flush door for internal rooms.",
    description:
      "32 mm solid-core flush door with a hardwood frame and commercial ply facing. Unfinished, ready for laminate or paint.",
    specs: { Size: "7 x 3 ft", Thickness: "32 mm", Core: "Solid block board", Finish: "Unfinished" },
    hsn: "4418", popularity: 390,
    offers: [{ vendor: 5, price: rs(3200), mrp: rs(3950), stock: 90 }],
  },
  {
    name: "UPVC Sliding Window 4 x 4 ft (2 Track)",
    category: "Doors & Windows", brand: "Supreme",
    unit: Unit.PIECE, packSize: 1, label: "4 x 4 ft", moq: 1, step: 1,
    taxRate: 18, weightKg: 32, deliveryMode: DeliveryMode.SCHEDULED,
    short: "Two-track UPVC sliding window with 5 mm glazing and mesh.",
    description:
      "Two-track UPVC sliding window with 5 mm plain glass, steel-reinforced profile and an integrated mosquito mesh track. Made to the stated size.",
    specs: { Size: "4 x 4 ft", Tracks: "2", Glazing: "5 mm plain glass", Profile: "UPVC steel-reinforced", Includes: "Mosquito mesh" },
    hsn: "3925", popularity: 330,
    offers: [{ vendor: 5, price: rs(11500), mrp: rs(14200), stock: 24 }],
  },

  // --- False Ceiling & POP -------------------------------------------------
  {
    name: "Gyproc Gypsum Ceiling Board 12.5mm (8 x 4 ft)",
    category: "False Ceiling & POP", brand: "Gyproc",
    unit: Unit.PIECE, packSize: 1, label: "8 x 4 ft sheet", moq: 10, step: 5,
    taxRate: 18, weightKg: 22,
    short: "12.5 mm gypsum board for false ceilings and partitions.",
    description:
      "Standard 12.5 mm gypsum plasterboard for suspended ceilings and drywall partitions. Tapered edges for seamless jointing.",
    specs: { Thickness: "12.5 mm", "Sheet size": "8 x 4 ft", Edge: "Tapered", Type: "Regular" },
    hsn: "6809", popularity: 420,
    offers: [{ vendor: 5, price: rs(680), mrp: rs(830), stock: 480 }],
  },
  {
    name: "GI Ceiling Frame Channel (3m)",
    category: "False Ceiling & POP", brand: "Gyproc",
    unit: Unit.PIECE, packSize: 1, label: "3 m length", moq: 20, step: 10,
    taxRate: 18, weightKg: 1.4,
    short: "Galvanised steel channel for suspended ceiling grids.",
    description:
      "Galvanised iron ceiling section for suspended gypsum ceiling frameworks. 0.55 mm thick, 3 metre lengths.",
    specs: { Length: "3 m", Thickness: "0.55 mm", Material: "Galvanised iron", Type: "Ceiling section" },
    hsn: "7308", popularity: 290,
    offers: [{ vendor: 5, price: rs(185), mrp: rs(240), stock: 1600 }],
  },
  {
    name: "Plaster of Paris (POP) 25kg",
    category: "False Ceiling & POP", brand: "Gyproc",
    unit: Unit.BAG, packSize: 25, label: "25 kg bag", moq: 5, step: 5,
    taxRate: 18, weightKg: 25,
    short: "Gypsum plaster for ceiling finishing and cornice work.",
    description:
      "Fine gypsum plaster for ceiling punning, cornices and decorative mouldings. Sets in 20-25 minutes.",
    specs: { "Bag weight": "25 kg", "Setting time": "20-25 minutes", Application: "Ceiling, cornice, moulding" },
    hsn: "2520", popularity: 340,
    offers: [{ vendor: 6, price: rs(420), mrp: rs(520), stock: 380 }],
  },

  // --- Adhesives & Chemicals ----------------------------------------------
  {
    name: "Fevicol SH Synthetic Resin Adhesive 5kg",
    category: "Adhesives & Chemicals", brand: "Fevicol",
    unit: Unit.PACK, packSize: 5, label: "5 kg pack", moq: 1, step: 1,
    taxRate: 18, weightKg: 5.2,
    short: "General-purpose woodworking adhesive.",
    description:
      "Synthetic resin woodworking adhesive for plywood, block board and laminate bonding. Non-staining.",
    specs: { "Pack size": "5 kg", Type: "Synthetic resin (PVA)", "Setting time": "4-6 hours under pressure" },
    hsn: "3506", popularity: 460,
    offers: [{ vendor: 5, price: rs(720), mrp: rs(880), stock: 290 }],
  },
  {
    name: "Tile Adhesive C1 Grade 20kg",
    category: "Adhesives & Chemicals", brand: "Dr. Fixit",
    unit: Unit.BAG, packSize: 20, label: "20 kg bag", moq: 5, step: 5,
    taxRate: 18, weightKg: 20,
    short: "Cement-based tile adhesive for floor and wall tiling.",
    description:
      "C1-grade polymer-modified cement adhesive for fixing ceramic and vitrified tiles on floors and walls. Covers roughly 35-40 sq.ft per bag at 3 mm bed thickness.",
    specs: { Grade: "C1 (IS 15477)", "Bag weight": "20 kg", Coverage: "35-40 sq.ft at 3 mm", "Pot life": "2 hours" },
    hsn: "3824", popularity: 500,
    offers: [{ vendor: 3, price: rs(380), mrp: rs(470), stock: 640 }],
  },
  {
    name: "Epoxy Tile Grout 1kg",
    category: "Adhesives & Chemicals", brand: "Dr. Fixit",
    unit: Unit.KG, packSize: 1, label: "1 kg pack", moq: 2, step: 1,
    taxRate: 18, weightKg: 1.1,
    short: "Stain-resistant epoxy grout for tile joints.",
    description:
      "Two-component epoxy grout for tile joints in kitchens and bathrooms. Impervious to water and resistant to staining.",
    specs: { "Pack size": "1 kg", Type: "Two-component epoxy", "Joint width": "2-12 mm", Colour: "Ivory" },
    hsn: "3214", popularity: 310,
    offers: [{ vendor: 3, price: rs(640), mrp: rs(790), stock: 220 }],
  },

  // --- Home Repair Essentials ---------------------------------------------
  {
    name: "Wall Putty 20kg",
    category: "Home Repair Essentials", brand: "Asian Paints",
    unit: Unit.BAG, packSize: 20, label: "20 kg bag", moq: 2, step: 1,
    taxRate: 18, weightKg: 20,
    short: "White cement putty for a smooth pre-paint wall finish.",
    description:
      "White cement-based wall putty providing a smooth, hard base for interior and exterior paint. Covers roughly 25-30 sq.ft per kg for two coats.",
    specs: { "Bag weight": "20 kg", Coverage: "25-30 sq.ft/kg (2 coats)", Base: "White cement", Application: "Interior and exterior" },
    hsn: "3214", popularity: 580,
    offers: [
      { vendor: 6, price: rs(760), mrp: rs(920), stock: 540 },
      { vendor: 0, price: rs(790), mrp: rs(920), stock: 180 },
    ],
  },
  {
    name: "PVC Solvent Cement 500ml",
    category: "Home Repair Essentials", brand: "Astral",
    unit: Unit.PIECE, packSize: 1, label: "500 ml tin", moq: 1, step: 1,
    taxRate: 18, weightKg: 0.6,
    short: "Solvent cement for PVC and CPVC pipe joints.",
    description:
      "Fast-setting solvent cement for PVC and CPVC plumbing joints. Includes an applicator brush in the cap.",
    specs: { "Pack size": "500 ml", "Set time": "15 minutes", Application: "PVC and CPVC pipe joints" },
    hsn: "3506", popularity: 330,
    offers: [{ vendor: 4, price: rs(340), mrp: rs(420), stock: 410 }],
  },
  {
    name: "Silicone Sealant Clear 280ml",
    category: "Home Repair Essentials", brand: "Dr. Fixit",
    unit: Unit.PIECE, packSize: 1, label: "280 ml cartridge", moq: 2, step: 1,
    taxRate: 18, weightKg: 0.35,
    short: "Weatherproof clear silicone for glass, sanitary and joint sealing.",
    description:
      "Neutral-cure clear silicone sealant for glazing, sanitaryware and general weatherproofing. Remains flexible and resists mould.",
    specs: { Volume: "280 ml", Type: "Neutral cure silicone", Colour: "Clear", "Skin time": "10 minutes" },
    hsn: "3214", popularity: 300,
    offers: [{ vendor: 4, price: rs(285), mrp: rs(360), stock: 480 }],
  },
  {
    name: "Mseal Multipurpose Epoxy Sealant 100g",
    category: "Home Repair Essentials", brand: "Fevicol",
    unit: Unit.PIECE, packSize: 1, label: "100 g pack", moq: 2, step: 1,
    taxRate: 18, weightKg: 0.12,
    short: "Epoxy putty for sealing leaks in pipes and tanks.",
    description:
      "Two-part epoxy putty that seals leaks in metal, PVC and ceramic. Hardens in 30 minutes and can be drilled or painted.",
    specs: { Weight: "100 g", Type: "Two-part epoxy putty", "Setting time": "30 minutes" },
    hsn: "3214", popularity: 350,
    offers: [{ vendor: 4, price: rs(95), mrp: rs(130), stock: 760 }],
  },
];

// ---------------------------------------------------------------------------
// Workers — 20 tradespeople across Hyderabad
// ---------------------------------------------------------------------------

interface SeedWorker {
  name: string;
  phone: string;
  trades: Trade[];
  years: number;
  jobs: number;
  rating: number;
  ratingCount: number;
  area: string;
  pincode: string;
  lat: number;
  lng: number;
  radius: number;
  hourly: number;
  daily: number;
  fixed?: number;
  bio: string;
  verified: boolean;
  availableToday: boolean;
}

const WORKERS: SeedWorker[] = [
  { name: "Ramesh Yadav", phone: "+919701100001", trades: [Trade.MASON], years: 14, jobs: 236, rating: 4.7, ratingCount: 189, area: "Kukatpally", pincode: "500072", lat: 17.4849, lng: 78.4138, radius: 20, hourly: rs(320), daily: rs(1100), bio: "Mason with 14 years on residential construction — brickwork, plastering and concrete finishing. Handles teams of up to six.", verified: true, availableToday: true },
  { name: "Suresh Kumar", phone: "+919701100002", trades: [Trade.ELECTRICIAN], years: 11, jobs: 412, rating: 4.8, ratingCount: 351, area: "Ameerpet", pincode: "500016", lat: 17.4374, lng: 78.4487, radius: 25, hourly: rs(400), daily: rs(1400), fixed: rs(3500), bio: "Licensed electrician for full house wiring, DB installation and fault finding. Works to IS standards with proper earthing.", verified: true, availableToday: true },
  { name: "Mohammed Ismail", phone: "+919701100003", trades: [Trade.PLUMBER], years: 9, jobs: 298, rating: 4.6, ratingCount: 241, area: "Malakpet", pincode: "500036", lat: 17.3753, lng: 78.5039, radius: 18, hourly: rs(380), daily: rs(1300), bio: "Plumbing for new construction and repairs — CPVC lines, sanitary fitting and leak detection.", verified: true, availableToday: false },
  { name: "Venkatesh Reddy", phone: "+919701100004", trades: [Trade.CARPENTER], years: 16, jobs: 187, rating: 4.9, ratingCount: 156, area: "Madhapur", pincode: "500081", lat: 17.4483, lng: 78.3915, radius: 22, hourly: rs(450), daily: rs(1600), fixed: rs(12000), bio: "Furniture and modular kitchen carpenter. Wardrobes, kitchen units and false ceiling framework in ply and HDHMR.", verified: true, availableToday: true },
  { name: "Krishna Murthy", phone: "+919701100005", trades: [Trade.PAINTER], years: 12, jobs: 324, rating: 4.5, ratingCount: 267, area: "Secunderabad", pincode: "500003", lat: 17.4399, lng: 78.4983, radius: 20, hourly: rs(300), daily: rs(1050), fixed: rs(18), bio: "Interior and exterior painting including putty, primer and two-coat emulsion. Team of four for larger sites.", verified: true, availableToday: true },
  { name: "Anil Sharma", phone: "+919701100006", trades: [Trade.TILE_WORKER], years: 10, jobs: 211, rating: 4.7, ratingCount: 178, area: "Kompally", pincode: "500014", lat: 17.5385, lng: 78.4867, radius: 25, hourly: rs(420), daily: rs(1450), fixed: rs(35), bio: "Floor and wall tiling in vitrified, ceramic and granite. Precise levelling and minimal wastage on cuts.", verified: true, availableToday: false },
  { name: "Ganesh Naik", phone: "+919701100007", trades: [Trade.HELPER], years: 5, jobs: 156, rating: 4.3, ratingCount: 121, area: "Uppal", pincode: "500039", lat: 17.3980, lng: 78.5590, radius: 15, hourly: rs(180), daily: rs(650), bio: "Construction helper for material shifting, mixing and site clean-up. Available at short notice.", verified: true, availableToday: true },
  { name: "Srinivas Rao", phone: "+919701100008", trades: [Trade.MASON, Trade.TILE_WORKER], years: 18, jobs: 342, rating: 4.8, ratingCount: 289, area: "LB Nagar", pincode: "500074", lat: 17.3457, lng: 78.5522, radius: 24, hourly: rs(400), daily: rs(1400), bio: "Mason and tile worker with 18 years of experience across independent houses and apartment interiors.", verified: true, availableToday: true },
  { name: "Imran Khan", phone: "+919701100009", trades: [Trade.ELECTRICIAN], years: 7, jobs: 198, rating: 4.4, ratingCount: 164, area: "Tolichowki", pincode: "500008", lat: 17.3985, lng: 78.4012, radius: 18, hourly: rs(350), daily: rs(1200), bio: "Electrician for repairs, rewiring, switch and fan installation. Same-day service in the west zone.", verified: true, availableToday: true },
  { name: "Prakash Goud", phone: "+919701100010", trades: [Trade.PLUMBER], years: 13, jobs: 276, rating: 4.6, ratingCount: 223, area: "Miyapur", pincode: "500049", lat: 17.4948, lng: 78.3578, radius: 22, hourly: rs(390), daily: rs(1350), bio: "Plumbing contractor for full-house piping, overhead tank connections and bathroom fit-out.", verified: true, availableToday: false },
  { name: "Ravi Teja", phone: "+919701100011", trades: [Trade.CARPENTER], years: 8, jobs: 134, rating: 4.5, ratingCount: 108, area: "Gachibowli", pincode: "500032", lat: 17.4400, lng: 78.3489, radius: 20, hourly: rs(420), daily: rs(1500), bio: "Carpenter for doors, windows, wardrobes and on-site furniture repair.", verified: true, availableToday: true },
  { name: "Shankar Lal", phone: "+919701100012", trades: [Trade.PAINTER], years: 15, jobs: 289, rating: 4.7, ratingCount: 234, area: "Begumpet", pincode: "500016", lat: 17.4435, lng: 78.4645, radius: 20, hourly: rs(330), daily: rs(1150), fixed: rs(20), bio: "Painting contractor for apartments and villas. Texture, stencil and premium emulsion finishes.", verified: true, availableToday: true },
  { name: "Mahesh Babu", phone: "+919701100013", trades: [Trade.MASON], years: 9, jobs: 167, rating: 4.4, ratingCount: 132, area: "Bachupally", pincode: "500090", lat: 17.5449, lng: 78.3673, radius: 22, hourly: rs(300), daily: rs(1050), bio: "Mason for brickwork, plastering and compound walls. Reliable on repeat work.", verified: true, availableToday: false },
  { name: "Yousuf Ali", phone: "+919701100014", trades: [Trade.TILE_WORKER], years: 11, jobs: 203, rating: 4.6, ratingCount: 171, area: "Charminar", pincode: "500002", lat: 17.3616, lng: 78.4747, radius: 16, hourly: rs(400), daily: rs(1400), fixed: rs(32), bio: "Tiling specialist for bathrooms and kitchens, including anti-skid and epoxy grouting.", verified: true, availableToday: true },
  { name: "Naresh Kumar", phone: "+919701100015", trades: [Trade.HELPER], years: 3, jobs: 89, rating: 4.2, ratingCount: 67, area: "Kukatpally", pincode: "500072", lat: 17.4849, lng: 78.4138, radius: 15, hourly: rs(170), daily: rs(600), bio: "Site helper for loading, mixing and general assistance.", verified: true, availableToday: true },
  { name: "Rajesh Verma", phone: "+919701100016", trades: [Trade.ELECTRICIAN, Trade.PLUMBER], years: 12, jobs: 254, rating: 4.5, ratingCount: 201, area: "Dilsukhnagar", pincode: "500060", lat: 17.3687, lng: 78.5247, radius: 20, hourly: rs(380), daily: rs(1300), bio: "Handles both electrical and plumbing repairs — convenient for small renovation jobs needing one visit.", verified: true, availableToday: true },
  { name: "Balraj Singh", phone: "+919701100017", trades: [Trade.CARPENTER], years: 20, jobs: 398, rating: 4.9, ratingCount: 334, area: "Banjara Hills", pincode: "500034", lat: 17.4126, lng: 78.4392, radius: 25, hourly: rs(550), daily: rs(1900), fixed: rs(15000), bio: "Senior carpenter for premium interiors — veneer work, custom furniture and modular fit-out.", verified: true, availableToday: false },
  { name: "Satish Chandra", phone: "+919701100018", trades: [Trade.PAINTER], years: 6, jobs: 112, rating: 4.3, ratingCount: 88, area: "Nizampet", pincode: "500090", lat: 17.5090, lng: 78.3890, radius: 18, hourly: rs(280), daily: rs(950), bio: "Painter for interior repaint, putty work and touch-ups. Clean site handover.", verified: true, availableToday: true },
  { name: "Abdul Rahman", phone: "+919701100019", trades: [Trade.MASON, Trade.HELPER], years: 10, jobs: 178, rating: 4.4, ratingCount: 141, area: "Mehdipatnam", pincode: "500028", lat: 17.3947, lng: 78.4342, radius: 18, hourly: rs(310), daily: rs(1080), bio: "Mason for repair work, wall breaking, patch plastering and small renovations.", verified: true, availableToday: true },
  { name: "Kiran Kumar", phone: "+919701100020", trades: [Trade.PLUMBER], years: 4, jobs: 76, rating: 4.1, ratingCount: 58, area: "Kondapur", pincode: "500084", lat: 17.4615, lng: 78.3672, radius: 16, hourly: rs(320), daily: rs(1100), bio: "Plumber for leak repairs, tap and sanitary fitting replacement.", verified: false, availableToday: true },
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("Seeding Gharr…\n");

  // Order matters: children are removed before parents.
  console.log("  Clearing existing data");
  await prisma.ticketMessage.deleteMany();
  await prisma.estimateLine.deleteMany();
  await prisma.estimate.deleteMany();
  await prisma.estimatePrice.deleteMany();
  await prisma.$transaction([
    prisma.labourBookingEvent.deleteMany(),
    prisma.labourBookingLine.deleteMany(),
    prisma.orderEvent.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.commission.deleteMany(),
    prisma.payout.deleteMany(),
    prisma.couponRedemption.deleteMany(),
    prisma.review.deleteMany(),
    prisma.labourBooking.deleteMany(),
    prisma.order.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.category.deleteMany(),
    prisma.workerAvailabilityException.deleteMany(),
    prisma.workerAvailability.deleteMany(),
    prisma.workerRate.deleteMany(),
    prisma.workerSkill.deleteMany(),
    prisma.workerDocument.deleteMany(),
    prisma.worker.deleteMany(),
    prisma.vendorDocument.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.deliveryPartner.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.address.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.otpRequest.deleteMany(),
    prisma.rateLimitCounter.deleteMany(),
    prisma.coupon.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // --- Categories ---
  const categoryByName = new Map<string, string>();
  for (const [index, category] of CATEGORIES.entries()) {
    const row = await prisma.category.create({
      data: {
        slug: slugify(category.name),
        name: category.name,
        iconKey: category.iconKey,
        imageUrl: img(`cat-${category.iconKey}`, 400, 400),
        sortOrder: index,
      },
    });
    categoryByName.set(category.name, row.id);
  }
  console.log(`  ${CATEGORIES.length} categories`);

  // --- Brands ---
  const brandByName = new Map<string, string>();
  for (const name of BRANDS) {
    const row = await prisma.brand.create({
      data: { slug: slugify(name), name, logoUrl: img(`brand-${slugify(name)}`, 200, 200) },
    });
    brandByName.set(name, row.id);
  }
  console.log(`  ${BRANDS.length} brands`);

  // --- Vendors ---
  const vendorIds: string[] = [];
  const vendorNames: string[] = [];
  for (const vendor of VENDORS) {
    const user = await prisma.user.create({
      data: {
        phoneE164: vendor.phone,
        phoneVerifiedAt: new Date(),
        name: vendor.businessName,
        roles: [Role.VENDOR],
      },
    });

    const row = await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: vendor.businessName,
        slug: slugify(vendor.businessName),
        legalName: `${vendor.businessName} Pvt Ltd`,
        gstin: `36AAACH${Math.floor(1000 + Math.random() * 8999)}R1Z${Math.floor(Math.random() * 9)}`,
        phoneE164: vendor.phone,
        email: `${slugify(vendor.businessName).slice(0, 20)}@example.in`,
        logoUrl: img(`vendor-${slugify(vendor.businessName)}`, 200, 200),
        city: "Hyderabad",
        state: "Telangana",
        pincode: vendor.pincode,
        servicePincodes: [
          vendor.pincode, "500072", "500049", "500081", "500032", "500084",
          "500003", "500016", "500036", "500074", "500090",
        ],
        status: VerificationStatus.VERIFIED,
        ratingAvg: vendor.rating,
        ratingCount: vendor.ratingCount,
        baseDeliveryFeePaise: vendor.baseDeliveryFee,
        perKmFeePaise: vendor.perKmFee,
        freeDeliveryAbovePaise: vendor.freeAbove,
        maxDeliveryKm: vendor.maxKm,
        minOrderPaise: vendor.minOrder,
      },
    });

    vendorIds.push(row.id);
    vendorNames.push(vendor.businessName);
  }
  console.log(`  ${VENDORS.length} vendors`);

  // --- Products and variants ---
  let variantCount = 0;
  for (const product of PRODUCTS) {
    const categoryId = categoryByName.get(product.category);
    const brandId = brandByName.get(product.brand);
    if (!categoryId) throw new Error(`Unknown category: ${product.category}`);

    const row = await prisma.product.create({
      data: {
        slug: slugify(product.name),
        name: product.name,
        categoryId,
        brandId,
        shortDescription: product.short,
        description: product.description,
        images: [
          img(`${slugify(product.name)}-1`),
          img(`${slugify(product.name)}-2`),
          img(`${slugify(product.name)}-3`),
        ],
        specs: product.specs,
        hsnCode: product.hsn,
        taxRatePercent: product.taxRate,
        searchText: `${product.name} ${product.brand} ${product.category} ${product.short}`.toLowerCase(),
        popularityScore: product.popularity,
        ratingAvg: Number((3.9 + Math.random()).toFixed(1)),
        ratingCount: Math.floor(product.popularity / 8),
      },
    });

    for (const offer of product.offers) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: row.id,
          vendorId: vendorIds[offer.vendor],
          sku: `${slugify(product.brand).slice(0, 6).toUpperCase()}-${slugify(product.name).slice(0, 14).toUpperCase()}-${offer.vendor}`,
          label: offer.label ?? product.label,
          unit: product.unit,
          packSize: product.packSize,
          mrpPaise: offer.mrp,
          pricePaise: offer.price,
          moqQuantity: offer.moq ?? product.moq,
          stepQuantity: offer.step ?? product.step ?? 1,
          deliveryMode: offer.deliveryMode ?? product.deliveryMode ?? DeliveryMode.STANDARD,
          leadTimeDays: offer.leadTimeDays ?? (product.deliveryMode === DeliveryMode.SCHEDULED ? 2 : 1),
          weightKgPerUnit: product.weightKg,
        },
      });

      await prisma.inventory.create({
        data: {
          variantId: variant.id,
          quantityAvailable: offer.stock,
          lowStockThreshold: Math.max(1, Math.round(offer.stock * 0.05)),
        },
      });

      variantCount += 1;
    }
  }
  console.log(`  ${PRODUCTS.length} products / ${variantCount} vendor offers`);

  // --- Workers ---
  for (const worker of WORKERS) {
    const user = await prisma.user.create({
      data: {
        phoneE164: worker.phone,
        phoneVerifiedAt: new Date(),
        name: worker.name,
        roles: [Role.WORKER, Role.CUSTOMER],
      },
    });

    const row = await prisma.worker.create({
      data: {
        userId: user.id,
        displayName: worker.name,
        photoUrl: img(`worker-${slugify(worker.name)}`, 400, 400),
        bio: worker.bio,
        phoneVerifiedAt: new Date(),
        idVerificationStatus: worker.verified
          ? VerificationStatus.VERIFIED
          : VerificationStatus.PENDING,
        yearsExperience: worker.years,
        completedJobs: worker.jobs,
        ratingAvg: worker.rating,
        ratingCount: worker.ratingCount,
        baseLat: worker.lat,
        baseLng: worker.lng,
        baseCity: "Hyderabad",
        basePincode: worker.pincode,
        serviceRadiusKm: worker.radius,
        acceptsFixedPrice: worker.fixed != null,
        isAvailableToday: worker.availableToday,
        lastActiveAt: new Date(),
      },
    });

    for (const [index, trade] of worker.trades.entries()) {
      await prisma.workerSkill.create({
        data: {
          workerId: row.id,
          trade,
          yearsExperience: index === 0 ? worker.years : Math.max(1, worker.years - 4),
          isPrimary: index === 0,
        },
      });

      await prisma.workerRate.createMany({
        data: [
          { workerId: row.id, trade, rateType: "HOURLY", amountPaise: worker.hourly, minUnits: 2 },
          { workerId: row.id, trade, rateType: "DAILY", amountPaise: worker.daily, minUnits: 1 },
          ...(worker.fixed != null
            ? [{ workerId: row.id, trade, rateType: "FIXED" as const, amountPaise: worker.fixed, minUnits: 1 }]
            : []),
        ],
      });
    }

    // Standard six-day week, 09:00-18:00, Sunday off.
    await prisma.workerAvailability.createMany({
      data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        workerId: row.id,
        dayOfWeek,
        startMinute: 9 * 60,
        endMinute: 18 * 60,
      })),
    });

    // A couple of workers have leave next week, so the availability logic has
    // something real to exclude.
    if (!worker.availableToday) {
      const blocked = new Date();
      blocked.setDate(blocked.getDate() + 2);
      await prisma.workerAvailabilityException.create({
        data: {
          workerId: row.id,
          date: new Date(blocked.toISOString().slice(0, 10)),
          type: AvailabilityExceptionType.BLOCKED,
          reason: "Personal leave",
        },
      });
    }
  }
  console.log(`  ${WORKERS.length} workers`);

  // --- Demo customers ---
  const demoCustomers = [
    { phone: "+919000000001", name: "Arjun Mehta", area: "Kukatpally", pincode: "500072" },
    { phone: "+919000000002", name: "Priya Sharma", area: "Gachibowli", pincode: "500032" },
    { phone: "+919000000003", name: "Rahul Reddy", area: "Banjara Hills", pincode: "500034" },
  ];

  for (const customer of demoCustomers) {
    const user = await prisma.user.create({
      data: {
        phoneE164: customer.phone,
        phoneVerifiedAt: new Date(),
        name: customer.name,
        roles: [Role.CUSTOMER],
      },
    });

    await prisma.address.create({
      data: {
        userId: user.id,
        type: "HOME",
        contactName: customer.name,
        contactPhone: customer.phone,
        line1: `Plot ${Math.floor(10 + Math.random() * 300)}, ${customer.area}`,
        line2: "Near Metro Station",
        landmark: "Opposite community park",
        city: "Hyderabad",
        state: "Telangana",
        pincode: customer.pincode,
        isDefault: true,
      },
    });

    await prisma.cart.create({ data: { userId: user.id } });
  }

  // An admin account for the ops consoles.
  await prisma.user.create({
    data: {
      phoneE164: "+919000000009",
      phoneVerifiedAt: new Date(),
      name: "Gharr Admin",
      roles: [Role.ADMIN, Role.CUSTOMER],
    },
  });
  console.log(`  ${demoCustomers.length} demo customers + 1 admin`);

  // --- Coupons ---
  const now = new Date();
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  await prisma.coupon.createMany({
    data: [
      {
        code: "FIRST500", type: CouponType.FLAT, flatPaise: rs(500),
        minOrderPaise: rs(5000), scope: CouponScope.ALL,
        validFrom: now, validTo: nextYear, perUserLimit: 1,
      },
      {
        code: "BUILD10", type: CouponType.PERCENT, percentValue: 10,
        minOrderPaise: rs(10000), maxDiscountPaise: rs(2000), scope: CouponScope.ALL,
        validFrom: now, validTo: nextYear, perUserLimit: 3,
      },
      {
        code: "CEMENT250", type: CouponType.FLAT, flatPaise: rs(250),
        minOrderPaise: rs(4000), scope: CouponScope.CATEGORY,
        categoryIds: [categoryByName.get("Cement & Concrete")!],
        validFrom: now, validTo: nextYear, perUserLimit: 2,
      },
      {
        code: "LABOUR15", type: CouponType.PERCENT, percentValue: 15,
        minOrderPaise: rs(1000), maxDiscountPaise: rs(500),
        scope: CouponScope.LABOUR, appliesToLabour: true,
        validFrom: now, validTo: nextYear, perUserLimit: 2,
      },
      {
        code: "PAINT1000", type: CouponType.FLAT, flatPaise: rs(1000),
        minOrderPaise: rs(15000), scope: CouponScope.CATEGORY,
        categoryIds: [categoryByName.get("Paint & Waterproofing")!],
        validFrom: now, validTo: nextYear, perUserLimit: 1,
      },
    ],
  });
  console.log("  5 coupons");

  // --- Estimate Engine: norms, Hyderabad prices, one saved demo estimate ---
  const arjun = await prisma.user.findUniqueOrThrow({ where: { phoneE164: "+919000000001" } });
  await seedEstimates(prisma, arjun.id);

  // --- Admin console demo: verification queue, orders, a dispute, tickets ---
  await seedAdminDemo(prisma);

  console.log("\nSeed complete.\n");
  console.log("Sign in with any of these numbers — OTP is always 000000:");
  for (const customer of demoCustomers) {
    console.log(`  ${customer.phone}  ${customer.name}`);
  }
  console.log(`  +919000000009  Gharr Admin (admin role)`);
  console.log(`  +919000000008  Gharr Support (support role)\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
