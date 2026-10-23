import Link from "next/link";
import { BadgeCheck, CircleAlert, Clock } from "lucide-react";
import type { MyVendor } from "@/server/services/vendor/onboarding.service";

/** Tells a supplier what stands between them and selling, and links to it. */
export function VerificationBanner({ vendor }: { vendor: MyVendor }) {
  if (vendor.status === "VERIFIED" && vendor.isActive) return null;

  const r = vendor.requirements;
  if (vendor.status === "REJECTED") {
    return (
      <div className="mb-6 flex gap-3 rounded-(--radius-card) border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold">Verification was not approved</p>
          {vendor.statusNote && <p className="mt-0.5">{vendor.statusNote}</p>}
          <p className="mt-1">
            Fix the details in{" "}
            <Link href="/supplier/documents" className="font-semibold underline">
              Documents
            </Link>{" "}
            or raise a support ticket.
          </p>
        </div>
      </div>
    );
  }

  if (r.missing.length > 0 || r.items.some((i) => i.state === "REJECTED")) {
    return (
      <div className="mb-6 flex gap-3 rounded-(--radius-card) border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
        <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="font-bold">Upload your documents to start selling</p>
          <p className="mt-0.5">
            {r.uploaded} of {r.required} uploaded.{" "}
            <Link href="/supplier/documents" className="font-semibold underline">
              Upload now
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 flex gap-3 rounded-(--radius-card) border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      {r.canVerify ? <BadgeCheck aria-hidden className="mt-0.5 size-5 shrink-0" /> : <Clock aria-hidden className="mt-0.5 size-5 shrink-0" />}
      <div>
        <p className="font-bold">Your documents are under review</p>
        <p className="mt-0.5">We usually finish within 2 working days. You can set up your profile meanwhile, and you can list products once you are verified.</p>
      </div>
    </div>
  );
}
