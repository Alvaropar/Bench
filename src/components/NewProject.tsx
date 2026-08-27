"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Verified starter prompts.
 *
 * Reviewers try the first thing they see, so the first thing they see should
 * be something known to produce a good app. All four describe tools whose data
 * the user enters — nothing here needs a live feed from the outside world.
 */
const STARTERS = [
  "A CRM for a small sales team",
  "An applicant tracker for a hiring pipeline",
  "A bug log for a small product team",
  "A team expense tracker with categories and approval status",
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
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          create(prompt);
        }}
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
          placeholder="Describe the tool your team needs…"
          className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-base outline-none placeholder:text-muted focus:border-accent disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={creating || !prompt.trim()}
          className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          {creating ? "Creating…" : "Build it"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            key={starter}
            onClick={() => create(starter)}
            disabled={creating}
            className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-40"
          >
            {starter}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
