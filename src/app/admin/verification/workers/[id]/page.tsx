import { notFound } from "next/navigation";
import { getPageActor } from "@/server/auth/page-session";
import { ForbiddenError, NotFoundError } from "@/server/http/errors";
import { getWorkerForReview } from "@/server/services/admin/verification.service";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { DetailList, Panel } from "@/components/admin/Stat";
import { NeedsAdmin } from "@/components/admin/verification/NeedsAdmin";
import { AccountDecision } from "@/components/admin/verification/AccountDecision";
import { DocumentReviewCard } from "@/components/admin/verification/DocumentReviewCard";
import { RequirementsPanel } from "@/components/admin/verification/RequirementsPanel";
import { formatDateTime, humanize } from "@/lib/admin-format";

export const metadata = { title: "Worker verification" };

export default async function WorkerVerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getPageActor();

  let worker;
  try {
    worker = await getWorkerForReview(actor, id);
  } catch (error) {
    if (error instanceof ForbiddenError) return <NeedsAdmin title="Worker verification" />;
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <AdminPageHeader
        title={worker.displayName}
        description="Worker verification"
        back={{ href: "/admin/verification?tab=workers", label: "Verification queue" }}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Worker">
            <DetailList
              items={[
                { label: "Name", value: worker.displayName },
                { label: "Account name", value: worker.user.name },
                { label: "Phone", value: worker.user.phoneE164 },
                {
                  label: "Trades",
                  value: worker.skills.length
                    ? worker.skills
                        .map((s) => `${humanize(s.trade)}${s.yearsExperience ? ` (${s.yearsExperience} yrs)` : ""}${s.isPrimary ? " · primary" : ""}`)
                        .join(", ")
                    : null,
                },
                { label: "Experience", value: `${worker.yearsExperience} years · ${worker.completedJobs} jobs completed` },
                { label: "Area", value: `${worker.baseCity} ${worker.basePincode} · within ${worker.serviceRadiusKm} km` },
                { label: "About", value: worker.bio },
                { label: "Listed", value: worker.isActive ? "Active" : "Hidden" },
                { label: "Joined", value: formatDateTime(worker.createdAt) },
              ]}
            />
          </Panel>

          <section>
            <h2 className="mb-3 text-base font-bold text-ink-900">Documents ({worker.documents.length})</h2>
            {worker.documents.length === 0 ? (
              <p className="rounded-(--radius-card) border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-500">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {worker.documents.map((doc) => (
                  <DocumentReviewCard key={doc.id} kind="worker" doc={doc} />
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <AccountDecision
            kind="worker"
            id={worker.id}
            status={worker.idVerificationStatus}
            statusNote={worker.statusNote}
            summary={worker.requirements}
          />
          <RequirementsPanel summary={worker.requirements} />
        </div>
      </div>
    </>
  );
}
