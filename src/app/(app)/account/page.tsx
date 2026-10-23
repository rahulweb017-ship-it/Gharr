import Link from "next/link";
import {
  Calculator,
  ChevronRight,
  ClipboardList,
  FileText,
  HardHat,
  LifeBuoy,
  MapPin,
  Package,
  Shield,
  ShieldCheck,
  Store,
  UserRound,
  Wrench,
} from "lucide-react";
import { getCurrentUser } from "@/server/services/auth.service";
import { listEstimates } from "@/server/services/estimate.service";
import { getPageActor } from "@/server/auth/page-session";
import { getSelectedCity } from "@/server/city";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Surface";
import { PageHeader } from "@/components/layout/PageHeader";
import { SignOutButton } from "@/components/forms/SignOutButton";
import { formatPhone } from "@/shared/phone";
import { cn } from "@/lib/cn";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

/**
 * Profile & settings, per the UI boards: identity card, then grouped menus.
 * Orders and bookings live here on phones, since the bottom bar has no slot
 * for them.
 */
export default async function AccountPage() {
  const actor = await getPageActor();

  if (!actor) {
    return (
      <div>
        <PageHeader title="Profile" />
        <EmptyState
          icon={<ClipboardList aria-hidden className="size-7" />}
          title="You're signed out"
          description="Sign in to see your estimates, orders, bookings and saved addresses."
          action={<ButtonLink href="/login?next=/account">Sign in</ButtonLink>}
        />
      </div>
    );
  }

  const [user, estimates, city] = await Promise.all([
    getCurrentUser(actor.userId),
    listEstimates(actor.userId),
    getSelectedCity(),
  ]);

  // Ops surfaces are shown only to the roles that can use them.
  const isVendor = user.roles.includes("VENDOR") || user.roles.includes("ADMIN");
  const isWorker = user.roles.includes("WORKER");
  const isStaff = user.roles.includes("ADMIN") || user.roles.includes("SUPPORT");

  const groups: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: "Activity",
      items: [
        { href: "/estimate", label: "My estimates", icon: Calculator, meta: String(estimates.length) },
        { href: "/orders", label: "Orders", icon: Package, meta: String(user.orderCount) },
        { href: "/bookings", label: "Labour bookings", icon: HardHat, meta: String(user.bookingCount) },
      ],
    },
    {
      title: "Account",
      items: [
        { href: "/account/profile", label: "Personal information", icon: UserRound },
        { href: "/account/addresses", label: "Saved addresses", icon: MapPin, meta: String(user.addresses.length) },
        { href: "/location?next=/account", label: "City", icon: MapPin, meta: city },
        ...(isStaff ? [{ href: "/admin", label: "Admin console", icon: ShieldCheck }] : []),
        ...(isVendor ? [{ href: "/vendor-ops", label: "Vendor operations", icon: Store }] : []),
        ...(isWorker ? [{ href: "/worker", label: "Worker console", icon: Wrench }] : []),
      ],
    },
    {
      title: "Support",
      items: [
        { href: "/account/support", label: "Help & support", icon: LifeBuoy },
        { href: "/privacy", label: "Privacy policy", icon: Shield },
        { href: "/terms", label: "Terms & conditions", icon: FileText },
      ],
    },
  ];

  return (
    <div className="pb-8 md:mx-auto md:max-w-2xl">
      <PageHeader title="Profile & settings" />

      <div className="px-4 md:px-0">
        <Link
          href="/account/profile"
          className="flex items-center gap-4 rounded-(--radius-card) border border-ink-100 bg-white p-4 shadow-(--shadow-card)"
        >
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-ink-900 text-2xl font-bold text-white">
            {(user.name ?? "H").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-ink-900">{user.name ?? "Gharr customer"}</span>
            {user.email && <span className="block truncate text-sm text-ink-500">{user.email}</span>}
            <span className="block text-sm text-ink-500">{formatPhone(user.phone)}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-ink-300" />
        </Link>

        {groups.map((group) => (
          <section key={group.title} className="mt-6">
            <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-ink-400 uppercase">{group.title}</h2>
            <Menu items={group.items} />
          </section>
        ))}

        <div className="mt-6">
          <SignOutButton />
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-300">
          Member since{" "}
          {new Date(user.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  meta?: string;
}

function Menu({ items }: { items: MenuItem[] }) {
  return (
    <ul className="overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white">
      {items.map((item, index) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className={cn(
              "flex min-h-13 items-center gap-3 px-4 py-3 hover:bg-ink-50",
              index < items.length - 1 && "border-b border-ink-100",
            )}
          >
            <item.icon aria-hidden className="size-5 text-ink-500" />
            <span className="flex-1 text-[15px] font-semibold text-ink-800">{item.label}</span>
            {item.meta && <span className="text-sm text-ink-400 tabular">{item.meta}</span>}
            <ChevronRight aria-hidden className="size-4 text-ink-300" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
