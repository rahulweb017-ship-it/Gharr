import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError } from "@/server/http/errors";
import { listQueue } from "@/server/services/admin/verification.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { TabLinks } from "@/components/ui/Segmented";
import { Chip } from "@/components/ui/Chip";
import { NeedsAdmin } from "@/components/admin/verification/NeedsAdmin";
import { VerificationStatusChip } from "@/components/admin/verification/VerificationStatusChip";
import { formatDateTime } from "@/lib/admin-format";

export const metadata = { title: "Verification" };

type Row = Awaited<ReturnType<typeof listQueue>>["rows"][number];

/** Review queue: applicants still pending, or with documents awaiting review. */
export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "workers" ? "workers" : "vendors";
  const kind = tab === "workers" ? "worker" : "vendor";
  const actor = await getPageActor();

  let queue;
  try {
    queue = await listQueue(actor, { kind, page: Number(sp.page) || 1 });
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Verification" />;
    throw error;
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: kind === "vendor" ? "Business" : "Worker",
      cell: (r) => (
        <span className="flex flex-col">
          <span>{r.name}</span>
          <span className="text-xs font-normal text-ink-500">{r.subtitle}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <VerificationStatusChip status={r.status} /> },
    {
      key: "docs",
      header: "Documents",
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="tabular">
            {r.uploaded} / {r.required} uploaded
          </span>
          {r.pendingDocs > 0 && <Chip tone="brand">{r.pendingDocs} to review</Chip>}
        </span>
      ),
    },
    { key: "submitted", header: "Submitted", cell: (r) => formatDateTime(r.submittedAt), hideOnMobile: true },
  ];

  return (
    <>
      <AdminPageHeader
        title="Verification"
        description="Check documents and approve vendors and workers before they go live. Oldest first."
      />
      <TabLinks
        className="mb-4"
        tabs={[
          { href: "/admin/verification", label: `Vendors (${queue.counts.vendors})`, active: tab === "vendors" },
          { href: "/admin/verification?tab=workers", label: `Workers (${queue.counts.workers})`, active: tab === "workers" },
        ]}
      />
      <DataTable
        caption={`${kind === "vendor" ? "Vendors" : "Workers"} awaiting verification`}
        columns={columns}
        rows={queue.rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/admin/verification/${kind}s/${r.id}`}
        empty={`No ${kind}s waiting for review.`}
      />
      <Pagination
        page={queue.page}
        perPage={queue.perPage}
        total={queue.total}
        basePath="/admin/verification"
        params={{ tab: tab === "workers" ? "workers" : undefined, page: sp.page }}
      />
    </>
  );
}
