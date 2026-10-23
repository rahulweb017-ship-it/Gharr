import type { Trade } from "@prisma/client";

/**
 * Trade labels and ordering.
 *
 * Lives in `shared` rather than the worker service because both Server
 * Components and client components render trade names, and importing them from
 * a service would drag Prisma into the browser bundle. It is also the copy the
 * React Native app will reuse verbatim.
 */

export const TRADE_LABELS: Record<Trade, string> = {
  MASON: "Mason",
  ELECTRICIAN: "Electrician",
  PLUMBER: "Plumber",
  CARPENTER: "Carpenter",
  PAINTER: "Painter",
  TILE_WORKER: "Tile worker",
  HELPER: "Helper",
};

export const TRADE_ORDER: Trade[] = [
  "MASON",
  "ELECTRICIAN",
  "PLUMBER",
  "CARPENTER",
  "PAINTER",
  "TILE_WORKER",
  "HELPER",
];
