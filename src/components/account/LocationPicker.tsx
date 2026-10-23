"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * "Set your location" from the UI boards.
 *
 * The choice is a preference cookie read by server pages (home header, the
 * estimate wizard's city). Geolocation only picks the nearest *served* city —
 * coordinates are never sent to the server.
 */

/** City centres for the "use my current location" shortcut. */
const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Pune: { lat: 18.5204, lng: 73.8567 },
};

/** Metro areas are large; 60 km from the centre still counts as the city. */
const SERVICE_RADIUS_KM = 60;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function saveCity(city: string) {
  // One year; SameSite=Lax. Not httpOnly — it is a display preference.
  document.cookie = `ha_city=${encodeURIComponent(city)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function LocationPicker({
  current,
  liveCities,
  popularCities,
  next,
}: {
  current: string;
  liveCities: string[];
  popularCities: string[];
  next: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(current);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? popularCities.filter((c) => c.toLowerCase().includes(q)) : popularCities;
  }, [query, popularCities]);

  const isLive = (city: string) => liveCities.includes(city);

  function confirm(city: string) {
    saveCity(city);
    router.push(next.startsWith("/") ? next : "/");
    router.refresh();
  }

  function useCurrentLocation() {
    setMessage(null);
    if (!("geolocation" in navigator)) {
      setMessage("Location isn't available in this browser. Pick your city below.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        const nearest = liveCities
          .map((city) => ({ city, km: CITY_CENTRES[city] ? distanceKm(here, CITY_CENTRES[city]) : Infinity }))
          .sort((a, b) => a.km - b.km)[0];

        if (nearest && nearest.km <= SERVICE_RADIUS_KM) {
          setSelected(nearest.city);
          confirm(nearest.city);
        } else {
          setMessage(
            `We're not in your area yet — Gharr currently serves ${liveCities.join(", ")}. You can still browse and get estimates for a served city.`,
          );
        }
      },
      () => {
        setLocating(false);
        setMessage("We couldn't get your location. Pick your city below.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className="px-4 pb-8 md:px-0">
      <div className="flex flex-col items-center pt-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <MapPin aria-hidden className="size-8" />
        </span>
        <h2 className="mt-4 text-xl font-bold text-ink-900">Set your location</h2>
        <p className="mt-1 max-w-xs text-sm text-ink-500">
          Get accurate prices, materials and labour options in your city.
        </p>
      </div>

      <Button variant="secondary" fullWidth size="lg" className="mt-6" loading={locating} onClick={useCurrentLocation}>
        <LocateFixed aria-hidden className="size-5" />
        Use my current location
      </Button>

      {message && (
        <p role="status" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {message}
        </p>
      )}

      <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink-400">
        <span className="h-px flex-1 bg-ink-100" /> OR <span className="h-px flex-1 bg-ink-100" />
      </div>

      <label className="flex h-12 items-center gap-2 rounded-xl border border-ink-200 px-3 focus-within:border-brand-600">
        <Search aria-hidden className="size-5 text-ink-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your city"
          aria-label="Search your city"
          className="flex-1 bg-transparent text-[15px] outline-none"
        />
      </label>

      <h3 className="mt-6 text-sm font-bold text-ink-900">Popular cities</h3>
      <div role="radiogroup" aria-label="Popular cities" className="mt-3 grid grid-cols-3 gap-2.5">
        {matches.map((city) => {
          const active = city === selected;
          const live = isLive(city);
          return (
            <button
              key={city}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!live}
              onClick={() => setSelected(city)}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-2 text-sm font-semibold transition-colors",
                active && "border-ink-900 bg-ink-900 text-white",
                !active && live && "border-ink-200 text-ink-800 hover:border-ink-300",
                !live && "cursor-not-allowed border-ink-100 text-ink-300",
              )}
            >
              <span className="flex items-center gap-1">
                {active && <Check aria-hidden className="size-4" />}
                {city}
              </span>
              {!live && <span className="text-[10px] font-medium">Coming soon</span>}
            </button>
          );
        })}
      </div>
      {matches.length === 0 && (
        <p className="mt-3 text-sm text-ink-500">
          We don&apos;t serve that city yet. Gharr is live in {liveCities.join(", ")}.
        </p>
      )}

      <Button fullWidth size="lg" className="mt-8" disabled={!isLive(selected)} onClick={() => confirm(selected)}>
        Confirm {selected}
      </Button>

      <p className="mt-4 text-center text-xs text-ink-400">Local data. Accurate estimates. Stronger homes.</p>
    </div>
  );
}
