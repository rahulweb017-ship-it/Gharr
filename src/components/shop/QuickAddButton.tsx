"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatQuantity, type Unit } from "@/shared/units";

/**
 * The orange "+" on product cards.
 *
 * Listing items carry only the cheapest price, not a variant id or MOQ, so the
 * button fetches the product detail on tap and adds the cheapest in-stock offer
 * at that seller's minimum order — the same offer BuyBox preselects. Anything
 * that needs a decision (no stock, fetch failure) falls back to the product
 * page rather than guessing.
 */

interface OfferLite {
  id: string;
  unit: string;
  moqQuantity: number;
  stockQuantity: number;
}

export function QuickAddButton({
  slug,
  productName,
  inStock,
  className,
}: {
  slug: string;
  productName: string;
  inStock: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
      setState("idle");
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const productHref = `/product/${slug}`;

  async function add() {
    if (state === "busy") return;
    if (!inStock) {
      router.push(productHref);
      return;
    }

    setState("busy");
    const detail = await apiGet<{ variants: OfferLite[] }>(`/products/${encodeURIComponent(slug)}`);
    // Variants arrive cheapest first; take the first that can fill its own MOQ.
    const offer = detail.ok
      ? detail.data.variants.find((v) => v.stockQuantity >= v.moqQuantity)
      : undefined;

    if (!offer) {
      setState("idle");
      router.push(productHref);
      return;
    }

    const result = await apiPost("/cart/items", {
      variantId: offer.id,
      quantity: offer.moqQuantity,
    });

    if (!result.ok) {
      setState("idle");
      if (result.error.code === "UNAUTHENTICATED") {
        // Read at click time rather than via useSearchParams, which would force
        // a Suspense boundary on every static page that renders a card.
        const next = `${window.location.pathname}${window.location.search}`;
        router.push(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      setToast(result.error.message);
      return;
    }

    setState("added");
    setToast(`Added ${formatQuantity(offer.moqQuantity, offer.unit as Unit)} to cart`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={add}
        aria-label={inStock ? `Add ${productName} to cart` : `View ${productName}`}
        className={cn(
          "flex size-11 items-center justify-center rounded-full text-white shadow-(--shadow-cta) transition-colors",
          state === "added" ? "bg-trust-600" : "bg-brand-600 hover:bg-brand-700 active:bg-brand-800",
          !inStock && "bg-ink-300 shadow-none hover:bg-ink-400",
          className,
        )}
      >
        {state === "busy" ? (
          <Loader2 aria-hidden className="size-5 animate-spin" />
        ) : state === "added" ? (
          <Check aria-hidden className="size-5" strokeWidth={3} />
        ) : (
          <Plus aria-hidden className="size-5" strokeWidth={2.75} />
        )}
      </button>

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 transition-opacity",
          toast ? "opacity-100" : "opacity-0",
        )}
        style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 16px)" }}
      >
        {toast && (
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl bg-ink-900 px-4 py-3 text-sm text-white shadow-(--shadow-raised)">
            <span className="min-w-0 flex-1">{toast}</span>
            {state === "added" && (
              <Link href="/cart" className="shrink-0 font-semibold text-brand-300 hover:text-brand-200">
                View cart
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
