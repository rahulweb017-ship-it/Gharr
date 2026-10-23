import type { Role } from "@prisma/client";
import { Chip } from "@/components/ui/Chip";

const TONE: Partial<Record<Role, "brand" | "info" | "neutral" | "warning">> = {
  ADMIN: "brand",
  SUPPORT: "info",
  VENDOR: "warning",
  WORKER: "warning",
};

const LABEL: Record<Role, string> = {
  CUSTOMER: "Customer",
  VENDOR: "Vendor",
  WORKER: "Worker",
  DELIVERY_PARTNER: "Delivery",
  ADMIN: "Admin",
  SUPPORT: "Support",
};

/** Role pills; staff roles are coloured so they stand out in a list of customers. */
export function RoleChips({ roles }: { roles: Role[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {roles.map((r) => (
        <Chip key={r} tone={TONE[r] ?? "neutral"} className="px-2 py-0.5 text-[11px]">
          {LABEL[r]}
        </Chip>
      ))}
    </span>
  );
}
