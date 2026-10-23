"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Bottom sheet on phones, centred dialog from md up. Built on the native
 * <dialog> element so focus trapping, Esc-to-close and the inert background
 * come from the browser rather than from hand-rolled code.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
      className={cn(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-(--radius-sheet) bg-white p-0 text-ink-900 shadow-(--shadow-raised)",
        "backdrop:bg-ink-950/50",
        "md:m-auto md:max-w-lg md:rounded-(--radius-sheet)",
        className,
      )}
    >
      <div className="flex max-h-[92dvh] flex-col">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-ink-50"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{open && children}</div>
        {footer && (
          <div
            className="border-t border-ink-100 px-5 py-3"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
