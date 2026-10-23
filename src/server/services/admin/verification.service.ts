import path from "node:path";
import type { DocumentType, Prisma, VerificationStatus } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { writeAudit, type RequestMeta } from "@/server/audit";
import type { Actor } from "@/server/auth/session";
import { ConflictError, NotFoundError, ValidationError } from "@/server/http/errors";
import { readPrivate } from "@/server/storage";
import { pageArgs, requireStaff } from "./guard";
import {
  blockingMessage,
  evaluateRequirements,
  type RequirementSummary,
  type VerificationKind,
} from "./verification-rules";

/**
 * Vendor and worker verification — the trust gate of the marketplace.
 *
 * ADMIN-only throughout: these screens expose ID proofs and bank details, which
 * support staff have no need to see. The "all required documents approved"
 * rule is enforced here, not only in the UI, so no client can verify early.
 */

export type { VerificationKind } from "./verification-rules";

const PENDING_FILTER = {
  vendor: { OR: [{ status: "PENDING" }, { documents: { some: { status: "PENDING" } } }] },
  worker: { OR: [{ idVerificationStatus: "PENDING" }, { documents: { some: { status: "PENDING" } } }] },
} satisfies { vendor: Prisma.VendorWhereInput; worker: Prisma.WorkerWhereInput };

const DOC_SELECT = {
  id: true,
  type: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  notes: true,
  createdAt: true,
  storageKey: true,
} as const;

export interface QueueRow {
  id: string;
  name: string;
  subtitle: string;
  status: VerificationStatus;
  pendingDocs: number;
  uploaded: number;
  required: number;
  submittedAt: Date;
}

/** Newest upload is when the owner last "submitted"; fall back to sign-up. */
function submittedAt(createdAt: Date, docs: { createdAt: Date }[]): Date {
  return docs.reduce((latest, d) => (d.createdAt > latest ? d.createdAt : latest), docs.length ? docs[0].createdAt : createdAt);
}

export async function queueCounts(actor: Actor | null) {
  await requireStaff(actor, "ADMIN");
  const [vendors, workers] = await Promise.all([
    prisma.vendor.count({ where: PENDING_FILTER.vendor }),
    prisma.worker.count({ where: PENDING_FILTER.worker }),
  ]);
  return { vendors, workers };
}

