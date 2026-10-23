import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/ui/Surface";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = { title: "My projects" };

/**
 * My Home Project is section 12 of the blueprint and explicitly a V2 feature.
 * The navigation slot exists now so the information architecture is settled and
 * the tab does not move once the feature lands.
 */
export default function ProjectsPage() {
  return (
    <div className="pb-6 md:mx-auto md:max-w-2xl">
      <PageHeader title="My projects" backHref="/account" />

      <EmptyState
        icon={<ClipboardList aria-hidden className="size-7" />}
        title="Project tracking is coming"
        description="Soon you'll be able to set a budget, track spend against it, keep a material checklist and see every order and booking for one site in a single place."
        action={<ButtonLink href="/estimate">Start with an estimate</ButtonLink>}
      />

      <section className="mx-4 mt-2 rounded-(--radius-card) md:mx-0 border border-ink-100 bg-ink-50 p-4">
        <h2 className="text-[13px] font-bold text-ink-900">What it will include</h2>
        <ul className="mt-2 space-y-1.5 text-[12px] text-ink-600">
          <li>Budget versus actual spend</li>
          <li>Material checklist with quantities</li>
          <li>Labour bookings and their cost</li>
          <li>Tasks, milestones and progress</li>
          <li>Invoices, photos and site notes</li>
        </ul>
      </section>
    </div>
  );
}
