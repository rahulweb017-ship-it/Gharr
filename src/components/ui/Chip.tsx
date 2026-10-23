import * as React from "react";
import {
  BadgeCheck,
  CalendarClock,
  CircleDot,
  Truck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Status chips called for in the blueprint: Verified, Available Today,
 * Fast Delivery, Scheduled.
 *
 * These carry trust signals, so they are a named component rather than ad-hoc
 * spans — the wording and colour of "Verified" must be identical everywhere it
 * appears.
 */

type Tone = "neutral" | "brand" | "trust" | "info" | "warning" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-700",
  // Green is reserved for trust: verified, available, delivered.
  trust: "bg-trust-50 text-trust-700",
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

interface ChipProps {
  tone?: Tone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Chip({ tone = "neutral", icon, className, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function VerifiedChip({ label = "Verified" }: { label?: string }) {
  return (
    <Chip tone="trust" icon={<BadgeCheck aria-hidden className="size-3.5" />}>
      {label}
    </Chip>
  );
}

export function AvailableTodayChip() {
  return (
    <Chip tone="trust" icon={<CircleDot aria-hidden className="size-3.5" />}>
      Available today
    </Chip>
  );
}

export function FastDeliveryChip() {
  return (
    <Chip tone="info" icon={<Zap aria-hidden className="size-3.5" />}>
      Fast delivery
    </Chip>
  );
}

export function ScheduledDeliveryChip() {
  return (
    <Chip tone="warning" icon={<CalendarClock aria-hidden className="size-3.5" />}>
      Scheduled
    </Chip>
  );
}

export function PickupChip() {
  return (
    <Chip tone="neutral" icon={<Truck aria-hidden className="size-3.5" />}>
      Pickup only
    </Chip>
  );
}

/** Picks the right delivery chip for a variant's mode. */
export function DeliveryChip({ mode }: { mode: "STANDARD" | "SCHEDULED" | "PICKUP" }) {
  if (mode === "SCHEDULED") return <ScheduledDeliveryChip />;
  if (mode === "PICKUP") return <PickupChip />;
  return <FastDeliveryChip />;
}
