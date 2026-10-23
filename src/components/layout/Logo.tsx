import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Gharr mark and wordmark.
 *
 * A navy roof line over an orange "building block" — the materials-plus-labour
 * idea in one glyph. Inline SVG so it inherits no network cost and stays crisp
 * at every size; the wordmark is live text so it is selectable and accessible.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={cn("size-8", className)}
      fill="none"
    >
      <path
        d="M5 22.5 24 7l19 15.5"
        stroke="var(--color-ink-900)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 20v19.5a2.5 2.5 0 0 0 2.5 2.5h21a2.5 2.5 0 0 0 2.5-2.5V20"
        stroke="var(--color-ink-900)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M19 42V30h8v-9h6v21" fill="var(--color-brand-500)" />
      <rect x="31" y="9" width="5" height="10" rx="1.2" fill="var(--color-brand-500)" />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = "dark",
}: {
  className?: string;
  /** "light" for use on the navy hero. */
  tone?: "dark" | "light";
}) {
  return (
    <span className={cn("text-xl font-extrabold tracking-tight", className)}>
      <span className={tone === "light" ? "text-white" : "text-ink-900"}>Ghar</span>
      <span className="text-brand-500">r</span>
    </span>
  );
}

export function Logo({
  href = "/",
  className,
  tone = "dark",
  size = "md",
}: {
  href?: string | null;
  className?: string;
  tone?: "dark" | "light";
  size?: "md" | "lg";
}) {
  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={size === "lg" ? "size-14" : "size-8"} />
      <Wordmark tone={tone} className={size === "lg" ? "text-4xl" : "text-xl"} />
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} aria-label="Gharr home">
      {content}
    </Link>
  );
}
