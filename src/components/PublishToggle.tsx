"use client";

import { useCallback, useState } from "react";

/**
 * Publishing is what makes a generated app real: the link opens the app for
 * anyone, and everyone who opens it reads and writes the same rows.
 */
export function PublishToggle({
  projectId,
  slug,
  initialPublished,
}: {
  projectId: string;
  slug: string;
  initialPublished: boolean;
}) {
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = `/p/${slug}`;

  const toggle = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not update");
      setPublished(body.project.published);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }, [projectId, published]);

  const copy = useCallback(async () => {
    // Read the origin at click time: rendering it would differ between server
    // and client and trip a hydration mismatch.
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }, [path]);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-bad">{error}</span>}

      {published && (
        <>
          <a
            href={path}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[11px] text-muted hover:text-foreground"
            title="Open the published app"
          >
            {path}
          </a>
          <button
            onClick={copy}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </>
      )}

      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
          published
            ? "border border-border text-muted hover:text-foreground"
            : "bg-accent text-background"
        }`}
      >
        {busy ? "…" : published ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
