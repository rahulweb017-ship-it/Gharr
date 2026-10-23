"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput, fieldErrors } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { apiGet, apiPost } from "@/lib/api-client";
import { rupeesToPaise } from "@/components/admin/catalogue/inline-edit";
import { UNIT_META, type Unit } from "@/shared/units";
import { DELIVERY_MODES, UNITS } from "@/shared/contracts/vendor";

/**
 * Adding a product: attach an offer to a catalogue product (live as soon as
 * it is saved), or propose a product the catalogue lacks (live after admin
 * approval). Both share the same offer fields.
 */

interface CatalogueHit {
  id: string;
  name: string;
  images: string[];
  category: { name: string };
  brand: { name: string } | null;
  alreadyListed: boolean;
}

interface Category {
  id: string;
  name: string;
  parent: { name: string } | null;
}

type Offer = Record<
  | "sku" | "label" | "unit" | "packSize" | "price" | "mrp" | "moq" | "step" | "maxOrder"
  | "deliveryMode" | "leadTimeDays" | "weight" | "stock" | "lowStock",
  string
>;

const EMPTY_OFFER: Offer = {
  sku: "",
  label: "",
  unit: "BAG",
  packSize: "1",
  price: "",
  mrp: "",
  moq: "1",
  step: "1",
  maxOrder: "",
  deliveryMode: "STANDARD",
  leadTimeDays: "1",
  weight: "",
  stock: "",
  lowStock: "0",
};

const DELIVERY_LABELS: Record<(typeof DELIVERY_MODES)[number], string> = {
  STANDARD: "Standard delivery",
  SCHEDULED: "Scheduled slot",
  PICKUP: "Pickup from shop",
};

function num(value: string, fallback?: number): number {
  if (value.trim() === "") return fallback ?? Number.NaN;
  return Number(value);
}

function offerBody(o: Offer) {
  return {
    sku: o.sku.trim(),
    label: o.label.trim(),
    unit: o.unit,
    packSize: num(o.packSize, 1),
    pricePaise: rupeesToPaise(o.price),
    mrpPaise: rupeesToPaise(o.mrp),
    moqQuantity: num(o.moq, 1),
    stepQuantity: num(o.step, 1),
    maxOrderQuantity: o.maxOrder.trim() ? num(o.maxOrder) : null,
    deliveryMode: o.deliveryMode,
    leadTimeDays: num(o.leadTimeDays, 1),
    weightKgPerUnit: o.weight.trim() ? num(o.weight) : null,
    quantityAvailable: num(o.stock, 0),
    lowStockThreshold: num(o.lowStock, 0),
  };
}

