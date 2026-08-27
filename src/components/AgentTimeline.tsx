import type { ToolEvent } from "@/lib/types";

/**
 * The agent's work, rendered as it happens.
 *
 * A single "I built your app" bubble hides everything interesting about a
 * generation. Showing the schema being declared, each file landing, and the
 * seed rows going in is the same stream of events either way — it just costs
 * nothing to make it legible.
 */

type Tone = "normal" | "bad" | "good";

interface Entry {
  label: string;
  detail?: string;
  icon: React.ReactNode;
  tone: Tone;
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden {...stroke}>
      {children}
    </svg>
  );
}

const ICONS = {
  schema: (
    <Icon>
      <ellipse cx="8" cy="4" rx="5.25" ry="2.25" />
      <path d="M2.75 4v8c0 1.24 2.35 2.25 5.25 2.25s5.25-1.01 5.25-2.25V4" />
      <path d="M2.75 8c0 1.24 2.35 2.25 5.25 2.25S13.25 9.24 13.25 8" />
    </Icon>
  ),
  file: (
    <Icon>
      <path d="M9 1.75H4.5a1.25 1.25 0 0 0-1.25 1.25v10a1.25 1.25 0 0 0 1.25 1.25h7a1.25 1.25 0 0 0 1.25-1.25V5.5Z" />
      <path d="M9 1.75V5.5h3.75" />
    </Icon>
  ),
  edit: (
    <Icon>
      <path d="M11.5 2.5a1.77 1.77 0 0 1 2.5 2.5L5.5 13.5 2 14.5l1-3.5Z" />
    </Icon>
  ),
  trash: (
    <Icon>
      <path d="M2.5 4.25h11M6 4.25V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.25M12.25 4.25V13a1.25 1.25 0 0 1-1.25 1.25H5A1.25 1.25 0 0 1 3.75 13V4.25" />
    </Icon>
  ),
  rows: (
    <Icon>
      <rect x="2" y="3" width="12" height="10" rx="1.25" />
      <path d="M2 6.5h12M2 9.75h12" />
    </Icon>
  ),
  alert: (
    <Icon>
      <path d="M8 2.5 14.5 13.5h-13Z" />
      <path d="M8 6.75v3M8 11.75h.01" />
    </Icon>
  ),
  check: (
    <Icon>
      <path d="m3 8.5 3.25 3.25L13 5" />
    </Icon>
  ),
  spark: (
    <Icon>
      <path d="M8 1.75 9.6 6.4 14.25 8 9.6 9.6 8 14.25 6.4 9.6 1.75 8 6.4 6.4Z" />
    </Icon>
  ),
};

function describe(event: ToolEvent): Entry {
  switch (event.kind) {
    case "plan":
      return { label: "Planning", detail: event.text, icon: ICONS.spark, tone: "normal" };
    case "set_schema":
      return {
        label: "Designed the data model",
        detail: event.collections.join(", "),
        icon: ICONS.schema,
        tone: "normal",
      };
    case "write_file":
      return {
        label: `Wrote ${event.path}`,
        detail: `${event.bytes.toLocaleString()} chars`,
        icon: ICONS.file,
        tone: "normal",
      };
    case "edit_file":
      return { label: `Edited ${event.path}`, icon: ICONS.edit, tone: "normal" };
    case "delete_file":
      return { label: `Deleted ${event.path}`, icon: ICONS.trash, tone: "normal" };
    case "seed_data":
      return {
        label: `Seeded ${event.collection}`,
        detail: `${event.count} ${event.count === 1 ? "row" : "rows"}`,
        icon: ICONS.rows,
        tone: "normal",
      };
    case "error":
      return { label: "Correcting", detail: event.message, icon: ICONS.alert, tone: "bad" };
    case "done":
      return { label: "Done", icon: ICONS.check, tone: "good" };
  }
}

const TONE_CLASS: Record<Tone, string> = {
  normal: "text-muted",
  bad: "text-bad",
  good: "text-ok",
};

export function AgentTimeline({
  events,
  running,
}: {
  events: ToolEvent[];
  running?: boolean;
}) {
  if (events.length === 0 && !running) return null;

  return (
    <ol className="relative space-y-2 rounded-xl border border-border bg-surface px-3.5 py-3">
      {/* One continuous rail behind the icons reads as a sequence rather than
          an unordered list of things that happened. */}
      <span
        className="absolute left-[1.19rem] top-5 bottom-4 w-px bg-border"
        aria-hidden
      />

      {events.map((event, index) => {
        const entry = describe(event);
        return (
          <li key={index} className="relative flex items-start gap-2.5 text-[13px]">
            <span
              className={`relative z-10 mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 ${TONE_CLASS[entry.tone]}`}
            >
              {entry.icon}
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className={entry.tone === "bad" ? "text-bad" : "text-foreground"}>
                {entry.label}
              </span>
              {entry.detail && (
                <span
                  className="ml-2 inline-block max-w-full truncate align-bottom font-mono text-[11px] text-faint"
                  title={entry.detail}
                >
                  {entry.detail}
                </span>
              )}
            </span>
          </li>
        );
      })}

      {running && (
        <li className="relative flex items-start gap-2.5 text-[13px]">
          <span className="relative z-10 mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-surface-2 text-accent">
            <span className="bench-working size-1.5 rounded-full bg-accent" />
          </span>
          <span className="pt-0.5 text-muted">Working…</span>
        </li>
      )}
    </ol>
  );
}
