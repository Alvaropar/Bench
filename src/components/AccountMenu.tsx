"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="max-w-[180px] truncate text-[13px] text-muted" title={email}>
        {email}
      </span>
      <button
        onClick={signOut}
        disabled={busy}
        className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
      >
        {busy ? "…" : "Sign out"}
      </button>
    </div>
  );
}
