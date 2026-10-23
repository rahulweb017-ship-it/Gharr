"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPatch } from "@/lib/api-client";
import { inputClass } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/**
 * Shared bits for the admin's inline-editable table rows (variants, estimate
 * rules, estimate prices): a PATCH-and-refresh hook, and compact inputs sized
 * for a table cell rather than a full-width form.
 */

export function useRowSave(path: string, onSaved: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await apiPatch(path, body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return false;
    }
    onSaved();
    router.refresh();
    return true;
  }

  return { busy, error, setError, save };
}

export const cellInput = cn(inputClass, "h-9 rounded-lg px-2.5 text-sm");

/** A numeric text field that only accepts digits and one decimal point. */
export function NumberCell({
  value,
  onChange,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))}
      className={cn(cellInput, "w-24 text-right tabular", className)}
    />
  );
}

export function CheckCell({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 accent-brand-600"
    />
  );
}

/** Rupees typed by an admin → integer paise, or NaN when not a number. */
export function rupeesToPaise(value: string): number {
  if (value.trim() === "") return Number.NaN;
  return Math.round(Number(value) * 100);
}

export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}

/** Only the fields that differ from the row, so the audit diff stays honest. */
export function changedOnly<T extends Record<string, unknown>>(current: T, next: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as Array<keyof T>) {
    if (next[key] !== current[key]) out[key] = next[key];
  }
  return out;
}

export const tableShell = "overflow-x-auto rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)";
export const theadClass = "bg-ink-50 text-xs font-bold tracking-wide text-ink-500 uppercase";
export const thClass = "px-3 py-3 whitespace-nowrap";
export const tdClass = "px-3 py-2.5 align-middle text-ink-800";
