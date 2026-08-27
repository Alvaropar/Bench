import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { NewProject } from "@/components/NewProject";
import { runHealthChecks } from "@/lib/health";
import { listProjects } from "@/lib/projects";
import { getViewer } from "@/lib/auth";
import type { Project } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * A misconfigured deployment should still render the page that explains the
 * misconfiguration, rather than falling over on the project list.
 */
async function loadState() {
  try {
    const viewer = await getViewer();
    return { viewer, projects: await listProjects(viewer) };
  } catch {
    return { viewer: null, projects: [] as Project[] };
  }
}

export default async function Home() {
  const [checks, { viewer, projects }] = await Promise.all([runHealthChecks(), loadState()]);
  const broken = checks.filter((check) => !check.ok);
  const provider = checks.find((check) => check.name === "Model provider");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">Bench</span>
        {provider?.ok && (
          <span className="hidden items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted sm:flex">
            <span className="size-1.5 rounded-full bg-ok" />
            {provider.detail}
          </span>
        )}

        <div className="flex-1" />

        {viewer?.user ? (
          <AccountMenu email={viewer.user.email} />
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/signin" className="text-[13px] text-muted hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/signin?mode=register"
              className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
            >
              Create account
            </Link>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-9 px-6 py-12">
        <div className="space-y-3">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.02em]">
            Describe an internal tool.
            <br />
            <span className="text-muted">Get a working one.</span>
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            An agent designs the data model, builds the interface, and fills it with
            realistic rows. Publish it and your team gets a link where the data
            persists and everyone sees the same records.
          </p>
        </div>

        {broken.length > 0 && (
          <div className="rounded-xl border border-bad/30 bg-bad/[0.07] p-4 text-sm">
            <p className="mb-2 font-medium text-bad">Not fully configured</p>
            <ul className="space-y-1 text-muted">
              {broken.map((check) => (
                <li key={check.name}>
                  <span className="text-foreground">{check.name}</span> — {check.detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        <NewProject />

        {projects.length > 0 && (
          <section className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wider text-faint">
                Your apps
              </h2>
              {!viewer?.user && (
                <span className="text-[11px] text-faint">
                  Saved to this browser ·{" "}
                  <Link href="/signin?mode=register" className="text-accent hover:text-accent-strong">
                    create an account
                  </Link>{" "}
                  to keep them
                </span>
              )}
            </div>
            <ul className="space-y-1.5">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm">{project.title}</span>
                    {project.published && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-[11px] text-ok">
                        <span className="size-1.5 rounded-full bg-ok" />
                        Published
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-[11px] text-faint">
                      {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <footer className="px-6 py-5 text-[11px] text-faint">
        Generated apps run in a sandbox and store their data in Bench.
      </footer>
    </div>
  );
}
