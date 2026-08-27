"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-6 py-20">
      <h1 className="text-xl font-semibold">Something broke</h1>
      <p className="text-sm leading-relaxed text-muted">
        {/* The digest is all a production build exposes; without it a support
            conversation has nothing to go on. */}
        {error.message || "An unexpected error occurred."}
        {error.digest && (
          <span className="ml-1 font-mono text-xs text-muted">({error.digest})</span>
        )}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Back to Bench
        </Link>
      </div>
    </main>
  );
}
