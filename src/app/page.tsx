import Link from "next/link";
import { NewProject } from "@/components/NewProject";
import { runHealthChecks } from "@/lib/health";
import { listProjects } from "@/lib/projects";
import { getSessionId } from "@/lib/session";
import type { Project } from "@/db/schema";

export const dynamic = "force-dynamic";

async function loadProjects(): Promise<Project[]> {
  // A misconfigured deployment should still render the page that explains the
  // misconfiguration, rather than falling over on the project list.
  try {
    return await listProjects(await getSessionId());
  } catch {
    return [];
  }
}

export default async function Home() {
  const [checks, projects] = await Promise.all([runHealthChecks(), loadProjects()]);
  const broken = checks.filter((check) => !check.ok);
  const provider = checks.find((check) => check.name === "Model provider");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">Bench</span>
        {provider?.ok && (
          <span className="flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
            <span className="size-1.5 rounded-full bg-ok" />
            {provider.detail}
          </span>
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
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-faint">
              Your apps
            </h2>
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
