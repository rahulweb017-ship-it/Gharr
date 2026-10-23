"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { UNIT_META, type Unit } from "@/shared/units";
import { cn } from "@/lib/cn";
import {
  NumberCell,
  changedOnly,
  paiseToRupees,
  rupeesToPaise,
  tableShell,
  tdClass,
  thClass,
  theadClass,
  useRowSave,
} from "@/components/admin/catalogue/inline-edit";

/**
 * Estimate price table. Each row shows the stored unit price next to what the
 * shop implies right now (cheapest live pack ÷ coverage), so drift is visible
 * before anyone syncs. Manual rows (labour, fees) have no live price.
 */

export interface PriceRowData {
  id: string;
  itemKey: string;
  label: string | null;
  unit: Unit | null;
  unitPricePaise: number;
  packCoverage: number;
  productId: string | null;
  productName: string | null;
  livePricePaise: number | null;
  liveNote: string | null;
  driftPercent: number | null;
}

export function PricesTable({ prices }: { prices: PriceRowData[] }) {
  return (
    <div className={tableShell}>
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">Estimate unit prices</caption>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={cn(thClass, "text-left")}>Item</th>
            <th scope="col" className={cn(thClass, "text-left")}>Linked product</th>
            <th scope="col" className={cn(thClass, "text-right")}>Pack covers</th>
            <th scope="col" className={cn(thClass, "text-right")}>Unit price</th>
            <th scope="col" className={cn(thClass, "text-right")}>Live derived</th>
            <th scope="col" className={cn(thClass, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {prices.map((p) => (
            <PriceRow key={p.id} price={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriceRow({ price: p }: { price: PriceRowData }) {
  const [editing, setEditing] = useState(false);
  const [unitPrice, setUnitPrice] = useState(paiseToRupees(p.unitPricePaise));
  const [coverage, setCoverage] = useState(String(p.packCoverage));
  const { busy, error, setError, save } = useRowSave(`/admin/estimate-pricing/prices/${p.id}`, () => setEditing(false));

  const unit = p.unit ? UNIT_META[p.unit].short : null;

  function reset() {
    setUnitPrice(paiseToRupees(p.unitPricePaise));
    setCoverage(String(p.packCoverage));
    setError(null);
    setEditing(false);
  }

  async function submit() {
    const next = { unitPricePaise: rupeesToPaise(unitPrice), packCoverage: Number(coverage) };
    if (!(next.unitPricePaise > 0)) return setError("Unit price must be more than ₹0");
    if (coverage.trim() === "" || !(next.packCoverage > 0)) return setError("Pack coverage must be greater than 0");
    const body = changedOnly({ unitPricePaise: p.unitPricePaise, packCoverage: p.packCoverage }, next);
    if (Object.keys(body).length === 0) return reset();
    await save(body);
  }

  return (
    <>
      <tr className={cn(editing && "bg-brand-50/40")}>
        <td className={tdClass}>
          <p className="font-semibold text-ink-900">{p.label ?? p.itemKey}</p>
          <p className="font-mono text-xs text-ink-400">{p.itemKey}</p>
        </td>
        <td className={tdClass}>
          {p.productId ? (
            <Link href={`/admin/catalogue/${p.productId}`} className="font-medium text-brand-700 hover:underline">
              {p.productName}
            </Link>
          ) : (
            <span className="text-ink-400">Manual price</span>
          )}
        </td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? (
            <NumberCell label={`Pack coverage for ${p.itemKey}`} value={coverage} onChange={setCoverage} className="w-20" />
          ) : (
            <span className="tabular">
              {p.packCoverage}
              {unit && <span className="text-ink-400"> {unit}</span>}
            </span>
          )}
        </td>
        <td className={cn(tdClass, "text-right whitespace-nowrap")}>
          {editing ? (
            <NumberCell label={`Unit price in rupees for ${p.itemKey}`} value={unitPrice} onChange={setUnitPrice} />
          ) : (
            <>
              <Money paise={p.unitPricePaise} className="font-semibold" />
              {unit && <span className="text-xs text-ink-500"> /{unit}</span>}
            </>
          )}
        </td>
        <td className={cn(tdClass, "text-right whitespace-nowrap")}>
          {p.livePricePaise != null ? (
            <span className="inline-flex items-center gap-2">
              {p.driftPercent !== 0 && p.driftPercent != null && (
                <Chip tone={Math.abs(p.driftPercent) >= 5 ? "warning" : "info"}>
                  {p.driftPercent > 0 ? "+" : ""}
                  {p.driftPercent}%
                </Chip>
              )}
              <Money paise={p.livePricePaise} />
            </span>
          ) : (
            <span className={cn("text-xs", p.productId ? "text-amber-700" : "text-ink-400")}>{p.productId ? p.liveNote : "—"}</span>
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
      {editing && p.productId && (
        <tr>
          <td colSpan={6} className="bg-brand-50/40 px-3 pb-2 text-xs text-ink-500">
            This price is linked to a product — the next “Sync material prices” will overwrite a hand-typed unit price.
          </td>
        </tr>
      )}
      {error && (
        <tr>
          <td colSpan={6} className="bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
