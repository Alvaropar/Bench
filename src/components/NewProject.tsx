"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Verified starter prompts.
 *
 * Reviewers try the first thing they see, so the first thing they see should be
 * something known to produce a good app. All four describe tools whose data the
 * user enters — nothing here needs a live feed from the outside world.
 */
const STARTERS = [
  {
    prompt: "A CRM for a small sales team",
    title: "Sales CRM",
    detail: "Pipeline stages, deal values, owners",
  },
  {
    prompt: "An applicant tracker for a hiring pipeline",
    title: "Applicant tracker",
    detail: "Candidates, stages, interview notes",
  },
  {
    prompt: "A bug log for a small product team",
    title: "Bug log",
    detail: "Severity, status, assignee",
  },
  {
    prompt: "A team expense tracker with categories and approval status",
    title: "Expense tracker",
    detail: "Categories, amounts, approvals",
  },
];

function titleFrom(prompt: string): string {
  const cleaned = prompt.trim().replace(/^(build|create|make)\s+(me\s+)?(a|an)\s+/i, "");
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return title.length > 60 ? `${title.slice(0, 57)}…` : title;
}

export function NewProject() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(text: string) {
    if (!text.trim() || creating) return;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleFrom(text) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not create the project");

      // The prompt rides along so the workspace can start building on arrival
      // instead of making the user type it a second time.
      router.push(`/projects/${body.project.id}?prompt=${encodeURIComponent(text.trim())}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the project");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create(prompt);
        }}
        className="group relative rounded-2xl border border-border bg-surface transition-colors focus-within:border-border-strong"
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              create(prompt);
            }
          }}
          rows={3}
          disabled={creating}
          autoFocus
          placeholder="Describe the tool your team needs…"
          className="w-full resize-none rounded-2xl bg-transparent px-4 pt-4 pb-14 text-[15px] leading-relaxed outline-none placeholder:text-faint disabled:opacity-60"
        />

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
          <span className="text-[11px] text-faint">
            Enter to build · Shift+Enter for a new line
          </span>
          <button
            type="submit"
            disabled={creating || !prompt.trim()}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-medium text-background transition-opacity hover:bg-accent-strong disabled:opacity-30"
          >
            {creating ? "Creating…" : "Build it"}
          </button>
        </div>
      </form>

      {error && (
        <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div>
        <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">
          Or start from one of these
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {STARTERS.map((starter) => (
            <button
              key={starter.prompt}
              onClick={() => create(starter.prompt)}
              disabled={creating}
              className="group rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-2 disabled:opacity-40"
            >
              <span className="block text-sm font-medium transition-colors group-hover:text-accent">
                {starter.title}
              </span>
              <span className="mt-0.5 block text-[12px] text-muted">{starter.detail}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
