"use client";

import { useMemo, useState } from "react";
import { buildProjectFiles, buildProjectZip } from "@/lib/export/project";
import type { AppSchema, FileMap } from "@/lib/types";

/**
 * The generated app's source, as a browsable tree.
 *
 * Two views, because they answer different questions: "what did the agent
 * write" is the short answer, and "what do I get if I download this" is the
 * whole runnable project around it.
 */

interface TreeNode {
  name: string;
  path: string;
  children?: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const path of paths.slice().sort()) {
    const segments = path.split("/");
    let level = root;
    let prefix = "";

    segments.forEach((segment, index) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      let node = level.find((candidate) => candidate.name === segment);

      if (!node) {
        node = isFile ? { name: segment, path: prefix } : { name: segment, path: prefix, children: [] };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    });
  }

  // Folders first, then files, each alphabetical.
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => {
        const aFolder = Boolean(a.children);
        const bFolder = Boolean(b.children);
        if (aFolder !== bFolder) return aFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => (node.children ? { ...node, children: sort(node.children) } : node));

  return sort(root);
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`size-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden
    >
      <path
        d="M6 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tree({
  nodes,
  selected,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selected: string | null;
  onSelect: (path: string) => void;
  depth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  return (
    <ul>
      {nodes.map((node) => {
        const isFolder = Boolean(node.children);
        const isOpen = !collapsed.has(node.path);

        return (
          <li key={node.path}>
            <button
              onClick={() => {
                if (!isFolder) return onSelect(node.path);
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(node.path)) next.delete(node.path);
                  else next.add(node.path);
                  return next;
                });
              }}
              style={{ paddingLeft: 8 + depth * 12 }}
              className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left font-mono text-[12px] transition-colors ${
                selected === node.path
                  ? "bg-surface-3 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {isFolder ? (
                <Chevron open={isOpen} />
              ) : (
                <span className="size-3 shrink-0" aria-hidden />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            {isFolder && isOpen && (
              <Tree
                nodes={node.children!}
                selected={selected}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FilesPanel({
  projectId,
  title,
  slug,
  files,
  schema,
}: {
  projectId: string;
  title: string;
  slug: string;
  files: FileMap;
  schema: AppSchema;
}) {
  const [view, setView] = useState<"generated" | "project">("generated");
  const [selected, setSelected] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window === "undefined" ? "" : window.location.origin;

  // The project view is built with empty data: it is a preview of the layout,
  // and the real rows are fetched only when a download is actually requested.
  const shown = useMemo(
    () =>
      view === "generated"
        ? files
        : buildProjectFiles({ title, slug, files, schema, data: {}, origin }),
    [view, files, title, slug, schema, origin],
  );

  // Derived together so the memo depends on `shown` alone rather than on a
  // recomputed array that changes identity on every render.
  const { paths, tree } = useMemo(() => {
    const list = Object.keys(shown);
    return { paths: list, tree: buildTree(list) };
  }, [shown]);

  const active = selected && shown[selected] !== undefined ? selected : (paths[0] ?? null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      // Fetch the live rows so the export carries real data, not an empty seed.
      const data: Record<string, unknown[]> = {};
      for (const collection of schema.collections) {
        const response = await fetch(
          `/api/apps/${projectId}/${encodeURIComponent(collection.name)}?limit=500`,
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Could not read the data");
        data[collection.name] = body.records ?? [];
      }

      const blob = buildProjectZip({ title, slug, files, schema, data, origin });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  if (paths.length === 0) {
    return <p className="p-6 text-sm text-muted">No files yet.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
          {(["generated", "project"] as const).map((name) => (
            <button
              key={name}
              onClick={() => {
                setView(name);
                setSelected(null);
              }}
              className={
                view === name
                  ? "rounded-[7px] bg-surface-3 px-2.5 py-1 text-[12px] capitalize text-foreground"
                  : "rounded-[7px] px-2.5 py-1 text-[12px] capitalize text-muted hover:text-foreground"
              }
            >
              {name === "generated" ? "Generated" : "Full project"}
            </button>
          ))}
        </div>

        <span className="font-mono text-[11px] text-faint">{paths.length} files</span>

        <div className="flex-1" />

        {error && (
          <span className="truncate text-xs text-bad" title={error}>
            {error}
          </span>
        )}

        <button
          onClick={download}
          disabled={downloading}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-50"
          title="Download a runnable Vite project with your data"
        >
          {downloading ? "Packaging…" : "Download .zip"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-56 shrink-0 overflow-y-auto border-r border-border py-2">
          <Tree nodes={tree} selected={active} onSelect={setSelected} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {active && (
            <>
              <div className="flex shrink-0 items-baseline gap-3 border-b border-border px-4 py-2">
                <span className="truncate font-mono text-[12px] text-foreground">{active}</span>
                <span className="shrink-0 font-mono text-[11px] text-faint">
                  {shown[active].split("\n").length} lines
                </span>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-muted">
                <code>{shown[active]}</code>
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
