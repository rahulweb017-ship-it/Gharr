import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { NotFoundError } from "@/server/http/errors";
import { getUser } from "@/server/services/admin/users-admin.service";
import { ORDER_STATUS_LABELS } from "@/server/services/order-state";
import { BOOKING_STATUS_LABELS } from "@/server/services/booking-state";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel, StatTile } from "@/components/admin/Stat";
import { ActionButton } from "@/components/admin/ActionButton";
import { RoleChips } from "@/components/admin/users/RoleChips";
import { Chip } from "@/components/ui/Chip";
import { Money } from "@/components/ui/Money";
import { orderTone } from "@/components/orders/order-status";
import { bookingTone } from "@/components/labour/booking-status";
import { formatDateTime, formatDay, humanize } from "@/lib/admin-format";
import { formatPhone } from "@/shared/phone";

export const dynamic = "force-dynamic";

const SUSPEND_NOTE =
  "They are signed out of every device now. A screen they already have open keeps working until its access token expires — at most 15 minutes.";

/** One user: profile, activity counts, recent records, and (ADMIN) suspension and staff roles. */
export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPageActor();

  let user: Awaited<ReturnType<typeof getUser>>;
  try {
    user = await getUser(actor, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const isAdmin = user.viewer.level === "ADMIN";
  const isSelf = user.viewer.id === user.id;
  const base = `/admin/users/${user.id}`;

  return (
    <>
      <AdminPageHeader
        title={user.name ?? "Unnamed user"}
        description={formatPhone(user.phoneE164)}
        back={{ href: "/admin/users", label: "Users" }}
        actions={
          isAdmin && !isSelf ? (
            user.isActive ? (
              <ActionButton
                label="Suspend account"
                variant="danger"
                path={`${base}/suspend`}
                confirm={{
                  title: `Suspend ${user.name ?? "this user"}?`,
                  message: SUSPEND_NOTE,
                  reasonField: "reason",
                  reasonLabel: "Reason for suspension",
                  reasonRequired: true,
                  confirmLabel: "Suspend",
                }}
              />
            ) : (
              <ActionButton
                label="Reactivate account"
                variant="primary"
                path={`${base}/reactivate`}
                confirm={{
                  title: "Reactivate this account?",
                  message: "They can sign in again straight away.",
                  reasonField: "reason",
                  reasonLabel: "Note",
                  confirmLabel: "Reactivate",
                }}
              />
            )
          ) : undefined
        }
      />

      {!user.isActive && (
        <div role="status" className="mb-4 rounded-(--radius-card) border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">Suspended{user.suspension ? ` on ${formatDateTime(user.suspension.at)}` : ""}</p>
          {user.suspension?.reason && <p className="mt-0.5">Reason: {user.suspension.reason}</p>}
        </div>
      )}

      <section aria-label="Activity" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Orders" value={user._count.orders} />
        <StatTile label="Bookings" value={user._count.bookings} />
        <StatTile label="Estimates" value={user._count.estimates} />
        <StatTile label="Tickets" value={user._count.supportTickets} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <DetailList
            items={[
              { label: "Name", value: user.name },
              { label: "Phone", value: formatPhone(user.phoneE164) },
              { label: "Email", value: user.email },
              { label: "Status", value: user.isActive ? <Chip>Active</Chip> : <Chip tone="danger">Suspended</Chip> },
              { label: "Roles", value: <RoleChips roles={user.roles} /> },
              { label: "Last login", value: formatDateTime(user.lastLoginAt) },
              { label: "Signed-in devices", value: user.activeSessions },
              { label: "Joined", value: formatDateTime(user.createdAt) },
              ...(user.vendor
                ? [{ label: "Vendor", value: `${user.vendor.businessName} · ${humanize(user.vendor.status)}` }]
                : []),
              ...(user.worker
                ? [{ label: "Worker", value: `${user.worker.displayName} · ${humanize(user.worker.idVerificationStatus)}` }]
                : []),
            ]}
          />
        </Panel>

        <Panel title="Staff roles">
          <p className="mb-4 text-sm text-ink-500">
            Vendor and worker roles come from their seller or worker profile and can&apos;t be changed here.
            {isSelf && " You can't remove your own administrator role."}
          </p>
          <ul className="flex flex-col divide-y divide-ink-100">
            {(["ADMIN", "SUPPORT"] as const).map((role) => {
              const has = user.roles.includes(role);
              const locked = !isAdmin || (isSelf && role === "ADMIN" && has);
              return (
                <li key={role} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{role === "ADMIN" ? "Administrator" : "Support"}</p>
                    <p className="text-xs text-ink-500">
                      {role === "ADMIN" ? "Full access to the admin console" : "Tickets, plus read-only orders, bookings and users"}
                    </p>
                  </div>
                  {locked ? (
                    <Chip tone={has ? "brand" : "neutral"}>{has ? "Granted" : "Not granted"}</Chip>
                  ) : (
                    <ActionButton
                      label={has ? "Revoke" : "Grant"}
                      variant={has ? "outline" : "secondary"}
                      path={`${base}/roles`}
                      body={{ role, enabled: !has }}
                      confirm={{
                        title: `${has ? "Revoke" : "Grant"} ${role === "ADMIN" ? "administrator" : "support"} access?`,
                        message: "Takes effect on their next admin action; their app menu updates within 15 minutes.",
                        confirmLabel: has ? "Revoke" : "Grant",
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Recent orders">
          {user.orders.length === 0 ? (
            <p className="text-sm text-ink-500">No orders.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-100 text-sm">
              {user.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/orders/${o.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      #{o.orderNumber}
                    </Link>
                    <p className="text-xs text-ink-500">{formatDay(o.placedAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Chip tone={orderTone(o.status)}>{ORDER_STATUS_LABELS[o.status]}</Chip>
                    <Money paise={o.totalPaise} className="font-semibold" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent bookings">
          {user.bookings.length === 0 ? (
            <p className="text-sm text-ink-500">No bookings.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-100 text-sm">
              {user.bookings.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                      #{b.bookingNumber}
                    </Link>
                    <p className="text-xs text-ink-500">
                      {humanize(b.trade)} · {new Date(b.scheduledDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Chip tone={bookingTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Chip>
                    <Money paise={b.estimatedTotalPaise} className="font-semibold" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Addresses">
          {user.addresses.length === 0 ? (
            <p className="text-sm text-ink-500">No saved addresses.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {user.addresses.map((a) => (
                <li key={a.id} className="rounded-xl border border-ink-100 px-3 py-2">
                  <p className="font-semibold text-ink-900">
                    {a.contactName} <span className="text-xs font-medium text-ink-400">· {humanize(a.type)}{a.isDefault ? " · Default" : ""}</span>
                  </p>
                  <p className="text-ink-600">
                    {a.line1}, {a.city} – {a.pincode}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent tickets">
          {user.supportTickets.length === 0 ? (
            <p className="text-sm text-ink-500">No tickets.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-ink-100 text-sm">
              {user.supportTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/tickets/${t.id}`} className="min-w-0 truncate font-semibold text-ink-900 hover:text-brand-700 hover:underline">
                    {t.subject}
                  </Link>
                  <span className="shrink-0 text-xs text-ink-500">{humanize(t.status)} · {formatDay(t.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
