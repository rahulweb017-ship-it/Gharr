import { z } from "zod";

/**
 * Supplier portal contracts — registration, profile, listings and product
 * submissions. Shared by the API routes and the portal forms. Money is always
 * integer paise on the wire; the forms convert from rupees.
 */

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PINCODE = /^[1-9]\d{5}$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const paise = (max = 10_000_000) => z.number().int().min(0).max(max);

export const UNITS = ["BAG", "KG", "TONNE", "PIECE", "BOX", "SQFT", "LITRE", "BUNDLE", "BUCKET", "CAN", "PACK"] as const;
export const DELIVERY_MODES = ["STANDARD", "SCHEDULED", "PICKUP"] as const;

export const VendorProfileInput = z.object({
  businessName: z.string().trim().min(3, "Enter your business name").max(100),
  legalName: optionalText(120),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || GSTIN.test(v), "Enter a valid 15-character GSTIN"),
  email: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email"),
  city: z.string().trim().min(2, "Enter a city").max(60),
  state: z.string().trim().min(2, "Enter a state").max(60),
  pincode: z.string().trim().regex(PINCODE, "Enter a 6-digit pincode"),
  servicePincodes: z.array(z.string().trim().regex(PINCODE, "Each service pincode must be 6 digits")).max(200).default([]),
  baseDeliveryFeePaise: paise().default(0),
  perKmFeePaise: paise(100_000).default(0),
  freeDeliveryAbovePaise: paise(100_000_000).nullish().transform((v) => v ?? null),
  maxDeliveryKm: z.number().int().min(1).max(200).default(25),
  minOrderPaise: paise(100_000_000).default(0),
});
export type VendorProfileInput = z.infer<typeof VendorProfileInput>;

export const VendorProfilePatch = VendorProfileInput.partial()
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

/** One seller offer on a product: SKU, pack, price, ordering rules, stock. */
export const OfferInput = z
  .object({
    sku: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dot, dash or underscore"),
    label: z.string().trim().min(2, "Describe the pack, e.g. 50 kg bag").max(60),
    unit: z.enum(UNITS),
    packSize: z.number().positive().max(100_000).default(1),
    mrpPaise: z.number().int().positive().max(100_000_000),
    pricePaise: z.number().int().positive().max(100_000_000),
    moqQuantity: z.number().positive().max(1_000_000).default(1),
    stepQuantity: z.number().positive().max(1_000_000).default(1),
    maxOrderQuantity: z.number().positive().max(10_000_000).nullish().transform((v) => v ?? null),
    deliveryMode: z.enum(DELIVERY_MODES).default("STANDARD"),
    leadTimeDays: z.number().int().min(0).max(60).default(1),
    weightKgPerUnit: z.number().positive().max(100_000).nullish().transform((v) => v ?? null),
    quantityAvailable: z.number().min(0).max(999_999_999).default(0),
    lowStockThreshold: z.number().min(0).max(999_999_999).default(0),
  })
  .refine((o) => o.mrpPaise >= o.pricePaise, { message: "Selling price cannot be above MRP", path: ["pricePaise"] });
export type OfferInput = z.infer<typeof OfferInput>;

export const CreateVariantInput = OfferInput.and(z.object({ productId: z.string().min(1) }));

export const VariantPatch = z
  .object({
    pricePaise: z.number().int().positive().max(100_000_000),
    mrpPaise: z.number().int().positive().max(100_000_000),
    isActive: z.boolean(),
    quantityAvailable: z.number().min(0).max(999_999_999),
    lowStockThreshold: z.number().min(0).max(999_999_999),
    leadTimeDays: z.number().int().min(0).max(60),
  })
  .partial()
  .strict()
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: "Nothing to update" });

export const BulkStockInput = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1), quantityAvailable: z.number().min(0).max(999_999_999) }))
    .min(1)
    .max(200),
});

/** A product the catalogue does not have yet, proposed with its first offer. */
export const SubmitProductInput = z.object({
  name: z.string().trim().min(3, "Enter the product name").max(120),
  categoryId: z.string().min(1, "Choose a category"),
  brandName: optionalText(60),
  shortDescription: z.string().trim().min(10, "Add a one-line description").max(160),
  description: z.string().trim().min(20, "Describe the product in a few sentences").max(4000),
  hsnCode: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^\d{4,8}$/.test(v), "HSN codes are 4–8 digits"),
  taxRatePercent: z.union([z.literal(0), z.literal(5), z.literal(12), z.literal(18), z.literal(28)]).default(18),
  images: z.array(z.string().url().max(500)).max(8).default([]),
  offer: OfferInput,
});
export type SubmitProductInput = z.infer<typeof SubmitProductInput>;
