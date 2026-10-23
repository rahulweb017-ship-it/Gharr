import type { Role } from "@prisma/client";
import { getPageActor } from "@/server/auth/page-session";
import { listUsers } from "@/server/services/admin/users-admin.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DataTable, Pagination, type Column } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { Chip } from "@/components/ui/Chip";
import { RoleChips } from "@/components/admin/users/RoleChips";
import { formatDateTime, formatDay } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

const ROLES: Role[] = ["CUSTOMER", "VENDOR", "WORKER", "DELIVERY_PARTNER", "SUPPORT", "ADMIN"];

type Search = { q?: string; role?: string; active?: string; page?: string };
type Row = Awaited<ReturnType<typeof listUsers>>["rows"][number];

const columns: Column<Row>[] = [
  { key: "name", header: "User", cell: (u) => u.name ?? "Unnamed" },
  { key: "phone", header: "Phone", cell: (u) => <span className="tabular">{formatPhone(u.phoneE164)}</span> },
  { key: "roles", header: "Roles", cell: (u) => <RoleChips roles={u.roles} /> },
  {
    key: "status",
    header: "Status",
    cell: (u) => (u.isActive ? <Chip tone="neutral">Active</Chip> : <Chip tone="danger">Suspended</Chip>),
  },
  { key: "orders", header: "Orders", align: "right", hideOnMobile: true, cell: (u) => <span className="tabular">{u._count.orders}</span> },
  { key: "bookings", header: "Bookings", align: "right", hideOnMobile: true, cell: (u) => <span className="tabular">{u._count.bookings}</span> },
  { key: "login", header: "Last login", hideOnMobile: true, cell: (u) => formatDateTime(u.lastLoginAt) },
  { key: "joined", header: "Joined", hideOnMobile: true, cell: (u) => formatDay(u.createdAt) },
];

/** User directory. SUPPORT can look people up; changes happen on the detail page (ADMIN). */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const actor = await getPageActor();
  const role = ROLES.includes(sp.role as Role) ? (sp.role as Role) : undefined;
  const active = sp.active === "active" || sp.active === "suspended" ? sp.active : undefined;

  const result = await listUsers(actor, { q: sp.q, role, active, page: Number(sp.page) || 1 });

  return (
    <>
      <AdminPageHeader title="Users" description="Customers, sellers, workers and staff." />
      <FilterBar
        action="/admin/users"
        values={sp}
        search={{ placeholder: "Search name, email or phone" }}
        selects={[
          { name: "role", label: "Role", options: ROLES.map((r) => ({ value: r, label: r === "DELIVERY_PARTNER" ? "Delivery partner" : r.charAt(0) + r.slice(1).toLowerCase() })) },
          { name: "active", label: "Status", options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] },
        ]}
      />
      <DataTable
        caption="Users"
        columns={columns}
        rows={result.rows}
        rowKey={(u) => u.id}
        rowHref={(u) => `/admin/users/${u.id}`}
        empty="No users match these filters."
      />
      <Pagination page={result.page} perPage={result.perPage} total={result.total} basePath="/admin/users" params={sp} />
    </>
  );
}
