import type { DocumentType, VerificationStatus } from "@prisma/client";

/**
 * Which documents an account needs before it can be verified.
 *
 * Kept pure (no Prisma client) so the rule is unit-tested and shared by the
 * queue, the detail screen and the service guard that actually refuses a
 * premature "Verify" — the UI hint and the enforcement can never disagree.
 */

export type VerificationKind = "vendor" | "worker";

export interface Requirement {
  key: string;
  label: string;
  /** Any one of these document types satisfies the requirement. */
  anyOf: DocumentType[];
}

export const REQUIRED_DOCUMENTS: Record<VerificationKind, Requirement[]> = {
  vendor: [
    { key: "GST", label: "GST registration certificate", anyOf: ["GST"] },
    { key: "SHOP_LICENSE", label: "Shop / trade licence", anyOf: ["SHOP_LICENSE"] },
    { key: "BANK_PROOF", label: "Bank account proof", anyOf: ["BANK_PROOF"] },
  ],
  worker: [
    { key: "PHOTO_ID", label: "Photo ID", anyOf: ["PHOTO_ID"] },
    { key: "IDENTITY", label: "Aadhaar or PAN", anyOf: ["AADHAAR", "PAN"] },
  ],
};

export interface DocLike {
  type: DocumentType;
  status: VerificationStatus;
}

export type RequirementState = "VERIFIED" | "PENDING" | "REJECTED" | "MISSING";

export interface RequirementResult extends Requirement {
  state: RequirementState;
}

export interface RequirementSummary {
  items: RequirementResult[];
  required: number;
  /** Requirements with a live (not rejected) upload. */
  uploaded: number;
  verified: number;
  /** Nothing uploaded at all — the owner must upload these. */
  missing: RequirementResult[];
  /** Every requirement not yet satisfied by a VERIFIED document. */
  blocking: RequirementResult[];
  canVerify: boolean;
}

/**
 * The best document state per requirement wins: one VERIFIED Aadhaar satisfies
 * "Aadhaar or PAN" even if an older PAN upload was rejected.
 */
export function evaluateRequirements(kind: VerificationKind, docs: DocLike[]): RequirementSummary {
  const items = REQUIRED_DOCUMENTS[kind].map((req): RequirementResult => {
    const matching = docs.filter((d) => req.anyOf.includes(d.type));
    const state: RequirementState = matching.some((d) => d.status === "VERIFIED")
      ? "VERIFIED"
      : matching.some((d) => d.status === "PENDING")
        ? "PENDING"
        : matching.length > 0
          ? "REJECTED"
          : "MISSING";
    return { ...req, state };
  });

  const blocking = items.filter((i) => i.state !== "VERIFIED");
  return {
    items,
    required: items.length,
    uploaded: items.filter((i) => i.state === "VERIFIED" || i.state === "PENDING").length,
    verified: items.length - blocking.length,
    missing: items.filter((i) => i.state === "MISSING"),
    blocking,
    canVerify: blocking.length === 0,
  };
}

/** Human sentence for the 409 a premature "Verify" gets. */
export function blockingMessage(summary: RequirementSummary): string {
  const parts = summary.blocking.map((b) =>
    b.state === "MISSING" ? `${b.label} (not uploaded)` : `${b.label} (${b.state.toLowerCase()})`,
  );
  return `All required documents must be approved first: ${parts.join(", ")}`;
}
