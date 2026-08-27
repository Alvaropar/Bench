"use client";

import { useState } from "react";
import type { VersionSummary } from "@/lib/projects";
import type { AppSchema, FileMap } from "@/lib/types";

/**
 * Every generation is a checkpoint, and restoring appends rather than rewinds.
 *
 * That is the property worth having: you can try a risky change, restore, and
 * still reach the risky version afterwards. Records are never touched, so the
 * data survives whichever version is current.
 */
export function VersionHistory({
  projectId,
  versions,
  currentVersionId,
  onRestored,
  disabled,
}: {
  projectId: string;
  versions: VersionSummary[];
  currentVersionId: string | null;
  onRestored: (result: {
    files: FileMap;
    schema: AppSchema;
    versions: VersionSummary[];
    currentVersionId: string;
  }) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore(versionId: string) {
    setBusy(versionId);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not restore");

      onRestored({
        files: result.files,
        schema: result.schema,
        versions: result.versions,
        currentVersionId: result.version.id,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore");
    } finally {
      setBusy(null);
    }
  }

  const real = versions.filter((version) => version.fileCount > 0);

  if (real.length === 0) {
    return (
      <div className="p-6 text-sm text-muted">
        No versions yet. Every build the agent completes becomes a checkpoint here.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {error && <p className="mb-3 text-sm text-bad">{error}</p>}

      <ol className="space-y-2">
        {real.map((version) => {
          const current = version.id === currentVersionId;
          return (
            <li
              key={version.id}
              className={`rounded-lg border px-3 py-2.5 ${
                current ? "border-accent/50 bg-surface-2" : "border-border"
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm" title={version.label ?? ""}>
                  {version.label || "Untitled change"}
                </span>
                {current ? (
                  <span className="shrink-0 text-[11px] text-accent">current</span>
                ) : (
                  <button
                    onClick={() => restore(version.id)}
                    disabled={disabled || busy !== null}
                    className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted hover:text-foreground disabled:opacity-40"
                  >
                    {busy === version.id ? "Restoring…" : "Restore"}
                  </button>
                )}
              </div>
              <div className="mt-1 flex gap-3 font-mono text-[11px] text-muted">
                <span>{new Date(version.createdAt).toLocaleString()}</span>
                <span>
                  {version.fileCount} {version.fileCount === 1 ? "file" : "files"}
                </span>
                {version.collections.length > 0 && (
                  <span className="truncate">{version.collections.join(", ")}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
