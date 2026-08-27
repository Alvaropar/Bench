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
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <h1 className="truncate text-sm font-medium">{title}</h1>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] text-ok">
          <span className="size-1.5 rounded-full bg-ok" />
          <span className="hidden sm:inline">Live — everyone with this link shares the same data</span>
          <span className="sm:hidden">Live</span>
        </span>
        <div className="flex-1" />
        {error && (
          <span className="truncate text-xs text-bad" title={error}>
            {error}
          </span>
        )}
        <Link href="/" className="shrink-0 text-xs text-faint transition-colors hover:text-foreground">
          Built with Bench
        </Link>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden bg-surface">
        <AppPreview projectId={projectId} files={files} onError={setError} />
      </div>
    </div>
  );
}
