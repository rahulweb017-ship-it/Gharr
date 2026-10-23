import { Trade } from "@prisma/client";
import { getPageActor } from "@/server/auth/page-session";
import { BOOKING_ADMIN_TABS, listAdminBookings, type BookingAdminTab } from "@/server/services/admin/bookings-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { BookingStatusChip } from "@/components/admin/orders/StatusChips";
import { TabLinks } from "@/components/ui/Segmented";
import { Money } from "@/components/ui/Money";
import { formatDateTime } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";
import { formatMinute } from "@/shared/time";
import { TRADE_LABELS, TRADE_ORDER } from "@/shared/trades";

export const metadata = { title: "Bookings" };

type Search = Record<string, string | undefined>;

const TAB_LABELS: Record<BookingAdminTab, string> = {
  disputes: "Disputes",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All",
};

/** Booking dates are Postgres `date` columns (UTC midnight). */
const day = (d: Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = (await getPageActor())!;

  const result = await listAdminBookings(actor, {
    tab: (BOOKING_ADMIN_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as BookingAdminTab) : undefined,
    trade: (Object.values(Trade) as string[]).includes(sp.trade ?? "") ? (sp.trade as Trade) : undefined,
    from: sp.from,
    to: sp.to,
    q: sp.q,
    page: Number(sp.page) || 1,
  });
  type Row = (typeof result.items)[number];

  const tabHref = (tab: BookingAdminTab) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page" && k !== "tab") q.set(k, v);
    q.set("tab", tab);
    return `/admin/bookings?${q.toString()}`;
  };

  const columns: Column<Row>[] = [
    { key: "number", header: "Booking #", cell: (b) => <span className="font-mono text-[13px]">{b.bookingNumber}</span> },
    {
      key: "customer",
      header: "Customer",
      cell: (b) => (
        <span className="block leading-tight">
          <span className="block font-medium">{b.user.name ?? "—"}</span>
          <span className="text-xs text-ink-500">{formatPhone(b.user.phoneE164)}</span>
        </span>
      ),
    },
    { key: "worker", header: "Worker", cell: (b) => b.worker.displayName },
    { key: "trade", header: "Trade", cell: (b) => TRADE_LABELS[b.trade], hideOnMobile: true },
    {
      key: "when",
      header: "Scheduled",
      cell: (b) => (
        <span className="whitespace-nowrap text-ink-600">
          {day(b.scheduledDate)}, {formatMinute(b.startMinute)}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: "total", header: "Total", align: "right", cell: (b) => <Money paise={b.finalTotalPaise ?? b.estimatedTotalPaise} /> },
    { key: "status", header: "Status", cell: (b) => <BookingStatusChip status={b.status} /> },
    { key: "created", header: "Booked", cell: (b) => <span className="whitespace-nowrap text-ink-600">{formatDateTime(b.createdAt)}</span>, hideOnMobile: true },
  ];

  return (
    <>
      <AdminPageHeader title="Bookings" description="Labour bookings. Disputes wait here for an administrator to resolve." />

      <TabLinks
        className="mb-4"
        tabs={BOOKING_ADMIN_TABS.map((t) => ({
          href: tabHref(t),
          label: `${TAB_LABELS[t]} (${result.counts[t]})`,
          active: result.tab === t,
        }))}
      />

      <FilterBar
        action="/admin/bookings"
        values={sp}
        hidden={{ tab: result.tab }}
        search={{ placeholder: "Booking #, customer or worker" }}
        selects={[{ name: "trade", label: "Trade", options: TRADE_ORDER.map((t) => ({ value: t, label: TRADE_LABELS[t] })) }]}
        dates
      />

      <DataTable
        caption="Bookings"
        columns={columns}
        rows={result.items}
        rowKey={(b) => b.id}
        rowHref={(b) => `/admin/bookings/${b.id}`}
        empty={result.tab === "disputes" ? "No open disputes." : "No bookings match these filters."}
      />
      <Pagination page={result.page} perPage={result.perPage} total={result.total} basePath="/admin/bookings" params={{ ...sp, tab: result.tab }} />
    </>
  );
}
