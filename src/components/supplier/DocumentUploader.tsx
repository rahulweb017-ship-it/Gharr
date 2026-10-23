"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import type { DocumentType, VerificationStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { VerificationStatusChip } from "@/components/admin/verification/VerificationStatusChip";
import { apiUpload } from "@/lib/api-client";

/**
 * One row per required KYC document: its review state, the admin's note when
 * rejected, and an upload button. A new upload replaces a pending one.
 */

export interface DocRequirement {
  key: string;
  label: string;
  type: DocumentType;
  state: VerificationStatus | "MISSING";
  note: string | null;
  uploadedAt: string | null;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_BYTES = 5 * 1024 * 1024;

export function DocumentUploader({ items }: { items: DocRequirement[] }) {
  return (
    <ul className="divide-y divide-ink-100 rounded-(--radius-card) border border-ink-100 bg-white shadow-(--shadow-card)">
      {items.map((item) => (
        <DocumentRow key={item.key} item={item} />
      ))}
    </ul>
  );
}

function DocumentRow({ item }: { item: DocRequirement }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError("Files must be 5 MB or smaller");
      return;
    }
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("type", item.type);
    form.set("file", file);
    const result = await apiUpload("/vendor/documents", form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    router.refresh();
  }

  const canUpload = item.state !== "VERIFIED";

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink-900">{item.label}</p>
          <VerificationStatusChip status={item.state} />
        </div>
        {item.uploadedAt && <p className="mt-0.5 text-xs text-ink-400">Uploaded {item.uploadedAt}</p>}
        {item.state === "REJECTED" && item.note && (
          <p className="mt-1 text-sm text-red-700">Reason: {item.note}</p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
      {canUpload && (
        <>
          <input ref={input} type="file" accept={ACCEPT} className="sr-only" onChange={onFile} aria-label={`Upload ${item.label}`} />
          <Button
            type="button"
            variant={item.state === "MISSING" || item.state === "REJECTED" ? "primary" : "outline"}
            size="sm"
            loading={busy}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden className="size-4" />
            {item.state === "MISSING" ? "Upload" : "Replace"}
          </Button>
        </>
      )}
    </li>
  );
}
