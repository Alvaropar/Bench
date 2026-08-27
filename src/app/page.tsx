import Link from "next/link";
import { NewProject } from "@/components/NewProject";
import { runHealthChecks } from "@/lib/health";
import { listProjects } from "@/lib/projects";
import { getSessionId } from "@/lib/session";
import type { Project } from "@/db/schema";

export const dynamic = "force-dynamic";

async function loadProjects(): Promise<Project[]> {
  // A misconfigured deployment should still render the page it needs to show
  // the configuration error, rather than falling over on the project list.
  try {
    return await listProjects(await getSessionId());
  } catch {
    return [];
  }
}

export default async function Home() {
  const [checks, projects] = await Promise.all([runHealthChecks(), loadProjects()]);
  const broken = checks.filter((check) => !check.ok);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-6 py-20">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Bench</h1>
        <p className="text-lg leading-relaxed text-muted">
          Describe an internal tool. An agent designs the data model, builds the
          interface, and hands you a link your team can actually use — where the
          data persists and everyone sees the same rows.
        </p>
      </header>

      {broken.length > 0 && (
        <div className="rounded-lg border border-bad/40 bg-bad/10 p-4 text-sm">
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
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Your apps</h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm hover:bg-surface"
                >
                  <span className="truncate">{project.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {project.published ? "published" : "private"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
