"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { BUCKET_LABELS, type EstimateBucket, type QuantityBasis } from "@/shared/estimate";
import { UNIT_META, type Unit } from "@/shared/units";
import { humanize } from "@/lib/admin-format";
import { cn } from "@/lib/cn";
import {
  CheckCell,
  NumberCell,
  cellInput,
  changedOnly,
  tableShell,
  tdClass,
  thClass,
  theadClass,
  useRowSave,
} from "@/components/admin/catalogue/inline-edit";

/**
 * Estimate rule table with in-place edits. Only the knobs an operator should
 * turn are editable — label, quantity per basis, wastage and on/off; the item
 * key, basis and unit define what the rule *is* and stay fixed.
 */

export interface RuleRowData {
  id: string;
  itemKey: string;
  label: string;
  bucket: EstimateBucket;
  basis: QuantityBasis;
  quantityPerBasis: number;
  unit: Unit | null;
  wastagePercent: number;
  isActive: boolean;
  sortOrder: number;
}

export function RulesTable({ rules }: { rules: RuleRowData[] }) {
  return (
    <div className={tableShell}>
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">Estimate rules</caption>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={cn(thClass, "text-right")}>#</th>
            <th scope="col" className={cn(thClass, "text-left")}>Line</th>
            <th scope="col" className={cn(thClass, "text-left")}>Bucket</th>
            <th scope="col" className={cn(thClass, "text-left")}>Basis</th>
            <th scope="col" className={cn(thClass, "text-right")}>Qty per basis</th>
            <th scope="col" className={cn(thClass, "text-left")}>Unit</th>
            <th scope="col" className={cn(thClass, "text-right")}>Wastage %</th>
            <th scope="col" className={cn(thClass, "text-center")}>Active</th>
            <th scope="col" className={cn(thClass, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow({ rule: r }: { rule: RuleRowData }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(r.label);
  const [qty, setQty] = useState(String(r.quantityPerBasis));
  const [wastage, setWastage] = useState(String(r.wastagePercent));
  const [active, setActive] = useState(r.isActive);
  const { busy, error, setError, save } = useRowSave(`/admin/estimate-pricing/rules/${r.id}`, () => setEditing(false));

  const percentLine = r.basis === "PERCENT_OF_SUBTOTAL";

  function reset() {
    setLabel(r.label);
    setQty(String(r.quantityPerBasis));
    setWastage(String(r.wastagePercent));
    setActive(r.isActive);
    setError(null);
    setEditing(false);
  }

  async function submit() {
    const next = { label: label.trim(), quantityPerBasis: Number(qty), wastagePercent: Number(wastage), isActive: active };
    if (next.label.length < 2) return setError("Label is too short");
    if (qty.trim() === "" || !(next.quantityPerBasis > 0)) return setError("Quantity per basis must be greater than 0");
    if (wastage.trim() === "" || !(next.wastagePercent >= 0 && next.wastagePercent <= 100)) {
      return setError("Wastage must be between 0 and 100%");
    }
    const body = changedOnly(
      { label: r.label, quantityPerBasis: r.quantityPerBasis, wastagePercent: r.wastagePercent, isActive: r.isActive },
      next,
    );
    if (Object.keys(body).length === 0) return reset();
    await save(body);
  }

  return (
    <>
      <tr className={cn(editing && "bg-brand-50/40", !r.isActive && !editing && "text-ink-400")}>
        <td className={cn(tdClass, "text-right tabular text-ink-400")}>{r.sortOrder}</td>
        <td className={tdClass}>
          {editing ? (
            <input aria-label={`Label for ${r.itemKey}`} value={label} onChange={(e) => setLabel(e.target.value)} className={cn(cellInput, "w-56")} />
          ) : (
            <p className="font-semibold text-ink-900">{r.label}</p>
          )}
          <p className="font-mono text-xs text-ink-400">{r.itemKey}</p>
        </td>
        <td className={tdClass}>{BUCKET_LABELS[r.bucket]}</td>
        <td className={cn(tdClass, "whitespace-nowrap")}>{humanize(r.basis)}</td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? (
            <NumberCell label={`Quantity per basis for ${r.itemKey}`} value={qty} onChange={setQty} />
          ) : (
            <span className="tabular">{r.quantityPerBasis}</span>
          )}
        </td>
        <td className={tdClass}>{r.unit ? UNIT_META[r.unit].short : percentLine ? "% of subtotal" : "—"}</td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? (
            <NumberCell label={`Wastage percent for ${r.itemKey}`} value={wastage} onChange={setWastage} className="w-20" />
          ) : (
            <span className="tabular">{r.wastagePercent}%</span>
          )}
        </td>
        <td className={cn(tdClass, "text-center")}>
          {editing ? (
            <CheckCell label={`Active: ${r.itemKey}`} checked={active} onChange={setActive} />
          ) : r.isActive ? (
            <Chip tone="trust">On</Chip>
          ) : (
            <Chip>Off</Chip>
          )}
        </td>
        <td className={cn(tdClass, "text-right whitespace-nowrap")}>
          {editing ? (
            <span className="inline-flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={submit} loading={busy}>
                Save
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={9} className="bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
