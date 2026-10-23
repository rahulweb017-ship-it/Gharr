import { z } from "zod";
import { WALL_FACTOR, type EstimateMeasures, type EstimateScope } from "@/shared/estimate";

/**
 * Estimate wizard contract, shared by the API, the web wizard and the future
 * React Native app.
 *
 * Only the customer's physical inputs are accepted — never prices, totals or
 * rule values. Everything monetary is computed server-side from the tables.
 */

const Tier = z.enum(["BASIC", "STANDARD", "PREMIUM"]);
const Title = z.string().trim().min(2, "Give the project a name").max(60);
const City = z.string().trim().min(2).max(60);

const int = (min: number, max: number, message: string) =>
  z.coerce.number().int(message).min(min, message).max(max, message);

export const NewBuildInput = z
  .object({
    mode: z.literal("NEW_BUILD"),
    title: Title,
    city: City,
    tier: Tier,
    plotSqft: int(100, 100_000, "Plot size must be between 100 and 1,00,000 sq ft"),
    builtUpSqft: int(100, 50_000, "Built-up area must be between 100 and 50,000 sq ft"),
    floors: int(1, 5, "Choose between 1 and 5 floors"),
    rooms: int(1, 30, "Choose between 1 and 30 rooms"),
    bathrooms: int(0, 20, "Choose between 0 and 20 bathrooms"),
  })
  .superRefine((v, ctx) => {
    // Built-up area is summed across floors, so it cannot exceed the plot
    // footprint times the number of floors.
    if (v.builtUpSqft > v.plotSqft * v.floors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["builtUpSqft"],
        message: "Built-up area cannot exceed plot size × number of floors",
      });
    }
  });

export const RenovationInput = z.object({
  mode: z.literal("RENOVATION"),
  title: Title,
  city: City,
  tier: Tier,
  scope: z.enum(["BATHROOM", "KITCHEN", "FLOORING", "PAINTING"]),
  areaSqft: int(10, 20_000, "Area must be between 10 and 20,000 sq ft"),
});

export const EstimateInput = z.union([NewBuildInput, RenovationInput]);
export type EstimateInput = z.infer<typeof EstimateInput>;
export type NewBuildInput = z.infer<typeof NewBuildInput>;
export type RenovationInput = z.infer<typeof RenovationInput>;

export function scopeOf(input: EstimateInput): EstimateScope {
  return input.mode === "NEW_BUILD" ? "WHOLE_HOUSE" : input.scope;
}

/** Derives the quantities the rules multiply against. */
export function measuresFor(input: EstimateInput): EstimateMeasures {
  if (input.mode === "NEW_BUILD") {
    return {
      builtUpSqft: input.builtUpSqft,
      floorSqft: input.builtUpSqft,
      wallSqft: Math.round(input.builtUpSqft * WALL_FACTOR),
      rooms: input.rooms,
      bathrooms: input.bathrooms,
      floors: input.floors,
    };
  }

  // A renovation is one space: the entered area is its floor area.
  return {
    builtUpSqft: input.areaSqft,
    floorSqft: input.areaSqft,
    wallSqft: Math.round(input.areaSqft * WALL_FACTOR),
    rooms: 1,
    bathrooms: input.scope === "BATHROOM" ? 1 : 0,
    floors: 1,
  };
}

export const BoqCartInput = z.object({
  items: z
    .array(
      z.object({
        lineId: z.string().min(1),
        /** Number of packs. Re-validated server-side against MOQ and step. */
        quantity: z.number().positive(),
      }),
    )
    .min(1, "Select at least one item")
    .max(100),
});
export type BoqCartInput = z.infer<typeof BoqCartInput>;
