import { runHealthChecks } from "@/lib/health";

export const dynamic = "force-dynamic";

const ROADMAP = [
  { phase: "0", label: "Deploy spine — Next.js + Neon + schema", done: true },
  { phase: "1", label: "Projects, messages, records API", done: false },
  { phase: "2", label: "Agent loop with tool use", done: false },
  { phase: "3", label: "Live preview + injected db SDK", done: false },
  { phase: "4", label: "Publish, shared data, version history", done: false },
];

export default async function Home() {
  const checks = await runHealthChecks();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-accent" />
          Phase 0 · deploy spine
        </div>
        <h1 className="text-4xl font-semibold tracking-tight">Bench</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">
          Describe an internal tool. An agent designs the data model, generates the
          UI, and hands you a link your team can actually use — where the data
          persists and everyone sees the same rows.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-medium text-muted">System status</h2>
        <ul className="space-y-2.5">
          {checks.map((check) => (
            <li key={check.name} className="flex items-baseline gap-3 text-sm">
              <span
                className={`size-2 shrink-0 translate-y-[3px] rounded-full ${
                  check.ok ? "bg-ok" : "bg-bad"
                }`}
              />
              <span className="w-40 shrink-0">{check.name}</span>
              <span className="font-mono text-xs text-muted">
                {check.ok ? "ok" : (check.detail ?? "failing")}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-medium text-muted">Build order</h2>
        <ol className="space-y-2.5">
          {ROADMAP.map((item) => (
            <li key={item.phase} className="flex items-baseline gap-3 text-sm">
              <span className="font-mono text-xs text-muted">{item.phase}</span>
              <span className={item.done ? "text-foreground" : "text-muted"}>
                {item.label}
              </span>
              {item.done && <span className="text-xs text-ok">done</span>}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
