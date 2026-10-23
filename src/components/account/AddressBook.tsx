"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Surface";
import { Sheet } from "@/components/ui/Sheet";
import { apiDelete, apiPatch } from "@/lib/api-client";
import { formatPhone } from "@/shared/phone";
import { AddressForm, formatAddress, type SavedAddress } from "./AddressForm";

/** Address book with add / edit / delete / set-default, all via /api/v1/addresses. */
export function AddressBook({
  addresses,
  defaults,
}: {
  addresses: SavedAddress[];
  defaults: { contactName?: string; contactPhone?: string; city?: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(id: string, action: () => Promise<{ ok: boolean; error?: { message: string } }>) {
    setBusyId(id);
    setError(null);
    const result = await action();
    setBusyId(null);
    if (!result.ok) setError(result.error?.message ?? "Something went wrong");
    router.refresh();
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {addresses.length === 0 ? (
        <EmptyState
          icon={<MapPin aria-hidden className="size-7" />}
          title="No saved addresses"
          description="Add your home or site address to check out and book workers faster."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-ink-900">{address.contactName}</span>
                <Chip tone="neutral">{address.type}</Chip>
                {address.isDefault && <Chip tone="brand">Default</Chip>}
              </div>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-ink-600">
                {formatAddress(address)}, {address.state}
              </p>
              <p className="mt-1 text-xs text-ink-400">{formatPhone(address.contactPhone)}</p>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-ink-100 pt-3">
                <Button size="sm" variant="ghost" onClick={() => setEditing(address)}>
                  <Pencil aria-hidden className="size-4" /> Edit
                </Button>
                {!address.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyId === address.id}
                    onClick={() => run(address.id, () => apiPatch(`/addresses/${address.id}`, { isDefault: true }))}
                  >
                    <Star aria-hidden className="size-4" /> Set default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-red-600 hover:bg-red-50"
                  aria-label={`Delete address for ${address.contactName}`}
                  onClick={() => {
                    if (window.confirm("Delete this address?")) {
                      void run(address.id, () => apiDelete(`/addresses/${address.id}`));
                    }
                  }}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button fullWidth size="lg" className="mt-5 md:w-auto" onClick={() => setEditing("new")}>
        <Plus aria-hidden className="size-5" /> Add new address
      </Button>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add new address" : "Edit address"}
      >
        {editing !== null && (
          <AddressForm
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            defaults={defaults}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}
