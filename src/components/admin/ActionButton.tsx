"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Field, inputClass } from "@/components/ui/Field";
import { apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import { cn } from "@/lib/cn";

/**
 * One button for every admin mutation: sends a JSON request, shows the server's
 * error inline, and refreshes the server-rendered page on success.
 *
 * Consequential actions (reject, suspend, refund, resolve) set `confirm`, which
 * opens a sheet that can also collect a required reason — the reason is written
 * to the audit log, so "why" is never lost.
 */

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

export interface ActionButtonProps {
  label: string;
  method?: Method;
  path: string;
  body?: Record<string, unknown>;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
  confirm?: {
    title: string;
    message?: string;
    /** When set, a text field is shown and its value sent under this key. */
    reasonField?: string;
    reasonLabel?: string;
    reasonRequired?: boolean;
    /** Extra numeric field, e.g. a refund amount in rupees sent as paise. */
    amountField?: { name: string; label: string; defaultRupees?: number; maxRupees?: number };
    confirmLabel?: string;
  };
  onDone?: () => void;
  className?: string;
  disabled?: boolean;
}

const send = (method: Method, path: string, body?: unknown) =>
  method === "POST" ? apiPost(path, body) : method === "PATCH" ? apiPatch(path, body) : method === "PUT" ? apiPut(path, body) : apiDelete(path);

export function ActionButton({
  label,
  method = "POST",
  path,
  body,
  variant = "outline",
  size = "sm",
  confirm,
  onDone,
  className,
  disabled,
}: ActionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(confirm?.amountField?.defaultRupees?.toString() ?? "");

  async function run() {
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = { ...(body ?? {}) };
    if (confirm?.reasonField) payload[confirm.reasonField] = reason.trim();
    if (confirm?.amountField) payload[confirm.amountField.name] = Math.round(Number(amount) * 100);

    const result = await send(method, path, method === "DELETE" ? undefined : payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setOpen(false);
    setReason("");
    onDone?.();
    router.refresh();
  }

  const reasonMissing = !!confirm?.reasonRequired && reason.trim().length < 3;
  const amountInvalid =
    !!confirm?.amountField &&
    (!(Number(amount) > 0) || (confirm.amountField.maxRupees != null && Number(amount) > confirm.amountField.maxRupees));

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={busy && !confirm}
        disabled={disabled}
        className={className}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {label}
      </Button>
      {!confirm && error && <span role="alert" className="text-xs font-medium text-red-600">{error}</span>}

      {confirm && (
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={confirm.title}
          footer={
            <div className="flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={variant === "danger" ? "danger" : "primary"}
                className="flex-1"
                loading={busy}
                disabled={reasonMissing || amountInvalid}
                onClick={run}
              >
                {confirm.confirmLabel ?? label}
              </Button>
            </div>
          }
        >
          {confirm.message && <p className="text-sm leading-relaxed text-ink-600">{confirm.message}</p>}
          {confirm.amountField && (
            <Field label={confirm.amountField.label} htmlFor="action-amount" className="mt-4"
              hint={confirm.amountField.maxRupees != null ? `Up to ₹${confirm.amountField.maxRupees.toLocaleString("en-IN")}` : undefined}>
              <input id="action-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} className={inputClass} />
            </Field>
          )}
          {confirm.reasonField && (
            <Field label={confirm.reasonLabel ?? "Reason"} htmlFor="action-reason" className="mt-4"
              hint={confirm.reasonRequired ? "Required — recorded in the audit log" : "Optional — recorded in the audit log"}>
              <textarea id="action-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={cn(inputClass, "h-auto py-2.5")} />
            </Field>
          )}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </Sheet>
      )}
    </>
  );
}
