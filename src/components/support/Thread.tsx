import { cn } from "@/lib/cn";

/**
 * A support conversation. Messages from the customer sit on one side, staff
 * replies on the other, so the back-and-forth reads at a glance in both the
 * customer app and the admin console.
 */

export interface ThreadMessage {
  id: string;
  body: string;
  isStaff: boolean;
  createdAt: Date | string;
  author: string;
}

const STAMP: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
};

export function Thread({ messages, staffSide = "left" }: { messages: ThreadMessage[]; staffSide?: "left" | "right" }) {
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const right = staffSide === "right" ? m.isStaff : !m.isStaff;
        return (
          <li key={m.id} className={cn("flex", right ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5",
                m.isStaff ? "border border-ink-100 bg-ink-50" : "bg-brand-50",
                right ? "rounded-br-md" : "rounded-bl-md",
              )}
            >
              <p className="flex items-baseline gap-2 text-xs">
                <span className={cn("font-bold", m.isStaff ? "text-ink-900" : "text-brand-800")}>{m.author}</span>
                <time dateTime={new Date(m.createdAt).toISOString()} className="text-ink-400">
                  {new Date(m.createdAt).toLocaleString("en-IN", STAMP)}
                </time>
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-ink-800">{m.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
