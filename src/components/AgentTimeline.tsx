import type { ToolEvent } from "@/lib/types";

/**
 * The agent's work, rendered as it happens.
 *
 * A single "I built your app" bubble hides everything interesting about a
 * generation. Showing the schema being declared, each file landing, and the
 * seed rows going in is the same stream of events either way — it just costs
 * nothing to make it legible.
 */
function describe(event: ToolEvent): { label: string; detail?: string; tone?: "bad" } {
  switch (event.kind) {
    case "plan":
      return { label: "Planning", detail: event.text };
    case "set_schema":
      return { label: "Designed the data model", detail: event.collections.join(", ") };
    case "write_file":
      return { label: `Wrote ${event.path}`, detail: `${event.bytes.toLocaleString()} chars` };
    case "edit_file":
      return { label: `Edited ${event.path}` };
    case "delete_file":
      return { label: `Deleted ${event.path}` };
    case "seed_data":
      return {
        label: `Seeded ${event.collection}`,
        detail: `${event.count} ${event.count === 1 ? "row" : "rows"}`,
      };
    case "error":
      return { label: "Correcting", detail: event.message, tone: "bad" };
    case "done":
      return { label: "Done" };
  }
}

export function AgentTimeline({
  events,
  running,
}: {
  events: ToolEvent[];
  running?: boolean;
}) {
  if (events.length === 0 && !running) return null;

  return (
    <ol className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-3">
      {events.map((event, index) => {
        const { label, detail, tone } = describe(event);
        return (
          <li key={index} className="flex items-baseline gap-2.5 text-[13px]">
            <span
              className={`size-1.5 shrink-0 translate-y-[3px] rounded-full ${
                tone === "bad" ? "bg-bad" : "bg-ok"
              }`}
            />
            <span className={tone === "bad" ? "text-bad" : "text-foreground"}>{label}</span>
            {detail && (
              <span className="truncate font-mono text-[11px] text-muted" title={detail}>
                {detail}
              </span>
            )}
          </li>
        );
      })}
      {running && (
        <li className="flex items-baseline gap-2.5 text-[13px] text-muted">
          <span className="size-1.5 shrink-0 translate-y-[3px] animate-pulse rounded-full bg-accent" />
          Working…
        </li>
      )}
    </ol>
  );
}
