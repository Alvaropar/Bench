"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Mode = "signin" | "register";

/**
 * Sign in or create an account.
 *
 * Registering is never a gate: you can build and publish an app without one.
 * What an account buys is reaching your apps from a second browser — and
 * whatever you built anonymously in this one is adopted into it on the way in.
 */
export function AuthForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Something went wrong");

      router.push("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "register" ? "Create an account" : "Sign in"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {mode === "register"
            ? "Apps you have already built in this browser will be moved to your account."
            : "Reach the apps you built on any browser."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-border-strong disabled:opacity-60"
            placeholder="you@company.com"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-border-strong disabled:opacity-60"
            placeholder={mode === "register" ? "At least 8 characters" : ""}
          />
        </label>

        {error && (
          <p className="rounded-lg border border-bad/30 bg-bad/[0.07] px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:opacity-30"
        >
          {busy ? "…" : mode === "register" ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {mode === "register" ? "Already have an account? " : "No account yet? "}
        <button
          onClick={() => {
            setMode(mode === "register" ? "signin" : "register");
            setError(null);
          }}
          className="text-accent hover:text-accent-strong"
        >
          {mode === "register" ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}
