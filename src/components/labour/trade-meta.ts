import {
  Axe,
  BrickWall,
  Droplets,
  Grid3x3,
  HardHat,
  PaintRoller,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Trade } from "@prisma/client";

/**
 * Presentation-only trade metadata for the labour screens: icon, tile tint,
 * one-line description and plural heading. Names themselves stay in
 * `@/shared/trades` so every surface spells a trade the same way.
 */
export const TRADE_META: Record<
  Trade,
  { icon: LucideIcon; subtitle: string; plural: string; tint: string }
> = {
  MASON: {
    icon: BrickWall,
    subtitle: "Brickwork, plastering",
    plural: "Masons",
    tint: "bg-brand-50 text-brand-700",
  },
  ELECTRICIAN: {
    icon: Zap,
    subtitle: "Wiring, fittings",
    plural: "Electricians",
    tint: "bg-amber-50 text-amber-700",
  },
  PLUMBER: {
    icon: Droplets,
    subtitle: "Pipelines, fixtures",
    plural: "Plumbers",
    tint: "bg-blue-50 text-blue-700",
  },
  CARPENTER: {
    icon: Axe,
    subtitle: "Woodwork, furniture",
    plural: "Carpenters",
    tint: "bg-orange-50 text-orange-800",
  },
  PAINTER: {
    icon: PaintRoller,
    subtitle: "Interior & exterior",
    plural: "Painters",
    tint: "bg-violet-50 text-violet-700",
  },
  TILE_WORKER: {
    icon: Grid3x3,
    subtitle: "Tile installation",
    plural: "Tile workers",
    tint: "bg-cyan-50 text-cyan-700",
  },
  HELPER: {
    icon: HardHat,
    subtitle: "Site support",
    plural: "Helpers",
    tint: "bg-ink-50 text-ink-700",
  },
};
