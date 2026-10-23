"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SelectInput } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { apiPatch } from "@/lib/api-client";
import { humanize } from "@/lib/admin-format";
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/shared/contracts/support";
import { TICKET_STATUS_LABELS } from "@/components/support/ticket-status";

/**
 * Status, priority and assignee for one ticket. Each change saves on its own
 * (one PATCH, one audit row) — staff triage one field at a time.
 */
export function TicketControls({
  ticketId,
  status,
  priority,
  assignedToId,
  viewerId,
  staff,
}: {
  ticketId: string;
  status: (typeof TICKET_STATUSES)[number];
  priority: string;
  assignedToId: string | null;
  viewerId: string;
  staff: Array<{ id: string; name: string | null; phoneE164: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(field: string, value: unknown) {
    setBusy(field);
    setError(null);
    const result = await apiPatch(`/admin/tickets/${ticketId}`, { [field]: value });
    setBusy(null);
    if (!result.ok) setError(result.error.message);
    else router.refresh();
  }

  const select = "h-10 text-sm";

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
        Status
        <SelectInput className={select} value={status} disabled={busy !== null} onChange={(e) => save("status", e.target.value)}>
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectInput>
      </label>

      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-500">
        Priority
        <SelectInput className={select} value={priority} disabled={busy !== null} onChange={(e) => save("priority", e.target.value)}>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {humanize(p)}
            </option>
          ))}
        </SelectInput>
      </label>

      <div className="flex flex-col gap-1">
        <label htmlFor="ticket-assignee" className="text-xs font-semibold text-ink-500">
          Assignee
        </label>
        <SelectInput
          id="ticket-assignee"
          className={select}
          value={assignedToId ?? ""}
          disabled={busy !== null}
          onChange={(e) => save("assignedToId", e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === viewerId ? `${s.name ?? "You"} (you)` : s.name ?? s.phoneE164}
            </option>
          ))}
        </SelectInput>
        {assignedToId !== viewerId && (
          <Button type="button" variant="ghost" size="sm" className="self-start" disabled={busy !== null} onClick={() => save("assignedToId", viewerId)}>
            Assign to me
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
