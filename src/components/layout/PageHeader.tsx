import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * The per-screen title bar from the UI boards: back chevron, centred-weight
 * title, optional actions on the right.
 *
 * On phones it is a sticky white bar. From md up the TopNav is the sticky
 * element, so this becomes an ordinary page heading in the content column.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Omit for top-level tabs, which have nothing to go back to. */
  backHref?: string;
  actions?: React.ReactNode;
  className?: string;
  /** Extra content below the title row, e.g. tabs or a search box. */
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur",
        "md:static md:border-0 md:bg-transparent md:backdrop-blur-none",
        className,
      )}
    >
      <div className="flex min-h-14 items-center gap-1 px-2 py-2 md:px-0 md:pt-8 md:pb-4">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="Back"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 md:-ml-2"
          >
            <ChevronLeft aria-hidden className="size-6" />
          </Link>
        ) : (
          <span className="w-2 md:hidden" />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold tracking-tight text-ink-900 md:text-2xl">
            {title}
          </h1>
          {subtitle && <p className="truncate text-xs text-ink-500 md:text-sm">{subtitle}</p>}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-1 pr-1">{actions}</div>}
      </div>

      {children && <div className="px-4 pb-3 md:px-0">{children}</div>}
    </header>
  );
}
