import { z } from "zod";
import { PhoneInput } from "./auth";

/**
 * Delivery / job-site address contract.
 *
 * Shared by the API, the web address form and (later) the React Native app.
 * Phone numbers normalise to E.164 during parsing, like everywhere else.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const AddressInput = z.object({
  type: z.enum(["HOME", "SITE", "OFFICE"]).default("HOME"),
  contactName: z.string().trim().min(2, "Enter a contact name").max(80),
  contactPhone: PhoneInput,
  line1: z.string().trim().min(3, "Enter house / flat and street").max(160),
  line2: optionalText(160),
  landmark: optionalText(120),
  city: z.string().trim().min(2, "Enter a city").max(60),
  state: z.string().trim().min(2, "Enter a state").max(60),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid GSTIN")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof AddressInput>;

export const AddressUpdateInput = AddressInput.partial();
export type AddressUpdateInput = z.infer<typeof AddressUpdateInput>;

export const ProfileUpdateInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(60).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .max(120)
    .optional()
    .or(z.literal("").transform(() => null)),
});
export type ProfileUpdateInput = z.infer<typeof ProfileUpdateInput>;
