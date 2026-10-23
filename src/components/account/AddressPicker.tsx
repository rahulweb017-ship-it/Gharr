"use client";

import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/shared/phone";
import { Sheet } from "@/components/ui/Sheet";
import { AddressForm, formatAddress, type SavedAddress } from "./AddressForm";

/**
 * Address selection for checkout and labour booking.
 *
 * Shows the saved addresses as radio cards and always offers "Add new address"
 * in a sheet — so a first-time customer with no addresses is never stuck. A
 * newly saved address is selected automatically.
 */
export function AddressPicker({
  addresses: initialAddresses,
  selectedId,
  onSelect,
  defaults,
  label = "Delivery address",
}: {
  addresses: SavedAddress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  defaults?: { contactName?: string; contactPhone?: string; city?: string };
  label?: string;
}) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      {addresses.length === 0 && (
        <div className="rounded-(--radius-card) border border-dashed border-ink-200 p-4 text-sm text-ink-500">
          You have no saved addresses yet. Add one to continue.
        </div>
      )}

      <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5">
        {addresses.map((address) => {
          const selected = address.id === selectedId;
          return (
            <button
              key={address.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(address.id)}
              className={cn(
                "flex gap-3 rounded-(--radius-card) border p-3.5 text-left transition-colors",
                selected ? "border-brand-600 bg-brand-50/60" : "border-ink-100 hover:border-ink-200",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-brand-600" : "border-ink-300",
                )}
              >
                {selected && <span className="size-2.5 rounded-full bg-brand-600" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  {address.contactName}
                  <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-ink-500 uppercase">
                    {address.type}
                  </span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-ink-600">{formatAddress(address)}</span>
                <span className="mt-0.5 block text-xs text-ink-400">{formatPhone(address.contactPhone)}</span>
              </span>
              <MapPin aria-hidden className={cn("size-5 shrink-0", selected ? "text-brand-600" : "text-ink-300")} />
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center justify-center gap-2 rounded-(--radius-card) border border-dashed border-brand-300 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        <Plus aria-hidden className="size-4" />
        Add new address
      </button>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add new address">
        <AddressForm
          defaults={defaults}
          onCancel={() => setAdding(false)}
          onSaved={(saved) => {
            setAddresses((list) => [
              saved,
              ...list.map((a) => (saved.isDefault ? { ...a, isDefault: false } : a)),
            ]);
            onSelect(saved.id);
            setAdding(false);
          }}
        />
      </Sheet>
    </div>
  );
}
