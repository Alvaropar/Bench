import { notFound } from "next/navigation";
import { Workspace } from "@/components/Workspace";
import { listMessages } from "@/lib/messages";
import { getCurrentVersion, getProject, listVersionSummaries } from "@/lib/projects";
import { getSessionId } from "@/lib/session";
import { EMPTY_SCHEMA } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
  searchParams,
}: PageProps<"/projects/[projectId]">) {
  const { projectId } = await params;
  const { prompt } = await searchParams;

  const sessionId = await getSessionId();
  const project = await getProject(projectId);

  // Someone else's unpublished project is indistinguishable from one that does
  // not exist — no point confirming it is there.
  if (!project || (project.sessionId !== sessionId && !project.published)) {
    notFound();
  }

  const [version, history, versions] = await Promise.all([
    getCurrentVersion(project),
    listMessages(projectId),
    listVersionSummaries(projectId),
  ]);

  return (
    <Workspace
      projectId={project.id}
      title={project.title}
      slug={project.slug}
      published={project.published}
      initialFiles={version?.files ?? {}}
      initialSchema={version?.appSchema ?? EMPTY_SCHEMA}
      initialTurns={history.map((message) => ({
        role: message.role,
        content: message.content,
        events: message.toolEvents ?? undefined,
      }))}
      initialVersions={versions}
      initialCurrentVersionId={project.currentVersionId}
      initialPrompt={typeof prompt === "string" ? prompt : undefined}
    />
  );
}
