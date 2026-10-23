import { OrderStatus, PaymentMethod } from "@prisma/client";
import { getPageActor } from "@/server/auth/page-session";
import { listAdminOrders, listOrderVendors } from "@/server/services/admin/orders-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { OrderStatusChip, PaymentStatusChip } from "@/components/admin/orders/StatusChips";
import { TabLinks } from "@/components/ui/Segmented";
import { Money } from "@/components/ui/Money";
import { Chip } from "@/components/ui/Chip";
import { dateRange, formatDateTime, humanize } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";

export const metadata = { title: "Orders" };

type Search = Record<string, string | undefined>;

const pick = <T extends string>(values: readonly T[], v?: string) => (values as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = (await getPageActor())!;

  const filters = {
    view: sp.view === "attention" ? ("attention" as const) : undefined,
    status: pick(Object.values(OrderStatus), sp.status),
    vendorId: sp.vendor || undefined,
    method: pick(Object.values(PaymentMethod), sp.method),
    placedAt: dateRange(sp.from, sp.to),
    q: sp.q,
    page: Number(sp.page) || 1,
  };
  const [result, vendors] = await Promise.all([listAdminOrders(actor, filters), listOrderVendors(actor)]);
  type Row = (typeof result.items)[number];

  const tabHref = (view?: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page" && k !== "view") q.set(k, v);
    if (view) q.set("view", view);
    const s = q.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  const columns: Column<Row>[] = [
    { key: "number", header: "Order #", cell: (o) => <span className="font-mono text-[13px]">{o.orderNumber}</span> },
    {
      key: "customer",
      header: "Customer",
      cell: (o) => (
        <span className="block leading-tight">
          <span className="block font-medium">{o.user.name ?? "—"}</span>
          <span className="text-xs text-ink-500">{formatPhone(o.user.phoneE164)}</span>
        </span>
      ),
    },
    { key: "vendor", header: "Vendor", cell: (o) => o.vendor.businessName, hideOnMobile: true },
    { key: "items", header: "Items", align: "right", cell: (o) => o.itemCount, hideOnMobile: true },
    { key: "total", header: "Total", align: "right", cell: (o) => <Money paise={o.totalPaise} /> },
    {
      key: "payment",
      header: "Payment",
      cell: (o) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-600">{o.paymentMethod === "COD" ? "COD" : humanize(o.paymentMethod)}</span>
          {o.payment && <PaymentStatusChip status={o.payment.status} />}
          {o.hasPendingRefund && <Chip tone="warning">Refund pending</Chip>}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (o) => <OrderStatusChip status={o.status} /> },
    { key: "placed", header: "Placed", cell: (o) => <span className="whitespace-nowrap text-ink-600">{formatDateTime(o.placedAt)}</span>, hideOnMobile: true },
  ];

  return (
    <>
      <AdminPageHeader title="Orders" description="Every material order across vendors. Open one to act on it or refund it." />

      <TabLinks
        className="mb-4"
        tabs={[
          { href: tabHref(), label: "All orders", active: !filters.view },
          { href: tabHref("attention"), label: `Needs attention (${result.attentionCount})`, active: filters.view === "attention" },
        ]}
      />
      {filters.view === "attention" && (
        <p className="mb-3 text-xs text-ink-500">
          Unpaid for over an hour, failed deliveries, return requests, and orders with a refund the gateway has not confirmed.
        </p>
      )}

      <FilterBar
        action="/admin/orders"
        values={sp}
        hidden={{ view: filters.view }}
        search={{ placeholder: "Order #, customer name or phone" }}
        selects={[
          { name: "status", label: "Status", options: Object.values(OrderStatus).map((s) => ({ value: s, label: humanize(s) })) },
          { name: "vendor", label: "Vendor", options: vendors.map((v) => ({ value: v.id, label: v.businessName })) },
          { name: "method", label: "Payment", options: Object.values(PaymentMethod).map((m) => ({ value: m, label: m === "COD" ? "COD" : humanize(m) })) },
        ]}
        dates
      />

      <DataTable
        caption="Orders"
        columns={columns}
        rows={result.items}
        rowKey={(o) => o.id}
        rowHref={(o) => `/admin/orders/${o.id}`}
        empty={filters.view === "attention" ? "Nothing needs attention right now." : "No orders match these filters."}
      />
      <Pagination page={result.page} perPage={result.perPage} total={result.total} basePath="/admin/orders" params={sp} />
    </>
  );
}
