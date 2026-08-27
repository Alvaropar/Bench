import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublishedApp } from "@/components/PublishedApp";
import { getCurrentVersion, getProjectBySlug } from "@/lib/projects";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug).catch(() => undefined);
  if (!project?.published) return { title: "Not found" };
  return {
    title: project.title,
    description: `${project.title} — a working tool built with Bench.`,
  };
}

/**
 * The public face of a generated app.
 *
 * No chat, no file list, no session requirement: anyone with the link gets the
 * app itself, reading and writing the same rows as everyone else.
 */
export default async function PublishedPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

  // An unpublished project is not merely forbidden here, it is invisible —
  // there is no reason to confirm the slug exists.
  if (!project || !project.published) notFound();

  const version = await getCurrentVersion(project);
  if (!version || Object.keys(version.files).length === 0) notFound();

  return (
    <PublishedApp
      projectId={project.id}
      title={project.title}
      files={version.files}
    />
  );
}
