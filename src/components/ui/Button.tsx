import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // The orange CTA from the UI boards: a subtle top-to-bottom gradient and a
  // warm glow, flattened when disabled so an unavailable action never looks live.
  primary:
    "bg-linear-to-b from-brand-500 to-brand-600 text-white shadow-(--shadow-cta) hover:from-brand-600 hover:to-brand-700 active:to-brand-800 disabled:from-brand-300 disabled:to-brand-300 disabled:shadow-none",
  secondary:
    "bg-ink-900 text-white hover:bg-ink-800 active:bg-ink-950 disabled:bg-ink-300",
  outline:
    "border border-brand-600 bg-white text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:border-ink-200 disabled:text-ink-300",
  ghost:
    "bg-transparent text-ink-700 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300",
  danger:
    "bg-(--color-danger) text-white hover:brightness-95 active:brightness-90 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  // 44px minimum touch target on md/lg — below that, thumbs miss.
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[15px] gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

const BASE =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-colors select-none " +
  "disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & {
  href: string;
  prefetch?: boolean;
};

/** Same visual language as Button, for navigation rather than actions. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  prefetch,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}
