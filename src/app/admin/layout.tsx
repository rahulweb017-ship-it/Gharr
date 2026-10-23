import { redirect } from "next/navigation";
import { requirePageRole } from "@/server/auth/page-session";
import { prisma } from "@/server/db/prisma";
import { staffLevel } from "@/server/services/admin/guard";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = {
  title: { default: "Admin", template: "%s · Gharr Admin" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * The admin console lives outside the customer (app) group: no bottom tabs, no
 * shop nav — a desk-first workspace with its own sidebar.
 *
 * The page gate uses token roles (fast, for rendering); every admin service call
 * re-checks roles and suspension against the database.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageRole(["ADMIN", "SUPPORT"], "/admin");
  const user = await prisma.user.findUnique({
    where: { id: actor.userId },
    select: { name: true, roles: true, isActive: true },
  });
  const level = user?.isActive ? staffLevel(user.roles) : null;

  if (!user || !level) redirect("/");

  return (
    <AdminShell name={user.name ?? "Staff"} level={level}>
      {children}
    </AdminShell>
  );
}