function OfferFields({ offer, setOffer, errors, prefix = "" }: { offer: Offer; setOffer: (o: Offer) => void; errors: Record<string, string>; prefix?: string }) {
  const set = (key: keyof Offer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setOffer({ ...offer, [key]: e.target.value });
  const err = (field: string) => errors[`${prefix}${field}`] ?? null;
  const unitName = UNIT_META[offer.unit as Unit]?.short ?? "unit";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Your SKU" htmlFor="sku" error={err("sku")} hint="Your own code, e.g. ULT-OPC53-50">
        <TextInput id="sku" value={offer.sku} onChange={set("sku")} invalid={!!err("sku")} />
      </Field>
      <Field label="Pack description" htmlFor="label" error={err("label")} hint="What the buyer gets, e.g. 50 kg bag" className="md:col-span-2">
        <TextInput id="label" value={offer.label} onChange={set("label")} invalid={!!err("label")} />
      </Field>
      <Field label="Sold per" htmlFor="unit" error={err("unit")}>
        <SelectInput id="unit" value={offer.unit} onChange={set("unit")}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_META[u].singular}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Contents per pack" htmlFor="packSize" error={err("packSize")} hint="e.g. 50 for a 50 kg bag">
        <TextInput id="packSize" value={offer.packSize} onChange={set("packSize")} inputMode="decimal" />
      </Field>
      <Field label={`Weight per ${unitName} (kg)`} htmlFor="weight" error={err("weightKgPerUnit")} hint="Optional; helps plan delivery">
        <TextInput id="weight" value={offer.weight} onChange={set("weight")} inputMode="decimal" />
      </Field>
      <Field label={`Selling price per ${unitName} (₹, excl. GST)`} htmlFor="price" error={err("pricePaise")}>
        <TextInput id="price" value={offer.price} onChange={set("price")} inputMode="decimal" invalid={!!err("pricePaise")} />
      </Field>
      <Field label="MRP (₹)" htmlFor="mrp" error={err("mrpPaise")}>
        <TextInput id="mrp" value={offer.mrp} onChange={set("mrp")} inputMode="decimal" invalid={!!err("mrpPaise")} />
      </Field>
      <Field label="Delivery" htmlFor="deliveryMode" error={err("deliveryMode")}>
        <SelectInput id="deliveryMode" value={offer.deliveryMode} onChange={set("deliveryMode")}>
          {DELIVERY_MODES.map((m) => (
            <option key={m} value={m}>
              {DELIVERY_LABELS[m]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field label="Minimum order" htmlFor="moq" error={err("moqQuantity")}>
        <TextInput id="moq" value={offer.moq} onChange={set("moq")} inputMode="decimal" />
      </Field>
      <Field label="Order in steps of" htmlFor="step" error={err("stepQuantity")}>
        <TextInput id="step" value={offer.step} onChange={set("step")} inputMode="decimal" />
      </Field>
      <Field label="Maximum per order" htmlFor="maxOrder" error={err("maxOrderQuantity")} hint="Optional">
        <TextInput id="maxOrder" value={offer.maxOrder} onChange={set("maxOrder")} inputMode="decimal" />
      </Field>
      <Field label="Stock available" htmlFor="stock" error={err("quantityAvailable")}>
        <TextInput id="stock" value={offer.stock} onChange={set("stock")} inputMode="decimal" invalid={!!err("quantityAvailable")} />
      </Field>
      <Field label="Warn me when stock falls to" htmlFor="lowStock" error={err("lowStockThreshold")}>
        <TextInput id="lowStock" value={offer.lowStock} onChange={set("lowStock")} inputMode="decimal" />
      </Field>
      <Field label="Dispatch within (days)" htmlFor="leadTimeDays" error={err("leadTimeDays")}>
        <TextInput id="leadTimeDays" value={offer.leadTimeDays} onChange={set("leadTimeDays")} inputMode="numeric" />
      </Field>
    </div>
  );
}

function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  async function run(path: string, body: unknown, done: string) {
    setBusy(true);
    setErrors({});
    setMessage(null);
    const result = await apiPost(path, body);
    setBusy(false);
    if (!result.ok) {
      setErrors(fieldErrors(result.error.details));
      setMessage(result.error.message);
      return;
    }
    router.push(done);
    router.refresh();
  }
  return { busy, errors, message, run };
}

function FromCatalogue() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CatalogueHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CatalogueHit | null>(null);
  const [offer, setOffer] = useState<Offer>(EMPTY_OFFER);
  const { busy, errors, message, run } = useSubmit();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await apiGet<CatalogueHit[]>(`/vendor/products/search?q=${encodeURIComponent(q)}`);
      if (!cancelled) {
        setSearching(false);
        if (result.ok) setHits(result.data);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  if (picked) {
    return (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run("/vendor/variants", { productId: picked.id, ...offerBody(offer) }, "/supplier/listings");
        }}
        className="space-y-5"
      >
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 p-3">
          <div className="min-w-0">
            <p className="text-xs text-ink-400">{picked.category.name}</p>
            <p className="font-semibold text-ink-900">{picked.name}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setPicked(null)}>
            Change
          </Button>
        </div>
        <OfferFields offer={offer} setOffer={setOffer} errors={errors} />
        {message && <p role="alert" className="text-sm font-medium text-red-600">{message}</p>}
        <Button type="submit" size="lg" loading={busy}>
          Start selling
        </Button>
      </form>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-400" />
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cement, TMT bars, tiles…" aria-label="Search the catalogue" className="pl-10" />
      </div>
      <ul className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
        {hits.length === 0 && (
          <li className="p-6 text-center text-sm text-ink-500">{searching ? "Searching…" : "Nothing found. Propose it as a new product instead."}</li>
        )}
        {hits.map((hit) => (
          <li key={hit.id} className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 items-center gap-3">
              {hit.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={hit.images[0]} alt="" className="size-12 shrink-0 rounded-lg bg-ink-50 object-cover" />
              ) : (
                <span className="size-12 shrink-0 rounded-lg bg-ink-50" />
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{hit.name}</p>
                <p className="text-xs text-ink-400">
                  {hit.category.name}
                  {hit.brand ? ` · ${hit.brand.name}` : ""}
                </p>
              </div>
            </div>
            {hit.alreadyListed ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-trust-700">
                <Check aria-hidden className="size-4" /> Listed
              </span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setPicked(hit)}>
                Sell this
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-400">To sell another pack size of a product you already list, propose it as a new product or ask support to add it.</p>
    </div>
  );
}

function NewProduct({ categories }: { categories: Category[] }) {
  const [p, setP] = useState({ name: "", categoryId: "", brandName: "", shortDescription: "", description: "", hsnCode: "", taxRatePercent: "18", image: "" });
  const [offer, setOffer] = useState<Offer>(EMPTY_OFFER);
  const { busy, errors, message, run } = useSubmit();
  const set = (key: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setP({ ...p, [key]: e.target.value });
  const err = (field: string) => errors[field] ?? null;

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          "/vendor/products",
          {
            name: p.name,
            categoryId: p.categoryId,
            brandName: p.brandName || null,
            shortDescription: p.shortDescription,
            description: p.description,
            hsnCode: p.hsnCode || null,
            taxRatePercent: Number(p.taxRatePercent),
            images: p.image.trim() ? [p.image.trim()] : [],
            offer: offerBody(offer),
          },
          "/supplier/listings",
        );
      }}
    >
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
        New products are reviewed by the Gharr team before they appear in the shop. Search the catalogue first: an existing product goes live straight away.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Product name" htmlFor="name" error={err("name")} className="md:col-span-2">
          <TextInput id="name" value={p.name} onChange={set("name")} invalid={!!err("name")} />
        </Field>
        <Field label="Category" htmlFor="categoryId" error={err("categoryId")}>
          <SelectInput id="categoryId" value={p.categoryId} onChange={set("categoryId")} invalid={!!err("categoryId")}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent ? `${c.parent.name} › ${c.name}` : c.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Brand" htmlFor="brandName" error={err("brandName")} hint="Optional">
          <TextInput id="brandName" value={p.brandName} onChange={set("brandName")} />
        </Field>
        <Field label="One-line description" htmlFor="shortDescription" error={err("shortDescription")} className="md:col-span-2">
          <TextInput id="shortDescription" value={p.shortDescription} onChange={set("shortDescription")} maxLength={160} invalid={!!err("shortDescription")} />
        </Field>
        <Field label="Full description" htmlFor="description" error={err("description")} hint="Grade, size, finish, standards (IS codes) and uses" className="md:col-span-2">
          <textarea
            id="description"
            value={p.description}
            onChange={set("description")}
            rows={5}
            aria-invalid={!!err("description") || undefined}
            className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-[15px] text-ink-900 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 aria-invalid:border-red-500"
          />
        </Field>
        <Field label="HSN code" htmlFor="hsnCode" error={err("hsnCode")} hint="Optional, 4–8 digits">
          <TextInput id="hsnCode" value={p.hsnCode} onChange={set("hsnCode")} inputMode="numeric" />
        </Field>
        <Field label="GST rate" htmlFor="taxRatePercent" error={err("taxRatePercent")}>
          <SelectInput id="taxRatePercent" value={p.taxRatePercent} onChange={set("taxRatePercent")}>
            {[0, 5, 12, 18, 28].map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Image link" htmlFor="image" error={err("images.0")} hint="Optional: a public https link to a product photo" className="md:col-span-2">
          <TextInput id="image" value={p.image} onChange={set("image")} inputMode="url" />
        </Field>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-bold text-ink-900">Your offer</h3>
        <OfferFields offer={offer} setOffer={setOffer} errors={errors} prefix="offer." />
      </div>

      {message && <p role="alert" className="text-sm font-medium text-red-600">{message}</p>}
      <Button type="submit" size="lg" loading={busy}>
        Submit for approval
      </Button>
    </form>
  );
}

export function NewListing({ categories }: { categories: Category[] }) {
  const [tab, setTab] = useState<"catalogue" | "new">("catalogue");
  return (
    <div className="space-y-5">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "catalogue", label: "From the catalogue" },
          { value: "new", label: "New product" },
        ]}
        label="How to add the product"
      />
      {tab === "catalogue" ? <FromCatalogue /> : <NewProduct categories={categories} />}
    </div>
  );
}
