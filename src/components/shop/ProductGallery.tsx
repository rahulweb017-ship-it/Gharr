"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Product image gallery: a scroll-snap strip with position dots.
 *
 * Native horizontal scrolling gives swipe on phones for free; the dots only
 * track and jump the scroll position, so there is no carousel state to desync.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const strip = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-(--radius-card) bg-ink-50 text-sm text-ink-300">
        No image
      </div>
    );
  }

  function onScroll() {
    const el = strip.current;
    if (!el) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index: number) {
    const el = strip.current;
    el?.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative overflow-hidden rounded-(--radius-card) bg-ink-50">
      <div
        ref={strip}
        onScroll={onScroll}
        className="no-scrollbar flex aspect-square w-full snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((src, index) => (
          <div key={src} className="relative aspect-square w-full shrink-0 snap-center">
            <Image
              src={src}
              alt={images.length > 1 ? `${name}, image ${index + 1} of ${images.length}` : name}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1">
          {images.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active || undefined}
              className="flex size-6 items-center justify-center"
            >
              <span
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === active ? "w-4 bg-ink-900" : "w-1.5 bg-ink-300",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
