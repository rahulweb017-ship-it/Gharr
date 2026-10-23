import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { getDashboard } from "@/server/services/admin/analytics.service";
import { DASHBOARD_RANGES, parseRange } from "@/server/services/admin/analytics-math";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Panel, StatTile } from "@/components/admin/Stat";
import { TabLinks } from "@/components/ui/Segmented";
import { Money } from "@/components/ui/Money";
import { DailyChart } from "@/components/admin/dashboard/DailyChart";
import { formatDateTime, formatDay } from "@/lib/admin-format";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`);
const num = (v: number) => v.toLocaleString("en-IN");

/**
 * Admin home: range-scoped KPIs, the daily orders and GMV charts, and the work
 * queues. One range selector above everything scopes every tile and chart;
 * the queues are "right now" and ignore it.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: rawDays } = await searchParams;
  const days = parseRange(rawDays);
  const actor = await getPageActor();
  const data = await getDashboard(actor, days);
  const { kpis, queues } = data;
  const isAdmin = data.level === "ADMIN";

  const queueRows: Array<{ label: string; count: number; href: string; adminOnly?: boolean }> = [
    { label: "Vendors awaiting verification", count: queues.pendingVendors, href: "/admin/verification", adminOnly: true },
    { label: "Workers awaiting verification", count: queues.pendingWorkers, href: "/admin/verification?tab=workers", adminOnly: true },
    { label: "Disputed bookings", count: queues.disputes, href: "/admin/bookings?tab=disputes" },
    { label: "Open tickets (not yet picked up)", count: queues.openTickets, href: "/admin/tickets?status=OPEN" },
    { label: "Low-stock variants", count: queues.lowStock, href: "/admin/catalogue?stock=low", adminOnly: true },
    { label: "Refunds pending or failed", count: queues.pendingRefunds, href: "/admin/orders?view=attention" },
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`${formatDay(data.start)} – ${formatDay(data.end)} (IST days)`}
        actions={
          <TabLinks
            tabs={DASHBOARD_RANGES.map((d) => ({ href: `/admin?days=${d}`, label: `${d} days`, active: d === days }))}
          />
        }
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="GMV"
          value={<Money paise={kpis.gmvPaise} />}
          hint={`${num(kpis.deliveredCount)} delivered orders (by delivery date)`}
        />
        <StatTile label="Orders placed" value={num(kpis.ordersPlaced)} hint="Excludes unpaid checkouts" />
        <StatTile
          label="Avg order value"
          value={kpis.aovPaise == null ? "—" : <Money paise={kpis.aovPaise} />}
          hint="GMV ÷ delivered orders"
        />
        <StatTile
          label="Cancellation rate"
          value={pct(kpis.cancellationRate)}
          hint={`${num(kpis.cancelled)} of ${num(kpis.ordersPlaced)} placed orders`}
        />
        <StatTile
          label="Checkout conversion"
          value={pct(kpis.checkoutConversion)}
          hint={
            <span title="Distinct checkouts placed in range ÷ (those checkouts + carts still holding items updated in range). Checkout empties the cart, so converted carts are counted through their checkout.">
              {num(kpis.checkoutGroups)} checkouts vs {num(kpis.activeCarts)} open carts ⓘ
            </span>
          }
        />
        <StatTile label="Bookings created" value={num(kpis.bookingsCreated)} hint="Labour bookings requested" />
        <StatTile label="Bookings completed" value={num(kpis.bookingsCompleted)} hint="Completed, approved or paid out" />
        <StatTile label="New customers" value={num(kpis.newCustomers)} hint="Sign-ups (customers only)" />
        <StatTile
          label="Open tickets"
          value={num(kpis.openTickets)}
          hint={`${num(kpis.unassignedTickets)} unassigned · right now`}
          href="/admin/tickets"
          tone={kpis.unassignedTickets > 0 ? "attention" : "default"}
        />
        <StatTile
          label="Open disputes"
          value={num(kpis.openDisputes)}
          hint="Right now"
          href="/admin/bookings?tab=disputes"
          tone={kpis.openDisputes > 0 ? "attention" : "default"}
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Daily activity">
          <div className="flex flex-col gap-6">
            <DailyChart
              title="Orders placed per day"
              kind="count"
              data={data.daily.map((d) => ({ day: d.day, value: d.orders }))}
            />
            <DailyChart
              title="GMV per day (by delivery date)"
              kind="paise"
              data={data.daily.map((d) => ({ day: d.day, value: d.gmvPaise }))}
            />
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Action queues">
            <ul className="-mx-2 flex flex-col">
              {queueRows
                .filter((q) => isAdmin || !q.adminOnly)
                .map((q) => (
                  <li key={q.label}>
                    <Link
                      href={q.href}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-sm hover:bg-ink-50"
                    >
                      <span className="text-ink-700">{q.label}</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={
                            q.count > 0
                              ? "min-w-7 rounded-full bg-brand-50 px-2 py-0.5 text-center text-xs font-bold text-brand-700"
                              : "min-w-7 rounded-full bg-ink-50 px-2 py-0.5 text-center text-xs font-bold text-ink-400"
                          }
                        >
                          {q.count}
                        </span>
                        <ChevronRight aria-hidden className="size-4 text-ink-300" />
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </Panel>

          {queues.refundRows.length > 0 && (
            <Panel title="Refunds waiting">
              <ul className="flex flex-col divide-y divide-ink-100 text-sm">
                {queues.refundRows.map((r) => {
                  const href = r.orderId ? `/admin/orders/${r.orderId}` : r.bookingId ? `/admin/bookings/${r.bookingId}` : null;
                  const label = r.order?.orderNumber ?? r.booking?.bookingNumber ?? r.id;
                  return (
                    <li key={r.id} className="py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        {href ? (
                          <Link href={href} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                            #{label}
                          </Link>
                        ) : (
                          <span className="font-semibold text-ink-900">#{label}</span>
                        )}
                        <Money paise={r.amountPaise} className="font-semibold" />
                      </div>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {r.failureMessage ? `Failed: ${r.failureMessage}` : "Pending"} · {formatDateTime(r.createdAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
