import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, versions } from "@/db/schema";
import type { Project, Version } from "@/db/schema";
import { ownedByViewer, ownsProject, type Viewer } from "@/lib/auth";
import { forbidden, notFound } from "@/lib/errors";
import { slugify } from "@/lib/ids";
import { EMPTY_SCHEMA, type AppSchema, type FileMap } from "@/lib/types";

export async function createProject(input: {
  title: string;
  viewer: Viewer;
}): Promise<{ project: Project; version: Version }> {
  const db = getDb();

  const [project] = await db
    .insert(projects)
    .values({
      slug: slugify(input.title),
      title: input.title,
      sessionId: input.viewer.sessionId,
      userId: input.viewer.user?.id ?? null,
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

export async function listProjects(viewer: Viewer): Promise<Project[]> {
  return getDb()
    .select()
    .from(projects)
    .where(ownedByViewer(viewer))
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

/**
 * Published apps are readable and writable by anyone — that IS the product:
 * you send a teammate a link and they add a row you can see. Unpublished
 * projects stay with their owner.
 *
 * Read and write are deliberately not distinguished: a published app whose rows
 * you could read but not add to would not be the product. If that ever changes,
 * the split belongs here.
 */
export async function authorizeProject(
  projectId: string,
  viewer: Viewer,
): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw notFound("Project not found");
  if (project.published) return project;
  if (!ownsProject(viewer, project)) throw forbidden();
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
  viewer: Viewer,
): Promise<Project> {
  const project = await getProject(projectId);
  // A project someone else owns is indistinguishable from one that is not
  // there: confirming it exists would leak the id space.
  if (!project || !ownsProject(viewer, project)) throw notFound("Project not found");
  return project;
}

/** Version metadata without the file bodies, which are large and rarely needed. */
export interface VersionSummary {
  id: string;
  parentId: string | null;
  label: string | null;
  createdAt: string;
  fileCount: number;
  collections: string[];
}

export function toVersionSummary(version: Version): VersionSummary {
  return {
    id: version.id,
    parentId: version.parentId,
    label: version.label,
    createdAt: version.createdAt.toISOString(),
    fileCount: Object.keys(version.files).length,
    collections: version.appSchema.collections.map((collection) => collection.name),
  };
}

export async function listVersionSummaries(projectId: string): Promise<VersionSummary[]> {
  return (await listVersions(projectId)).map(toVersionSummary);
}

/**
 * Restores an earlier version by appending a copy of it.
 *
 * History stays append-only: restoring never rewinds or discards anything, so
 * you can always get back to where you were. Records are untouched — they hang
 * off the project, not the version.
 */
export async function restoreVersion(
  projectId: string,
  versionId: string,
): Promise<Version> {
  const source = await getVersion(versionId);
  if (!source || source.projectId !== projectId) throw notFound("Version not found");

  return commitVersion({
    projectId,
    parentId: source.id,
    files: source.files,
    appSchema: source.appSchema,
    label: `Restored "${source.label ?? "an earlier version"}"`,
  });
}
