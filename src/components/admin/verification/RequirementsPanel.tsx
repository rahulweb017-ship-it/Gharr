import { CircleAlert } from "lucide-react";
import { Panel } from "@/components/admin/Stat";
import type { RequirementSummary } from "@/server/services/admin/verification-rules";
import { VerificationStatusChip } from "./VerificationStatusChip";

/** The checklist that decides whether "Verify" is allowed. */
export function RequirementsPanel({ summary }: { summary: RequirementSummary }) {
  return (
    <Panel title="Required documents">
      <ul className="divide-y divide-ink-100">
        {summary.items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="font-medium text-ink-800">{item.label}</span>
            <VerificationStatusChip status={item.state} />
          </li>
        ))}
      </ul>
      {summary.missing.length > 0 && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Missing: <strong>{summary.missing.map((m) => m.label).join(", ")}</strong>. The applicant must upload
            {summary.missing.length > 1 ? " these" : " it"} before the account can be verified.
          </span>
        </p>
      )}
    </Panel>
  );
}
