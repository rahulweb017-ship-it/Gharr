import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/** "★ 4.5 (1.2k)" — the compact rating used on product and worker cards. */
export function RatingStars({
  rating,
  count,
  className,
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  if (!rating) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-semibold text-ink-800", className)}
      aria-label={`Rated ${rating.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <Star aria-hidden className="size-3.5 fill-amber-400 text-amber-400" />
      {rating.toFixed(1)}
      {count != null && count > 0 && (
        <span className="font-medium text-ink-400">({compactCount(count)})</span>
      )}
    </span>
  );
}

function compactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
