"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentTimeline } from "@/components/AgentTimeline";
import { AppPreview, type PickedElement } from "@/components/AppPreview";
import { DataView } from "@/components/DataView";
import { FilesPanel } from "@/components/FilesPanel";
import { VersionHistory } from "@/components/VersionHistory";
import { PublishToggle } from "@/components/PublishToggle";
import { streamGeneration } from "@/lib/client/generate";
import type { VersionSummary } from "@/lib/projects";
import type { AppSchema, FileMap, ToolEvent } from "@/lib/types";

interface Turn {
  role: "user" | "assistant";
  content: string;
  events?: ToolEvent[];
}

type Tab = "preview" | "data" | "files" | "history";

/** Attempts the agent gets at fixing its own output before we stop asking. */
const MAX_AUTO_FIXES = 2;

/** One wording, shared by the automatic attempt and the manual button. */
const FIX_PROMPT = (error: string) =>
  [
    "The app you just built failed to run. The preview reported:",
    "",
    error,
    "",
    "Fix it, changing as little as possible.",
  ].join("\n");

/**
 * Describes the clicked element well enough for the agent to find it.
 *
 * No source mapping: the agent already has every file in context, so tag,
 * classes, visible text and the ancestor chain are enough to locate the JSX --
 * and unlike line numbers, that survives the agent restructuring the code.
 */
const ELEMENT_PROMPT = (element: PickedElement, instruction: string) =>
  [
    "Change this element in the app:",
    "",
    "  element:  <" + element.tag + (element.className ? ' class="' + element.className + '"' : "") + ">",
    element.attributes ? "  attrs:    " + element.attributes : "",
    element.text ? "  text:     " + element.text : "",
    "  location: " + element.path,
    "",
    instruction,
  ]
    .filter(Boolean)
    .join("\n");