export async function listQueue(
  actor: Actor | null,
  input: { kind: VerificationKind; page?: number; perPage?: number },
) {
  await requireStaff(actor, "ADMIN");
  const { skip, take, page, perPage } = pageArgs(input.page, input.perPage);
  const counts = await queueCounts(actor);

  if (input.kind === "vendor") {
    const vendors = await prisma.vendor.findMany({
      where: PENDING_FILTER.vendor,
      orderBy: { createdAt: "asc" },
      skip,
      take,
      select: {
        id: true,
        businessName: true,
        city: true,
        gstin: true,
        status: true,
        createdAt: true,
        documents: { select: { type: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      },
    });
    const rows: QueueRow[] = vendors.map((v) => {
      const s = evaluateRequirements("vendor", v.documents);
      return {
        id: v.id,
        name: v.businessName,
        subtitle: [v.city, v.gstin].filter(Boolean).join(" · "),
        status: v.status,
        pendingDocs: v.documents.filter((d) => d.status === "PENDING").length,
        uploaded: s.uploaded,
        required: s.required,
        submittedAt: submittedAt(v.createdAt, v.documents),
      };
    });
    return { kind: input.kind, counts, rows, total: counts.vendors, page, perPage };
  }

  const workers = await prisma.worker.findMany({
    where: PENDING_FILTER.worker,
    orderBy: { createdAt: "asc" },
    skip,
    take,
    select: {
      id: true,
      displayName: true,
      baseCity: true,
      idVerificationStatus: true,
      createdAt: true,
      skills: { select: { trade: true }, orderBy: { isPrimary: "desc" } },
      documents: { select: { type: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  const rows: QueueRow[] = workers.map((w) => {
    const s = evaluateRequirements("worker", w.documents);
    return {
      id: w.id,
      name: w.displayName,
      subtitle: [w.baseCity, ...w.skills.map((k) => k.trade.charAt(0) + k.trade.slice(1).toLowerCase().replace(/_/g, " "))].join(" · "),
      status: w.idVerificationStatus,
      pendingDocs: w.documents.filter((d) => d.status === "PENDING").length,
      uploaded: s.uploaded,
      required: s.required,
      submittedAt: submittedAt(w.createdAt, w.documents),
    };
  });
  return { kind: input.kind, counts, rows, total: counts.workers, page, perPage };
}

type ReviewDoc = Omit<Prisma.VendorDocumentGetPayload<{ select: typeof DOC_SELECT }>, "storageKey"> & {
  reviewerName: string | null;
  contentType: "image" | "pdf" | "other";
};

/** Resolves reviewer names and drops the storage key — the client never needs it. */
async function presentDocs(docs: Prisma.VendorDocumentGetPayload<{ select: typeof DOC_SELECT }>[]): Promise<ReviewDoc[]> {
  const reviewerIds = [...new Set(docs.map((d) => d.reviewedBy).filter((x): x is string => !!x))];
  const reviewers = reviewerIds.length
    ? await prisma.user.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(reviewers.map((r) => [r.id, r.name]));
  return docs.map(({ storageKey, ...d }) => {
    const ext = path.extname(storageKey).toLowerCase();
    return {
      ...d,
      reviewerName: d.reviewedBy ? nameOf.get(d.reviewedBy) ?? null : null,
      contentType: ext === ".pdf" ? "pdf" : [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(ext) ? "image" : "other",
    };
  });
}

export async function getVendorForReview(actor: Actor | null, id: string) {
  await requireStaff(actor, "ADMIN");
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    select: {
      id: true,
      businessName: true,
      legalName: true,
      gstin: true,
      phoneE164: true,
      email: true,
      city: true,
      state: true,
      pincode: true,
      servicePincodes: true,
      status: true,
      statusNote: true,
      isActive: true,
      createdAt: true,
      user: { select: { id: true, name: true, phoneE164: true } },
      documents: { select: DOC_SELECT, orderBy: { createdAt: "desc" } },
    },
  });
  if (!vendor) throw new NotFoundError("Vendor");
  const requirements = evaluateRequirements("vendor", vendor.documents);
  return { ...vendor, documents: await presentDocs(vendor.documents), requirements };
}

export async function getWorkerForReview(actor: Actor | null, id: string) {
  await requireStaff(actor, "ADMIN");
  const worker = await prisma.worker.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      bio: true,
      idVerificationStatus: true,
      statusNote: true,
      yearsExperience: true,
      completedJobs: true,
      baseCity: true,
      basePincode: true,
      serviceRadiusKm: true,
      isActive: true,
      createdAt: true,
      user: { select: { id: true, name: true, phoneE164: true } },
      skills: { select: { trade: true, yearsExperience: true, isPrimary: true }, orderBy: { isPrimary: "desc" } },
      documents: { select: DOC_SELECT, orderBy: { createdAt: "desc" } },
    },
  });
  if (!worker) throw new NotFoundError("Worker");
  const requirements = evaluateRequirements("worker", worker.documents);
  return { ...worker, documents: await presentDocs(worker.documents), requirements };
}

export type VendorReview = Awaited<ReturnType<typeof getVendorForReview>>;
export type WorkerReview = Awaited<ReturnType<typeof getWorkerForReview>>;
export type { RequirementSummary };

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface ReviewDocumentInput {
  kind: VerificationKind;
  status: "VERIFIED" | "REJECTED";
  notes?: string | null;
}

export async function reviewDocument(actor: Actor | null, id: string, input: ReviewDocumentInput, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  const notes = input.notes?.trim() || null;
  if (input.status === "REJECTED" && !notes) {
    throw new ValidationError("Say why the document is rejected", [{ field: "notes", message: "Required when rejecting" }]);
  }

  return prisma.$transaction(async (tx) => {
    const lookup = { id: true, type: true, status: true, notes: true } as const;
    const d: { type: DocumentType; status: VerificationStatus; notes: string | null; ownerId: string } | null =
      input.kind === "vendor"
        ? await tx.vendorDocument
            .findUnique({ where: { id }, select: { ...lookup, vendorId: true } })
            .then((x) => x && { ...x, ownerId: x.vendorId })
        : await tx.workerDocument
            .findUnique({ where: { id }, select: { ...lookup, workerId: true } })
            .then((x) => x && { ...x, ownerId: x.workerId });
    if (!d) throw new NotFoundError("Document");

    const data = { status: input.status, notes, reviewedBy: staff.userId, reviewedAt: new Date() };
    const updated =
      input.kind === "vendor"
        ? await tx.vendorDocument.update({ where: { id }, data, select: { id: true, type: true, status: true, notes: true, reviewedAt: true } })
        : await tx.workerDocument.update({ where: { id }, data, select: { id: true, type: true, status: true, notes: true, reviewedAt: true } });

    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "document.review",
      entityType: input.kind === "vendor" ? "VendorDocument" : "WorkerDocument",
      entityId: id,
      before: { status: d.status, notes: d.notes, type: d.type, ownerId: d.ownerId },
      after: { status: updated.status, notes: updated.notes, type: updated.type, ownerId: d.ownerId },
      ...meta,
    });
    return updated;
  });
}

export interface SetStatusInput {
  status: VerificationStatus;
  reason?: string | null;
}

function checkReason(input: SetStatusInput): string | null {
  const reason = input.reason?.trim() || null;
  if (input.status === "REJECTED" && (!reason || reason.length < 3)) {
    throw new ValidationError("A rejection reason is required", [{ field: "reason", message: "Tell the applicant what to fix" }]);
  }
  return reason;
}

const NOTIFY_COPY: Record<VerificationStatus, { title: string; body: (reason: string | null) => string }> = {
  VERIFIED: { title: "You're verified", body: () => "Your documents were approved. Your profile is now live on Gharr." },
  REJECTED: { title: "Verification not approved", body: (r) => `We couldn't verify your account: ${r}. Update your documents and we'll review again.` },
  PENDING: { title: "Verification under review", body: (r) => (r ? `Your verification is back under review: ${r}` : "Your verification is back under review.") },
};

/**
 * Vendor account decision. VERIFIED puts the shop live; REJECTED and PENDING
 * take it off sale — an unverified seller must not be taking orders.
 */
export async function setVendorStatus(actor: Actor | null, id: string, input: SetStatusInput, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  const reason = checkReason(input);

  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({
      where: { id },
      select: { id: true, userId: true, businessName: true, status: true, isActive: true, statusNote: true, documents: { select: { type: true, status: true } } },
    });
    if (!vendor) throw new NotFoundError("Vendor");
    if (vendor.status === input.status) throw new ConflictError(`Vendor is already ${input.status.toLowerCase()}`);

    if (input.status === "VERIFIED") {
      const summary = evaluateRequirements("vendor", vendor.documents);
      if (!summary.canVerify) throw new ConflictError(blockingMessage(summary), { blocking: summary.blocking.map((b) => b.key) });
    }

    const updated = await tx.vendor.update({
      where: { id },
      data: { status: input.status, isActive: input.status === "VERIFIED", statusNote: input.status === "VERIFIED" ? null : reason },
      select: { id: true, status: true, isActive: true, statusNote: true },
    });

    if (vendor.userId) {
      const copy = NOTIFY_COPY[input.status];
      await tx.notification.create({
        data: {
          userId: vendor.userId,
          type: `vendor.verification.${input.status.toLowerCase()}`,
          title: copy.title,
          body: copy.body(reason),
          data: { vendorId: id },
        },
      });
    }

    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "vendor.verification",
      entityType: "Vendor",
      entityId: id,
      before: { status: vendor.status, isActive: vendor.isActive, statusNote: vendor.statusNote },
      after: updated,
      ...meta,
    });
    return updated;
  });
}

