"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { formatQuantity, type Unit } from "@/shared/units";
import { cn } from "@/lib/cn";
import {
  CheckCell,
  NumberCell,
  changedOnly,
  paiseToRupees,
  rupeesToPaise,
  tableShell,
  tdClass,
  thClass,
  theadClass,
  useRowSave,
} from "./inline-edit";

/**
 * The product page's variant table. Each row edits in place: price and MRP are
 * typed in rupees and sent as paise, stock and threshold in the variant's unit.
 * The server re-validates everything (MRP ≥ price against stored values too).
 */

export interface VariantRowData {
  id: string;
  sku: string;
  label: string;
  unit: Unit;
  pricePaise: number;
  mrpPaise: number;
  isActive: boolean;
  vendorName: string;
  vendorActive: boolean;
  quantityAvailable: number;
  lowStockThreshold: number;
}

export function VariantsTable({ variants }: { variants: VariantRowData[] }) {
  if (variants.length === 0) {
    return <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-500">No sellers list this product.</p>;
  }
  return (
    <div className={tableShell}>
      <table className="w-full min-w-[60rem] text-sm">
        <caption className="sr-only">Seller offers for this product</caption>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={cn(thClass, "text-left")}>Vendor</th>
            <th scope="col" className={cn(thClass, "text-left")}>SKU / label</th>
            <th scope="col" className={cn(thClass, "text-right")}>Price</th>
            <th scope="col" className={cn(thClass, "text-right")}>MRP</th>
            <th scope="col" className={cn(thClass, "text-right")}>Stock</th>
            <th scope="col" className={cn(thClass, "text-right")}>Low-stock at</th>
            <th scope="col" className={cn(thClass, "text-center")}>Active</th>
            <th scope="col" className={cn(thClass, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VariantRow({ variant: v }: { variant: VariantRowData }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(paiseToRupees(v.pricePaise));
  const [mrp, setMrp] = useState(paiseToRupees(v.mrpPaise));
  const [stock, setStock] = useState(String(v.quantityAvailable));
  const [threshold, setThreshold] = useState(String(v.lowStockThreshold));
  const [active, setActive] = useState(v.isActive);
  const { busy, error, setError, save } = useRowSave(`/admin/catalogue/variants/${v.id}`, () => setEditing(false));

  const low = v.quantityAvailable <= v.lowStockThreshold;

  function reset() {
    setPrice(paiseToRupees(v.pricePaise));
    setMrp(paiseToRupees(v.mrpPaise));
    setStock(String(v.quantityAvailable));
    setThreshold(String(v.lowStockThreshold));
    setActive(v.isActive);
    setError(null);
    setEditing(false);
  }

  async function submit() {
    const next = {
      pricePaise: rupeesToPaise(price),
      mrpPaise: rupeesToPaise(mrp),
      quantityAvailable: Number(stock),
      lowStockThreshold: Number(threshold),
      isActive: active,
    };
    const blank = [price, mrp, stock, threshold].some((s) => s.trim() === "");
    if (blank || [next.pricePaise, next.mrpPaise, next.quantityAvailable, next.lowStockThreshold].some((n) => !Number.isFinite(n))) {
      setError("Fill in every number");
      return;
    }
    if (next.mrpPaise < next.pricePaise) {
      setError("MRP cannot be lower than the selling price");
      return;
    }
    const body = changedOnly(
      {
        pricePaise: v.pricePaise,
        mrpPaise: v.mrpPaise,
        quantityAvailable: v.quantityAvailable,
        lowStockThreshold: v.lowStockThreshold,
        isActive: v.isActive,
      },
      next,
    );
    if (Object.keys(body).length === 0) {
      reset();
      return;
    }
    await save(body);
  }

  return (
    <>
      <tr className={cn(editing && "bg-brand-50/40")}>
        <td className={tdClass}>
          <p className="font-semibold text-ink-900">{v.vendorName}</p>
          {!v.vendorActive && <p className="text-xs text-amber-700">Vendor inactive</p>}
        </td>
        <td className={tdClass}>
          <p className="font-mono text-xs text-ink-500">{v.sku}</p>
          <p>{v.label}</p>
        </td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? <NumberCell label={`Price in rupees for ${v.sku}`} value={price} onChange={setPrice} /> : <Money paise={v.pricePaise} className="font-semibold" />}
        </td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? <NumberCell label={`MRP in rupees for ${v.sku}`} value={mrp} onChange={setMrp} /> : <Money paise={v.mrpPaise} className="text-ink-500" />}
        </td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? (
            <NumberCell label={`Stock for ${v.sku}`} value={stock} onChange={setStock} />
          ) : (
            <span className="inline-flex items-center gap-2">
              {low && <Chip tone="warning">Low</Chip>}
              <span className="tabular">{formatQuantity(v.quantityAvailable, v.unit)}</span>
            </span>
          )}
        </td>
        <td className={cn(tdClass, "text-right")}>
          {editing ? (
            <NumberCell label={`Low-stock threshold for ${v.sku}`} value={threshold} onChange={setThreshold} />
          ) : (
            <span className="tabular text-ink-500">{formatQuantity(v.lowStockThreshold, v.unit)}</span>
          )}
        </td>
        <td className={cn(tdClass, "text-center")}>
          {editing ? (
            <CheckCell label={`Active: ${v.sku}`} checked={active} onChange={setActive} />
          ) : v.isActive ? (
            <Chip tone="trust">Active</Chip>
          ) : (
            <Chip>Inactive</Chip>
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
          <td colSpan={8} className="bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}
