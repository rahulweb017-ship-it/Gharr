"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { DetailList } from "@/components/admin/Stat";

/**
 * Opens one audit entry: metadata, the top-level fields that changed, and the
 * raw before/after JSON side by side.
 */
export function AuditDiffButton({
  title,
  meta,
  before,
  after,
}: {
  title: string;
  meta: Array<{ label: string; value: string }>;
  before: unknown;
  after: unknown;
}) {
  const [open, setOpen] = useState(false);
  const changed = changedKeys(before, after);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        View
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} className="md:max-w-4xl">
        <DetailList items={meta} />
        {changed.length > 0 && (
          <p className="mt-4 text-sm text-ink-600">
            <span className="font-semibold text-ink-900">Changed:</span> {changed.join(", ")}
          </p>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <JsonBlock label="Before" value={before} />
          <JsonBlock label="After" value={after} />
        </div>
      </Sheet>
    </>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-bold tracking-wide text-ink-400 uppercase">{label}</p>
      <pre className="max-h-96 overflow-auto rounded-xl border border-ink-100 bg-ink-50 p-3 text-xs leading-relaxed text-ink-800">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function changedKeys(before: unknown, after: unknown): string[] {
  const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
  const b = obj(before);
  const a = obj(after);
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );
}
