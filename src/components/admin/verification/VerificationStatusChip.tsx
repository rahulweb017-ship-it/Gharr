import type { VerificationStatus } from "@prisma/client";
import { Chip, VerifiedChip } from "@/components/ui/Chip";

/** Green is reserved for trust, so only VERIFIED uses the trust tone. */
export function VerificationStatusChip({ status }: { status: VerificationStatus | "MISSING" }) {
  if (status === "VERIFIED") return <VerifiedChip />;
  if (status === "REJECTED") return <Chip tone="danger">Rejected</Chip>;
  if (status === "MISSING") return <Chip tone="neutral">Not uploaded</Chip>;
  return <Chip tone="warning">Pending review</Chip>;
}
