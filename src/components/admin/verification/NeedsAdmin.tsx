import { ShieldAlert } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminShell";

/** Shown to support staff who reach an administrator-only screen. */
export function NeedsAdmin({ title }: { title: string }) {
  return (
    <>
      <AdminPageHeader title={title} />
      <div className="flex items-start gap-3 rounded-(--radius-card) border border-ink-100 bg-white p-6 shadow-(--shadow-card)">
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-700" />
        <div>
          <p className="font-bold text-ink-900">Needs administrator access</p>
          <p className="mt-1 text-sm text-ink-500">
            Verification exposes ID proofs and bank details, so only administrators can review it.
          </p>
        </div>
      </div>
    </>
  );
}
