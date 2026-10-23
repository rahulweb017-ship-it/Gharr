import { ExternalLink, FileText } from "lucide-react";
import type { DocumentType, VerificationStatus } from "@prisma/client";
import { ActionButton } from "@/components/admin/ActionButton";
import { formatDateTime, humanize } from "@/lib/admin-format";
import type { VerificationKind } from "@/server/services/admin/verification-rules";
import { VerificationStatusChip } from "./VerificationStatusChip";

export interface ReviewableDoc {
  id: string;
  type: DocumentType;
  status: VerificationStatus;
  notes: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  createdAt: Date;
  contentType: "image" | "pdf" | "other";
}

/**
 * One uploaded document with an inline preview and its approve / reject
 * controls. Files come only from the staff-only route, which sandboxes them.
 */
export function DocumentReviewCard({ kind, doc }: { kind: VerificationKind; doc: ReviewableDoc }) {
  const src = `/api/v1/admin/documents/${doc.id}/file?kind=${kind}`;
  const reviewPath = `/admin/verification/documents/${doc.id}/review`;
  const label = humanize(doc.type);

  return (
    <article className="overflow-hidden rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-ink-900">{label}</h3>
          <p className="text-xs text-ink-500">Uploaded {formatDateTime(doc.createdAt)}</p>
        </div>
        <VerificationStatusChip status={doc.status} />
      </header>

      <div className="bg-ink-50 p-3">
        {doc.contentType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated bytes; next/image would proxy and cache them
          <img
            src={src}
            alt={`${label} document`}
            className="mx-auto max-h-96 w-auto max-w-full rounded-lg border border-ink-100 bg-white object-contain"
          />
        ) : doc.contentType === "pdf" ? (
          <object data={src} type="application/pdf" className="h-96 w-full rounded-lg border border-ink-100 bg-white">
            <p className="p-4 text-sm text-ink-500">This browser can&apos;t preview PDFs inline. Use “Open” below.</p>
          </object>
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-ink-500">
            <FileText aria-hidden className="size-6" /> No preview for this file type.
          </div>
        )}
      </div>

      <footer className="space-y-3 px-4 py-3">
        {doc.reviewedAt && (
          <p className="text-xs text-ink-500">
            Reviewed by {doc.reviewerName ?? "staff"} · {formatDateTime(doc.reviewedAt)}
            {doc.notes && <span className="mt-1 block text-sm text-ink-700">“{doc.notes}”</span>}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {doc.status !== "VERIFIED" && (
            <ActionButton label="Approve" variant="primary" path={reviewPath} body={{ kind, status: "VERIFIED" }} />
          )}
          {doc.status !== "REJECTED" && (
            <ActionButton
              label="Reject"
              variant="danger"
              path={reviewPath}
              body={{ kind, status: "REJECTED" }}
              confirm={{
                title: `Reject ${label.toLowerCase()}`,
                message: "The applicant will need to upload a new copy.",
                reasonField: "notes",
                reasonLabel: "What is wrong with it?",
                reasonRequired: true,
                confirmLabel: "Reject document",
              }}
            />
          )}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-brand-700"
          >
            Open <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      </footer>
    </article>
  );
}
