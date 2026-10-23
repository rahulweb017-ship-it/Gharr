"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { apiPost } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * Reply box for a ticket thread. The customer and staff forms differ only in
 * the endpoint and wording, so both use this one.
 */
export function ReplyForm({
  path,
  placeholder = "Write a reply…",
  submitLabel = "Send reply",
  hint,
}: {
  path: string;
  placeholder?: string;
  submitLabel?: string;
  hint?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const result = await apiPost(path, { body: body.trim() });
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="ticket-reply" className="sr-only">
        Reply
      </label>
      <textarea
        id="ticket-reply"
        rows={4}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        className={cn(inputClass, "h-auto py-2.5")}
      />
      {error && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-400">{hint}</p>
        <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
