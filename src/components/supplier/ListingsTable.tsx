"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "@/components/admin/catalogue/inline-edit";

/**
 * The supplier's own offers, editable in place like the admin variant table:
 * price and MRP in rupees, stock in the offer's unit. The server re-validates
 * and scopes every save to this supplier.
 */

export interface ListingRow {
  id: string;
  sku: string;
  label: string;
  unit: Unit;
  pricePaise: number;
  mrpPaise: number;
  isActive: boolean;
  stock: number;
  lowStockThreshold: number;
  lowStock: boolean;
  product: { name: string; slug: string; isActive: boolean; reviewStatus: "PENDING" | "APPROVED" | "REJECTED"; category: string };
}

export function ListingsTable({ rows, canEdit }: { rows: ListingRow[]; canEdit: boolean }) {
  return (
    <div className={tableShell}>
      <table className="w-full min-w-[62rem] text-sm">
        <caption className="sr-only">Your listings</caption>
        <thead className={theadClass}>
          <tr>
            <th scope="col" className={cn(thClass, "text-left")}>Product</th>
            <th scope="col" className={cn(thClass, "text-left")}>SKU / pack</th>
            <th scope="col" className={cn(thClass, "text-right")}>Price</th>
            <th scope="col" className={cn(thClass, "text-right")}>MRP</th>
            <th scope="col" className={cn(thClass, "text-right")}>Stock</th>
            <th scope="col" className={cn(thClass, "text-right")}>Low-stock at</th>
            <th scope="col" className={cn(thClass, "text-center")}>Selling</th>
            <th scope="col" className={cn(thClass, "text-right")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <Row key={row.id} row={row} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductState({ product }: { product: ListingRow["product"] }) {
  if (product.reviewStatus === "PENDING") return <Chip tone="warning">Awaiting approval</Chip>;
  if (product.reviewStatus === "REJECTED") return <Chip tone="danger">Not approved</Chip>;
  if (!product.isActive) return <Chip>Product off sale</Chip>;
  return null;
}

function Row({ row: v, canEdit }: { row: ListingRow; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(paiseToRupees(v.pricePaise));
  const [mrp, setMrp] = useState(paiseToRupees(v.mrpPaise));
  const [stock, setStock] = useState(String(v.stock));
  const [threshold, setThreshold] = useState(String(v.lowStockThreshold));
  const [active, setActive] = useState(v.isActive);
  const { busy, error, setError, save } = useRowSave(`/vendor/variants/${v.id}`, () => setEditing(false));

  function reset() {
    setPrice(paiseToRupees(v.pricePaise));
    setMrp(paiseToRupees(v.mrpPaise));
    setStock(String(v.stock));
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
      { pricePaise: v.pricePaise, mrpPaise: v.mrpPaise, quantityAvailable: v.stock, lowStockThreshold: v.lowStockThreshold, isActive: v.isActive },
      next,
    );
    if (Object.keys(body).length === 0) {
      reset();
      return;
    }
    await save(body);
  }

  const live = v.product.isActive && v.product.reviewStatus === "APPROVED";

  return (
    <>
      <tr className={cn(editing && "bg-brand-50/40")}>
        <td className={tdClass}>
          {live ? (
            <Link href={`/product/${v.product.slug}`} className="font-semibold text-ink-900 hover:underline">
              {v.product.name}
            </Link>
          ) : (
            <p className="font-semibold text-ink-900">{v.product.name}</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-ink-400">{v.product.category}</span>
            <ProductState product={v.product} />
          </div>
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
              {v.lowStock && <Chip tone="warning">Low</Chip>}
              <span className="tabular">{formatQuantity(v.stock, v.unit)}</span>
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
            <CheckCell label={`Selling: ${v.sku}`} checked={active} onChange={setActive} />
          ) : v.isActive ? (
            <Chip tone="trust">On</Chip>
          ) : (
            <Chip>Paused</Chip>
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
          ) : canEdit ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : v.isActive ? (
            <PauseButton id={v.id} />
          ) : null}
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

/** An unverified (e.g. suspended) supplier can still stop selling. */
function PauseButton({ id }: { id: string }) {
  const { busy, error, save } = useRowSave(`/vendor/variants/${id}`, () => {});
  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" variant="ghost" loading={busy} onClick={() => save({ isActive: false })}>
        Pause
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}
