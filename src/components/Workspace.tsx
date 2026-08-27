"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTimeline } from "@/components/AgentTimeline";
import { AppPreview } from "@/components/AppPreview";
import { DataView } from "@/components/DataView";
import { PublishToggle } from "@/components/PublishToggle";
import { streamGeneration } from "@/lib/client/generate";
import type { AppSchema, FileMap, ToolEvent } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  events?: ToolEvent[];
}

type Tab = "preview" | "data" | "files";

export function Workspace({
  projectId,
  title,
  slug,
  published,
  initialFiles,
  initialSchema,
  initialTurns,
  initialPrompt,
}: {
  projectId: string;
  title: string;
  slug: string;
  published: boolean;
  initialFiles: FileMap;
  initialSchema: AppSchema;
  initialTurns: Turn[];
  /** Carried over from the home page so the first build starts on arrival. */
  initialPrompt?: string;
}) {
  const [files, setFiles] = useState<FileMap>(initialFiles);
  const [schema, setSchema] = useState<AppSchema>(initialSchema);
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [liveEvents, setLiveEvents] = useState<ToolEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");

  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (message: string) => {
      if (!message.trim() || running) return;

      setRunning(true);
      setRunError(null);
      setPreviewError(null);
      setLiveEvents([]);
      setLiveText("");
      setDraft("");
      setTurns((current) => [...current, { role: "user", content: message }]);

      const controller = new AbortController();
      abortRef.current = controller;

      const events: ToolEvent[] = [];
      let summary = "";

      try {
        for await (const event of streamGeneration(projectId, message, controller.signal)) {
          switch (event.type) {
            case "tool":
              events.push(event.event);
              setLiveEvents([...events]);
              break;
            case "text":
              summary += event.text;
              setLiveText(summary);
              break;
            case "done":
              setFiles(event.files);
              setSchema(event.schema);
              setTurns((current) => [
                ...current,
                { role: "assistant", content: event.summary, events: [...events] },
              ]);
              setLiveEvents([]);
              setLiveText("");
              break;
            case "error":
              setRunError(event.message);
              break;
            // `thinking` and `start` carry no user-visible state of their own.
            default:
              break;
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setRunError(error instanceof Error ? error.message : "Generation failed");
        }
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    [projectId, running],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  // Fires once. `submit` is intentionally not a dependency: it changes whenever
  // `running` flips, which would re-trigger the effect mid-run.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !initialPrompt || initialTurns.length > 0) return;
    autoStarted.current = true;
    submit(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const filePaths = Object.keys(files).sort();

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-border px-5 py-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Bench
        </Link>
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <div className="flex-1" />
        {schema.collections.length > 0 && (
          <span className="hidden font-mono text-[11px] text-muted lg:inline">
            {schema.collections.map((c) => c.name).join(" · ")}
          </span>
        )}
        {/* Publishing only makes sense once there is an app to publish. */}
        {filePaths.length > 0 && (
          <PublishToggle projectId={projectId} slug={slug} initialPublished={published} />
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex w-[400px] shrink-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {turns.length === 0 && !running && (
              <p className="text-sm text-muted">
                Describe the tool you want. The agent designs the data model, builds the
                interface, and fills it with realistic rows.
              </p>
            )}

            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div key={index} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                  {turn.content}
                </div>
              ) : (
                <div key={index} className="space-y-2">
                  {turn.events && turn.events.length > 0 && (
                    <AgentTimeline events={turn.events} />
                  )}
                  {turn.content && (
                    <p className="text-sm leading-relaxed text-muted">{turn.content}</p>
                  )}
                </div>
              ),
            )}

            {running && <AgentTimeline events={liveEvents} running />}
            {liveText && <p className="text-sm leading-relaxed text-muted">{liveText}</p>}

            {runError && (
              <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
                {runError}
              </p>
            )}
          </div>

          <form
            className="border-t border-border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
          >
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              rows={3}
              disabled={running}
              placeholder={
                filePaths.length === 0
                  ? "A CRM for a small sales team…"
                  : "Add a dashboard with monthly revenue…"
              }
              className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={running || !draft.trim()}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
              >
                {running ? "Building…" : "Send"}
              </button>
              {running && (
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
                >
                  Stop
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            {(["preview", "data", "files"] as Tab[]).map((name) => (
              <button
                key={name}
                onClick={() => setTab(name)}
                className={`rounded-md px-2.5 py-1 text-sm capitalize ${
                  tab === name ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {name}
                {name === "files" && filePaths.length > 0 && (
                  <span className="ml-1.5 font-mono text-[11px] text-muted">
                    {filePaths.length}
                  </span>
                )}
                {name === "data" && schema.collections.length > 0 && (
                  <span className="ml-1.5 font-mono text-[11px] text-muted">
                    {schema.collections.length}
                  </span>
                )}
              </button>
            ))}
            <div className="flex-1" />
            {previewError && (
              <span className="truncate text-xs text-bad" title={previewError}>
                {previewError}
              </span>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-surface">
            {tab === "preview" ? (
              <AppPreview projectId={projectId} files={files} onError={setPreviewError} />
            ) : tab === "data" ? (
              <DataView projectId={projectId} schema={schema} />
            ) : (
              <div className="h-full overflow-y-auto p-4">
                {filePaths.length === 0 ? (
                  <p className="text-sm text-muted">No files yet.</p>
                ) : (
                  <ul className="space-y-1 font-mono text-[13px]">
                    {filePaths.map((path) => (
                      <li key={path} className="flex items-baseline justify-between gap-4">
                        <span>{path}</span>
                        <span className="text-[11px] text-muted">
                          {files[path].length.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
