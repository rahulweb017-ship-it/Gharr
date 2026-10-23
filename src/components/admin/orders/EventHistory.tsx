import { formatDateTime, humanize } from "@/lib/admin-format";

/**
 * Status history for an order or booking, as staff need it: who moved it (by
 * role and name), from what, to what, and the reason they gave.
 */

export interface HistoryEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorRole: string | null;
  actorName: string | null;
  reason: string | null;
  createdAt: Date | string;
}

export function EventHistory({ events }: { events: HistoryEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-ink-500">No status changes recorded.</p>;

  return (
    <ol className="relative space-y-4 border-l border-ink-100 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span aria-hidden className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-ink-400" />
          <p className="text-sm font-semibold text-ink-900">
            {e.fromStatus ? `${humanize(e.fromStatus)} → ` : ""}
            {humanize(e.toStatus)}
          </p>
          <p className="text-xs text-ink-500">
            {formatDateTime(e.createdAt)} · {e.actorRole ? humanize(e.actorRole) : "System"}
            {e.actorName ? ` (${e.actorName})` : ""}
          </p>
          {e.reason && <p className="mt-1 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-700">{e.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
