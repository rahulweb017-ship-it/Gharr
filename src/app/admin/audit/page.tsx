import { ShieldAlert } from "lucide-react";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError } from "@/server/http/errors";
import { listAudit, type AuditRow } from "@/server/services/admin/audit-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { dateRange, formatDateTime } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";
import { AuditDiffButton } from "./AuditDiffButton";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

type Search = { action?: string; entityType?: string; actor?: string; from?: string; to?: string; page?: string };

const actorLabel = (r: AuditRow) =>
  r.actor ? `${r.actor.name ?? "Unnamed"} · ${formatPhone(r.actor.phoneE164)}` : r.actorUserId ? r.actorUserId : "System";

const columns: Column<AuditRow>[] = [
  { key: "time", header: "Time", cell: (r) => <span className="whitespace-nowrap tabular">{formatDateTime(r.createdAt)}</span> },
  { key: "actor", header: "Actor", cell: (r) => r.actor?.name ?? (r.actorUserId ? "Unknown user" : "System") },
  { key: "role", header: "Role", hideOnMobile: true, cell: (r) => <Chip className="px-2 py-0.5 text-[11px]">{r.actorRole ?? "—"}</Chip> },
  { key: "action", header: "Action", cell: (r) => <code className="text-xs font-semibold text-ink-900">{r.action}</code> },
  {
    key: "entity",
    header: "Entity",
    hideOnMobile: true,
    cell: (r) => (
      <span className="text-xs">
        {r.entityType} <span className="text-ink-400">{r.entityId.slice(-8)}</span>
      </span>
    ),
  },
  {
    key: "view",
    header: "",
    align: "right",
    cell: (r) => (
      <AuditDiffButton
        title={r.action}
        before={r.before}
        after={r.after}
        meta={[
          { label: "Time", value: formatDateTime(r.createdAt) },
          { label: "Actor", value: actorLabel(r) },
          { label: "Role", value: r.actorRole ?? "—" },
          { label: "Entity", value: `${r.entityType} ${r.entityId}` },
          { label: "Request", value: r.requestId ?? "—" },
        ]}
      />
    ),
  },
];

/** Every admin write, newest first. ADMIN only. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = await getPageActor();

  let data: Awaited<ReturnType<typeof listAudit>>;
  try {
    data = await listAudit(actor, {
      action: sp.action || undefined,
      entityType: sp.entityType || undefined,
      actorPhone: sp.actor || undefined,
      createdAt: dateRange(sp.from, sp.to),
      page: Number(sp.page) || 1,
    });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <>
          <AdminPageHeader title="Audit log" />
          <div className="rounded-(--radius-card) border border-ink-100 bg-white px-6 py-12 text-center">
            <ShieldAlert aria-hidden className="mx-auto size-8 text-ink-300" />
            <p className="mt-3 font-bold text-ink-900">Needs administrator access</p>
            <p className="mt-1 text-sm text-ink-500">Only administrators can view the audit log.</p>
          </div>
        </>
      );
    }
    throw error;
  }

  return (
    <>
      <AdminPageHeader title="Audit log" description="Every admin change: who, what, from and to." />
      <FilterBar
        action="/admin/audit"
        values={sp}
        search={{ name: "actor", placeholder: "Actor phone number" }}
        selects={[
          { name: "action", label: "Action", options: data.actions.map((a) => ({ value: a, label: a })) },
          { name: "entityType", label: "Entity", options: data.entityTypes.map((e) => ({ value: e, label: e })) },
        ]}
        dates
      />
      <DataTable caption="Audit log" columns={columns} rows={data.rows} rowKey={(r) => r.id} empty="No audit entries match." />
      <Pagination page={data.page} perPage={data.perPage} total={data.total} basePath="/admin/audit" params={sp} />
    </>
  );
}