/**
 * Worker account decision. VERIFIED activates and badges the worker; REJECTED
 * drops them out of discovery. Moving back to PENDING leaves `isActive` alone —
 * pending workers are listed without the badge, as they were on sign-up.
 */
export async function setWorkerStatus(actor: Actor | null, id: string, input: SetStatusInput, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  const reason = checkReason(input);

  return prisma.$transaction(async (tx) => {
    const worker = await tx.worker.findUnique({
      where: { id },
      select: { id: true, userId: true, idVerificationStatus: true, isActive: true, statusNote: true, documents: { select: { type: true, status: true } } },
    });
    if (!worker) throw new NotFoundError("Worker");
    if (worker.idVerificationStatus === input.status) throw new ConflictError(`Worker is already ${input.status.toLowerCase()}`);

    if (input.status === "VERIFIED") {
      const summary = evaluateRequirements("worker", worker.documents);
      if (!summary.canVerify) throw new ConflictError(blockingMessage(summary), { blocking: summary.blocking.map((b) => b.key) });
    }

    const isActive = input.status === "VERIFIED" ? true : input.status === "REJECTED" ? false : worker.isActive;
    const updated = await tx.worker.update({
      where: { id },
      data: { idVerificationStatus: input.status, isActive, statusNote: input.status === "VERIFIED" ? null : reason },
      select: { id: true, idVerificationStatus: true, isActive: true, statusNote: true },
    });

    const copy = NOTIFY_COPY[input.status];
    await tx.notification.create({
      data: {
        userId: worker.userId,
        type: `worker.verification.${input.status.toLowerCase()}`,
        title: copy.title,
        body: copy.body(reason),
        data: { workerId: id },
      },
    });

    await writeAudit(tx, {
      actor: staff,
      actorRole: "ADMIN",
      action: "worker.verification",
      entityType: "Worker",
      entityId: id,
      before: { status: worker.idVerificationStatus, isActive: worker.isActive, statusNote: worker.statusNote },
      after: { status: updated.idVerificationStatus, isActive: updated.isActive, statusNote: updated.statusNote },
      ...meta,
    });
    return updated;
  });
}

/**
 * Loads a document's bytes for the staff-only file route. Every view is
 * audited: looking at someone's Aadhaar is itself an access worth recording.
 */
export async function readDocumentFile(actor: Actor | null, kind: VerificationKind, id: string, meta: RequestMeta = {}) {
  const staff = await requireStaff(actor, "ADMIN");
  const doc =
    kind === "vendor"
      ? await prisma.vendorDocument.findUnique({ where: { id }, select: { id: true, type: true, storageKey: true } })
      : await prisma.workerDocument.findUnique({ where: { id }, select: { id: true, type: true, storageKey: true } });
  if (!doc) throw new NotFoundError("Document");

  const file = await readPrivate(doc.storageKey);
  await writeAudit(prisma, {
    actor: staff,
    actorRole: "ADMIN",
    action: "document.viewed",
    entityType: kind === "vendor" ? "VendorDocument" : "WorkerDocument",
    entityId: id,
    after: { type: doc.type },
    ...meta,
  });

  const filename = `${doc.type.toLowerCase()}${path.extname(doc.storageKey).toLowerCase()}`;
  return { ...file, filename };
}
