import type { TicketStatus } from "@prisma/client";
import { getPageActor } from "@/server/auth/page-session";
import { listTickets } from "@/server/services/support.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { TabLinks } from "@/components/ui/Segmented";
import { TICKET_STATUS_LABELS, priorityTone, ticketTone } from "@/components/support/ticket-status";
import { formatDateTime, humanize } from "@/lib/admin-format";
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  ticketAge,
} from "@/shared/contracts/support";

export const metadata = { title: "Tickets" };
export const dynamic = "force-dynamic";

type Search = { status?: string; priority?: string; category?: string; assigned?: string; q?: string; page?: string };
type Row = Awaited<ReturnType<typeof listTickets>>["rows"][number];

const pick = <T extends string>(values: readonly T[], v?: string) => (values as readonly string[]).includes(v ?? "") ? (v as T) : undefined;

/**
 * The support queue, oldest first. With no status filter it shows everything
 * still waiting (open + in progress); the age column is the SLA hint.
 */
export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = await getPageActor();
  const assigned = sp.assigned === "me" || sp.assigned === "unassigned" ? sp.assigned : undefined;
  const result = await listTickets(actor, {
    status: pick(TICKET_STATUSES, sp.status) as TicketStatus | undefined,
    priority: pick(TICKET_PRIORITIES, sp.priority),
    category: pick(TICKET_CATEGORIES, sp.category),
    assigned,
    q: sp.q,
    page: Number(sp.page) || 1,
  });
  const now = new Date();

  const columns: Column<Row>[] = [
    { key: "subject", header: "Subject", cell: (t) => <span className="line-clamp-1 max-w-72">{t.subject}</span> },
    {
      key: "customer",
      header: "Customer",
      cell: (t) => t.user.name ?? t.user.phoneE164,
    },
    { key: "category", header: "Category", hideOnMobile: true, cell: (t) => humanize(t.category) },
    { key: "priority", header: "Priority", cell: (t) => <Chip tone={priorityTone(t.priority)}>{humanize(t.priority)}</Chip> },
    { key: "status", header: "Status", cell: (t) => <Chip tone={ticketTone(t.status)}>{TICKET_STATUS_LABELS[t.status]}</Chip> },
    {
      key: "assignee",
      header: "Assignee",
      hideOnMobile: true,
      cell: (t) => (t.assignedTo ? (t.assignedTo.id === result.viewerId ? "You" : t.assignedTo.name ?? "Staff") : <span className="text-ink-400">Unassigned</span>),
    },
    {
      key: "age",
      header: "Waiting",
      align: "right",
      cell: (t) => {
        if (t.status === "RESOLVED" || t.status === "CLOSED") return <span className="text-ink-400">—</span>;
        const age = ticketAge(t.createdAt, now);
        return (
          <Chip tone={age.tone} className="tabular">
            <span title={`Raised ${formatDateTime(t.createdAt)}`}>{age.label}</span>
          </Chip>
        );
      },
    },
    { key: "updated", header: "Updated", hideOnMobile: true, cell: (t) => formatDateTime(t.updatedAt) },
  ];

  const tab = (a?: string) => {
    const q = new URLSearchParams();
    if (sp.status) q.set("status", sp.status);
    if (a) q.set("assigned", a);
    const s = q.toString();
    return s ? `/admin/tickets?${s}` : "/admin/tickets";
  };

  return (
    <>
      <AdminPageHeader title="Tickets" description="Customer complaints, oldest waiting first. Over 24h turns amber, over 48h red." />
      <TabLinks
        className="mb-4"
        tabs={[
          { href: tab(), label: "All", active: !assigned },
          { href: tab("me"), label: "Assigned to me", active: assigned === "me" },
          { href: tab("unassigned"), label: "Unassigned", active: assigned === "unassigned" },
        ]}
      />
      <FilterBar
        action="/admin/tickets"
        values={sp}
        hidden={{ assigned }}
        search={{ placeholder: "Search subject, customer name or phone" }}
        selects={[
          { name: "status", label: "Status (default: waiting)", options: TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] })) },
          { name: "priority", label: "Priority", options: TICKET_PRIORITIES.map((p) => ({ value: p, label: humanize(p) })) },
          { name: "category", label: "Category", options: TICKET_CATEGORIES.map((c) => ({ value: c, label: TICKET_CATEGORY_LABELS[c] })) },
        ]}
      />
      <DataTable
        caption="Support tickets"
        columns={columns}
        rows={result.rows}
        rowKey={(t) => t.id}
        rowHref={(t) => `/admin/tickets/${t.id}`}
        empty="No tickets match. Nice."
      />
      <Pagination page={result.page} perPage={result.perPage} total={result.total} basePath="/admin/tickets" params={sp} />
    </>
  );
}
