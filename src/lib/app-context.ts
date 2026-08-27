import { notFound } from "@/lib/http";
import { authorizeProject, getCurrentVersion } from "@/lib/projects";
import type { Project } from "@/db/schema";
import type { AppSchema } from "@/lib/types";

/**
 * Resolves the schema a generated app's data must satisfy: the AppSchema of
 * the project's *current* version. Records live on the project, so a rewrite
 * changes the validator without touching a single stored row.
 */
export async function resolveApp(
  projectId: string,
  sessionId: string,
): Promise<{ project: Project; schema: AppSchema }> {
  const project = await authorizeProject(projectId, sessionId);
  const version = await getCurrentVersion(project);
  if (!version) throw notFound("Project has no version yet");
  return { project, schema: version.appSchema };
}
