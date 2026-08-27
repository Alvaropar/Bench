import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, versions } from "@/db/schema";
import type { Project, Version } from "@/db/schema";
import { forbidden, notFound } from "@/lib/errors";
import { slugify } from "@/lib/ids";
import { EMPTY_SCHEMA, type AppSchema, type FileMap } from "@/lib/types";

export async function createProject(input: {
  title: string;
  sessionId: string;
}): Promise<{ project: Project; version: Version }> {
  const db = getDb();

  const [project] = await db
    .insert(projects)
    .values({
      slug: slugify(input.title),
      title: input.title,
      sessionId: input.sessionId,
    })
    .returning();

  // Every project starts with an empty version so `currentVersionId` is never
  // null downstream. Saves a nullable branch in every consumer.
  const [version] = await db
    .insert(versions)
    .values({
      projectId: project.id,
      label: "empty",
      files: {},
      appSchema: EMPTY_SCHEMA,
    })
    .returning();

  const [updated] = await db
    .update(projects)
    .set({ currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(projects.id, project.id))
    .returning();

  return { project: updated, version };
}

export async function listProjects(sessionId: string): Promise<Project[]> {
  return getDb()
    .select()
    .from(projects)
    .where(eq(projects.sessionId, sessionId))
    .orderBy(desc(projects.updatedAt));
}

export async function getProject(projectId: string): Promise<Project | undefined> {
  const [project] = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return project;
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const [project] = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return project;
}

export async function getVersion(versionId: string): Promise<Version | undefined> {
  const [version] = await getDb()
    .select()
    .from(versions)
    .where(eq(versions.id, versionId))
    .limit(1);
  return version;
}

export async function getCurrentVersion(project: Project): Promise<Version | undefined> {
  if (!project.currentVersionId) return undefined;
  return getVersion(project.currentVersionId);
}

export async function listVersions(projectId: string): Promise<Version[]> {
  return getDb()
    .select()
    .from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.createdAt));
}

/** Appends a version and points the project at it. */
export async function commitVersion(input: {
  projectId: string;
  parentId: string | null;
  files: FileMap;
  appSchema: AppSchema;
  label?: string;
}): Promise<Version> {
  const db = getDb();

  const [version] = await db
    .insert(versions)
    .values({
      projectId: input.projectId,
      parentId: input.parentId,
      files: input.files,
      appSchema: input.appSchema,
      label: input.label ?? null,
    })
    .returning();

  await db
    .update(projects)
    .set({ currentVersionId: version.id, updatedAt: new Date() })
    .where(eq(projects.id, input.projectId));

  return version;
}

export type Access = "read" | "write";

/**
 * Published apps are readable and writable by anyone — that IS the product:
 * you send a teammate a link and they add a row you can see. Unpublished
 * projects stay scoped to the session that created them.
 */
export async function authorizeProject(
  projectId: string,
  sessionId: string,
  _access: Access = "write",
): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw notFound("Project not found");
  if (project.published) return project;
  if (project.sessionId !== sessionId) throw forbidden();
  return project;
}

export async function setPublished(
  projectId: string,
  published: boolean,
): Promise<Project> {
  const [project] = await getDb()
    .update(projects)
    .set({ published, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  return project;
}

export async function ownedProject(
  projectId: string,
  sessionId: string,
): Promise<Project> {
  const [project] = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.sessionId, sessionId)))
    .limit(1);
  if (!project) throw notFound("Project not found");
  return project;
}
