"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { apiDelete } from "@/lib/api-client";

/**
 * The result screen's ⋮ menu: edit, or delete behind a confirmation. Deleting
 * is permanent, so it always asks first and names the estimate being removed.
 */
export function EstimateActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setConfirming(false);
    setError(null);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await apiDelete<null>(`/estimates/${id}`);
    if (result.ok) {
      router.push("/estimate");
      router.refresh();
      return;
    }
    setBusy(false);
    if (result.error.code === "UNAUTHENTICATED") {
      router.push(`/login?next=${encodeURIComponent(`/estimate/${id}`)}`);
      return;
    }
    setError(result.error.message);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Estimate actions"
        aria-haspopup="dialog"
        className="flex size-11 items-center justify-center rounded-full text-ink-700 hover:bg-ink-50"
      >
        <EllipsisVertical aria-hidden className="size-5" />
      </button>

      <Sheet open={open} onClose={close} title={confirming ? "Delete estimate?" : "Estimate"}>
        {confirming ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              <span className="font-semibold text-ink-900">{title}</span> and its itemised lines will be
              removed permanently. This can&apos;t be undone.
            </p>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button variant="ghost" fullWidth onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" fullWidth onClick={remove} loading={busy}>
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <ul className="-mx-2">
            <li>
              <Link
                href={`/estimate/${id}/edit`}
                className="flex min-h-12 items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-ink-900 hover:bg-ink-50"
              >
                <Pencil aria-hidden className="size-5 text-ink-500" />
                Edit inputs
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-[15px] font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 aria-hidden className="size-5" />
                Delete estimate
              </button>
            </li>
          </ul>
        )}
      </Sheet>
    </>
  );
}
