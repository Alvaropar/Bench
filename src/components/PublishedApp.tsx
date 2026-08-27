"use client";

import Link from "next/link";
import { useState } from "react";
import { AppPreview } from "@/components/AppPreview";
import type { FileMap } from "@/lib/types";

export function PublishedApp({
  projectId,
  title,
  files,
}: {
  projectId: string;
  title: string;
  files: FileMap;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-2.5">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
          <span className="size-1.5 rounded-full bg-ok" />
          Live — everyone with this link shares the same data
        </span>
        <div className="flex-1" />
        {error && (
          <span className="truncate text-xs text-bad" title={error}>
            {error}
          </span>
        )}
        <Link href="/" className="shrink-0 text-xs text-muted hover:text-foreground">
          Built with Bench
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden bg-surface">
        <AppPreview projectId={projectId} files={files} onError={setError} />
      </div>
    </div>
  );
}
