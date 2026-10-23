import {
  Anvil,
  Bath,
  BrickWall,
  DoorOpen,
  Droplets,
  FlaskConical,
  Grid3x3,
  Hammer,
  LampCeiling,
  Layers,
  Mountain,
  Package,
  PaintRoller,
  PlugZap,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Category glyphs.
 *
 * Seeded category images are placeholders, so the shop grid draws a crisp
 * lucide icon on a tinted tile keyed off `iconKey` instead. Tints rotate through
 * a small warm/cool set so a 15-tile grid does not read as one flat block.
 */

const ICONS: Record<string, LucideIcon> = {
  cement: Package,
  bricks: BrickWall,
  steel: Anvil,
  sand: Mountain,
  tiles: Grid3x3,
  paint: PaintRoller,
  electrical: PlugZap,
  plumbing: Droplets,
  sanitary: Bath,
  tools: Hammer,
  plywood: Layers,
  doors: DoorOpen,
  ceiling: LampCeiling,
  adhesives: FlaskConical,
  repair: Wrench,
};

const TINTS = [
  "bg-brand-50 text-brand-600",
  "bg-ink-50 text-ink-800",
  "bg-amber-50 text-amber-600",
  "bg-sky-50 text-sky-700",
] as const;

export function CategoryIcon({
  iconKey,
  index = 0,
  className,
}: {
  iconKey: string | null | undefined;
  /** Position in the grid, used only to pick a tint. */
  index?: number;
  className?: string;
}) {
  const Icon = (iconKey && ICONS[iconKey]) || Package;

  return (
    <span
      aria-hidden
      className={cn(
        "flex items-center justify-center rounded-2xl",
        TINTS[index % TINTS.length],
        className,
      )}
    >
      <Icon className="size-7" strokeWidth={1.75} />
    </span>
  );
}
