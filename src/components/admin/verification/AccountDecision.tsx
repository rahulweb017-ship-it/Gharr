import type { VerificationStatus } from "@prisma/client";
import { ActionButton } from "@/components/admin/ActionButton";
import { Panel } from "@/components/admin/Stat";
import {
  blockingMessage,
  type RequirementSummary,
  type VerificationKind,
} from "@/server/services/admin/verification-rules";
import { VerificationStatusChip } from "./VerificationStatusChip";

/**
 * Verify / reject / move-back-to-pending for the whole account. "Verify" is
 * disabled with the reason spelled out; the service refuses it independently.
 */
export function AccountDecision({
  kind,
  id,
  status,
  statusNote,
  summary,
}: {
  kind: VerificationKind;
  id: string;
  status: VerificationStatus;
  statusNote: string | null;
  summary: RequirementSummary;
}) {
  const path = `/admin/verification/${kind}s/${id}/status`;
  const effect =
    kind === "vendor"
      ? {
          verify: "The shop goes live and can take orders.",
          reject: "The shop is taken off sale.",
          pending: "The shop is taken off sale until it is verified again.",
        }
      : {
          verify: "The worker is activated with the Verified badge.",
          reject: "The worker is hidden from Labour search.",
          pending: "The Verified badge is removed until the worker is verified again.",
        };

  return (
    <Panel title="Account decision">
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-600">
        Current status <VerificationStatusChip status={status} />
      </div>
      {statusNote && (
        <p className="mb-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-700">
          <span className="font-semibold">Note to applicant:</span> {statusNote}
        </p>
      )}

      {status !== "VERIFIED" && !summary.canVerify && (
        <p role="status" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {blockingMessage(summary)}.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {status !== "VERIFIED" && (
          <ActionButton
            label={`Verify ${kind}`}
            variant="primary"
            size="md"
            path={path}
            body={{ status: "VERIFIED" }}
            disabled={!summary.canVerify}
            confirm={{ title: `Verify this ${kind}?`, message: effect.verify, confirmLabel: "Verify" }}
          />
        )}
        {status !== "REJECTED" && (
          <ActionButton
            label="Reject"
            variant="danger"
            size="md"
            path={path}
            body={{ status: "REJECTED" }}
            confirm={{
              title: `Reject this ${kind}?`,
              message: `${effect.reject} The reason is shown to the applicant.`,
              reasonField: "reason",
              reasonLabel: "Reason shown to the applicant",
              reasonRequired: true,
              confirmLabel: "Reject",
            }}
          />
        )}
        {status !== "PENDING" && (
          <ActionButton
            label="Move back to pending"
            variant="outline"
            size="md"
            path={path}
            body={{ status: "PENDING" }}
            confirm={{
              title: "Move back to pending?",
              message: effect.pending,
              reasonField: "reason",
              reasonLabel: "Note to the applicant",
              confirmLabel: "Move to pending",
            }}
          />
        )}
      </div>
    </Panel>
  );
}
