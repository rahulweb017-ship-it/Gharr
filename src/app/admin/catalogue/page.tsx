import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError } from "@/server/http/errors";
import { listCategoryOptions, listProducts } from "@/server/services/admin/catalog-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { NeedsAdmin } from "@/components/admin/catalogue/NeedsAdmin";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";

export const metadata = { title: "Catalogue" };

type Search = { q?: string; category?: string; status?: string; stock?: string; page?: string };
type Row = Awaited<ReturnType<typeof listProducts>>["rows"][number];

const columns: Column<Row>[] = [
  { key: "name", header: "Product", cell: (r) => r.name },
  { key: "category", header: "Category", cell: (r) => r.categoryName, hideOnMobile: true },
  { key: "brand", header: "Brand", cell: (r) => r.brandName ?? "—", hideOnMobile: true },
  {
    key: "sellers",
    header: "Sellers",
    align: "right",
    cell: (r) => (
      <span className="tabular">
        {r.variantCount}
        {r.activeVariantCount < r.variantCount && <span className="text-ink-400"> ({r.activeVariantCount} live)</span>}
      </span>
    ),
  },
  {
    key: "price",
    header: "Price range",
    align: "right",
    cell: (r) =>
      r.minPricePaise == null ? (
        "—"
      ) : r.minPricePaise === r.maxPricePaise ? (
        <Money paise={r.minPricePaise} />
      ) : (
        <span>
          <Money paise={r.minPricePaise} /> – <Money paise={r.maxPricePaise!} />
        </span>
      ),
  },
  {
    key: "stock",
    header: "Total stock",
    align: "right",
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        {r.lowStock && <Chip tone="warning">Low</Chip>}
        <span className="tabular">{r.totalStock.toLocaleString("en-IN")}</span>
      </span>
    ),
  },
  {
    key: "active",
    header: "Status",
    align: "center",
    cell: (r) => (r.isActive ? <Chip tone="trust">Active</Chip> : <Chip>Inactive</Chip>),
  },
];

/** ADMIN product table: search, filter and jump into a product's offers. */
export default async function CataloguePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const actor = await getPageActor();
  const status = params.status === "active" || params.status === "inactive" ? params.status : undefined;

  let data: Awaited<ReturnType<typeof listProducts>>;
  let categories: Awaited<ReturnType<typeof listCategoryOptions>>;
  try {
    [data, categories] = await Promise.all([
      listProducts(actor, {
        q: params.q,
        categoryId: params.category || undefined,
        status,
        lowStock: params.stock === "low",
        page: Number(params.page) || 1,
      }),
      listCategoryOptions(actor),
    ]);
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Catalogue" />;
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title="Catalogue"
        description="Correct live offers on existing products — price, MRP, stock and availability. New products come from suppliers."
      />
      <FilterBar
        action="/admin/catalogue"
        values={params}
        search={{ placeholder: "Search product or brand" }}
        selects={[
          { name: "category", label: "Category", options: categories },
          {
            name: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
          { name: "stock", label: "Stock", options: [{ value: "low", label: "Low stock" }] },
        ]}
      />
      <DataTable
        caption="Products"
        columns={columns}
        rows={data.rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/admin/catalogue/${r.id}`}
        empty="No products match these filters."
      />
      <Pagination page={data.page} perPage={data.perPage} total={data.total} basePath="/admin/catalogue" params={params} />
    </>
  );
}
