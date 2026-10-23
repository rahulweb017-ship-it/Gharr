import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/Surface";
import { AdminPageHeader } from "@/components/admin/AdminShell";

/** Shown to SUPPORT staff on ADMIN-only screens instead of a bare 403. */
export function NeedsAdmin({ title }: { title: string }) {
  return (
    <>
      <AdminPageHeader title={title} />
      <div className="rounded-(--radius-card) border border-ink-100 bg-white">
        <EmptyState
          icon={<ShieldAlert aria-hidden className="size-7" />}
          title="Needs administrator access"
          description="Catalogue and estimate pricing changes are limited to administrators. Ask an admin if something needs correcting."
        />
      </div>
    </>
  );
}