export function Workspace({
  projectId,
  title,
  slug,
  published,
  initialFiles,
  initialSchema,
  initialTurns,
  initialVersions,
  initialCurrentVersionId,
  initialPrompt,
}: {
  projectId: string;
  title: string;
  slug: string;
  published: boolean;
  initialFiles: FileMap;
  initialSchema: AppSchema;
  initialTurns: Turn[];
  initialVersions: VersionSummary[];
  initialCurrentVersionId: string | null;
  /** Carried over from the home page so the first build starts on arrival. */
  initialPrompt?: string;
}) {
  const [files, setFiles] = useState<FileMap>(initialFiles);
  const [schema, setSchema] = useState<AppSchema>(initialSchema);
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [versions, setVersions] = useState<VersionSummary[]>(initialVersions);
  const [currentVersionId, setCurrentVersionId] = useState(initialCurrentVersionId);
  const [draft, setDraft] = useState("");
  const [running, setRunning] = useState(false);
  const [liveEvents, setLiveEvents] = useState<ToolEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [runError, setRunError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<PickedElement | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const autoFixArmed = useRef(false);
  const autoFixes = useRef(0);

  const submit = useCallback(
    async (message: string, display?: string) => {
      if (!message.trim() || running) return;

      setRunning(true);
      setRunError(null);
      setPreviewError(null);
      setLiveEvents([]);
      setLiveText("");
      setDraft("");
      setTurns((current) => [...current, { role: "user", content: display ?? message }]);

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
              autoFixArmed.current = true;
              setFiles(event.files);
              setSchema(event.schema);
              setCurrentVersionId(event.versionId);
              setVersions((current) => [
                {
                  id: event.versionId,
                  parentId: currentVersionId,
                  label: message.slice(0, 80),
                  createdAt: new Date().toISOString(),
                  fileCount: Object.keys(event.files).length,
                  collections: event.schema.collections.map((c) => c.name),
                },
                ...current,
              ]);
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
    [projectId, running, currentVersionId],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const submitManual = useCallback(
    (message: string) => {
      autoFixes.current = 0;
      submit(message);
    },
    [submit],
  );

  /**
   * Self-healing.
   *
   * A generation arms the loop; the first compile or runtime error the preview
   * reports after that is fed straight back to the agent. It disarms itself
   * immediately and stops after MAX_AUTO_FIXES, because an agent that cannot
   * fix an error will not fix it on the fifth attempt either -- it will just
   * burn tokens. A manual message resets the budget.
   */
  const handlePreviewError = useCallback(
    (message: string | null) => {
      setPreviewError(message);
      if (!message || running) return;
      if (!autoFixArmed.current || autoFixes.current >= MAX_AUTO_FIXES) return;

      autoFixArmed.current = false;
      autoFixes.current += 1;

      submit(FIX_PROMPT(message), "The app did not run. Asking the agent to fix it.");
    },
    [running, submit],
  );

  // Fires once. `submit` is intentionally not a dependency: it changes whenever
  // `running` flips, which would re-trigger the effect mid-run.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !initialPrompt || initialTurns.length > 0) return;
    autoStarted.current = true;
    submit(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  const submitElementAware = useCallback(
    (message: string) => {
      if (!message.trim()) return;
      if (picked) {
        // The chat shows the plain instruction; the model gets the element too.
        submit(ELEMENT_PROMPT(picked, message), message);
        setPicked(null);
        autoFixes.current = 0;
        return;
      }
      submitManual(message);
    },
    [picked, submit, submitManual],
  );

  const handlePick = useCallback((element: PickedElement | null) => {
    setSelectMode(false);
    setPicked(element);
  }, []);

  const filePaths = Object.keys(files).sort();
  const versionCount = versions.filter((version) => version.fileCount > 0).length;

  const badges: Partial<Record<Tab, number>> = {
    data: schema.collections.length,
    files: filePaths.length,
    history: versionCount,
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path
              d="M10 3 5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Bench
        </Link>

        <span className="h-4 w-px shrink-0 bg-border" aria-hidden />

        <h1 className="min-w-0 truncate text-sm font-medium">{title}</h1>

        {schema.collections.length > 0 && (
          <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-faint lg:inline">
            {schema.collections.map((collection) => collection.name).join(" / ")}
          </span>
        )}

        <div className="flex-1" />

        {/* Publishing only makes sense once there is an app to publish. */}
        {filePaths.length > 0 && (
          <PublishToggle projectId={projectId} slug={slug} initialPublished={published} />
        )}
      </header>

      {/* Stacks below lg: a fixed-width sidebar next to flex-1 leaves the
          preview zero width on a phone, which hides the generated app entirely. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="flex h-[45vh] w-full shrink-0 flex-col border-b border-border lg:h-auto lg:w-[380px] lg:border-b-0 lg:border-r xl:w-[420px]">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {turns.length === 0 && !running && (
              <div className="rounded-xl border border-dashed border-border px-4 py-5">
                <p className="text-sm leading-relaxed text-muted">
                  Describe the tool you want. The agent designs the data model, builds the
                  interface, and fills it with realistic rows.
                </p>
              </div>
            )}

            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div key={index} className="bench-rise">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-faint">
                    You
                  </p>
                  <div className="rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm leading-relaxed">
                    {turn.content}
                  </div>
                </div>
              ) : (
                <div key={index} className="bench-rise space-y-2.5">
                  {turn.events && turn.events.length > 0 && (
                    <AgentTimeline events={turn.events} />
                  )}
                  {turn.content && (
                    <p className="px-0.5 text-sm leading-relaxed text-muted">{turn.content}</p>
                  )}
                </div>
              ),
            )}

            {running && <AgentTimeline events={liveEvents} running />}

            {liveText && (
              <p className="px-0.5 text-sm leading-relaxed text-muted">{liveText}</p>
            )}

            {runError && (
              <p className="rounded-xl border border-bad/30 bg-bad/[0.07] px-3.5 py-2.5 text-sm text-bad">
                {runError}
              </p>
            )}
          </div>

          {picked && (
            <div className="mx-3 mb-2 rounded-xl border border-accent/40 bg-accent-dim/40 px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-[12px] leading-relaxed">
                  <span className="text-muted">Editing </span>
                  <code className="font-mono text-accent">&lt;{picked.tag}&gt;</code>
                  {picked.text && (
                    <span className="text-muted"> &ldquo;{picked.text.slice(0, 60)}&rdquo;</span>
                  )}
                </span>
                <button
                  onClick={() => setPicked(null)}
                  className="shrink-0 text-[11px] text-muted hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <form
            className="shrink-0 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitElementAware(draft);
            }}
          >
            <div className="rounded-xl border border-border bg-surface transition-colors focus-within:border-border-strong">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitElementAware(draft);
                  }
                }}
                rows={2}
                disabled={running}
                placeholder={
                  picked
                    ? "Describe the change to this element..."
                    : filePaths.length === 0
                      ? "A CRM for a small sales team..."
                      : "Add a dashboard with monthly revenue..."
                }
                className="w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-relaxed outline-none placeholder:text-faint disabled:opacity-60"
              />
              <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
                {running && (
                  <button
                    type="button"
                    onClick={stop}
                    className="rounded-lg border border-border px-2.5 py-1 text-[13px] text-muted transition-colors hover:text-foreground"
                  >
                    Stop
                  </button>
                )}
                <button
                  type="submit"
                  disabled={running || !draft.trim()}
                  className="rounded-lg bg-accent px-3 py-1 text-[13px] font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-30"
                >
                  {running ? "Building..." : "Send"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface p-0.5">
              {(["preview", "data", "files", "history"] as Tab[]).map((name) => (
                <button
                  key={name}
                  onClick={() => setTab(name)}
                  className={
                    tab === name
                      ? "rounded-[7px] bg-surface-3 px-2.5 py-1 text-[13px] capitalize text-foreground transition-colors"
                      : "rounded-[7px] px-2.5 py-1 text-[13px] capitalize text-muted transition-colors hover:text-foreground"
                  }
                >
                  {name}
                  {(badges[name] ?? 0) > 0 && (
                    <span className="ml-1.5 font-mono text-[10px] text-faint">
                      {badges[name]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            {tab === "preview" && filePaths.length > 0 && !previewError && (
              <button
                onClick={() => setSelectMode((current) => !current)}
                disabled={running}
                className={
                  selectMode
                    ? "shrink-0 rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-background disabled:opacity-50"
                    : "shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
                }
                title="Click an element in the app, then describe the change"
              >
                {selectMode ? "Click an element…" : "Select"}
              </button>
            )}

            {previewError && (
              <>
                <span
                  className="min-w-0 max-w-[420px] truncate text-xs text-bad"
                  title={previewError}
                >
                  {previewError}
                </span>
                {/* The automatic attempt is capped, so leave a manual way back. */}
                <button
                  onClick={() => submitManual(FIX_PROMPT(previewError))}
                  disabled={running}
                  className="shrink-0 rounded-lg border border-bad/40 px-2.5 py-1 text-xs text-bad transition-colors hover:bg-bad/10 disabled:opacity-50"
                >
                  Fix it
                </button>
              </>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden bg-surface">
            {tab === "preview" ? (
              <AppPreview
                projectId={projectId}
                files={files}
                onError={handlePreviewError}
                selectMode={selectMode}
                onPick={handlePick}
              />
            ) : tab === "data" ? (
              <DataView projectId={projectId} schema={schema} />
            ) : tab === "history" ? (
              <VersionHistory
                projectId={projectId}
                versions={versions}
                currentVersionId={currentVersionId}
                disabled={running}
                onRestored={(result) => {
                  setFiles(result.files);
                  setSchema(result.schema);
                  setVersions(result.versions);
                  setCurrentVersionId(result.currentVersionId);
                }}
              />
            ) : (
              <FilesPanel
                projectId={projectId}
                title={title}
                slug={slug}
                files={files}
                schema={schema}
                disabled={running}
                onSaved={(result) => {
                  setFiles(result.files);
                  setSchema(result.schema);
                  setVersions(result.versions);
                  setCurrentVersionId(result.currentVersionId);
                }}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
