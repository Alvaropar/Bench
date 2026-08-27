"use client";

import { useEffect, useState } from "react";
import type { AppSchema, Collection, Field } from "@/lib/types";

interface Row {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

/**
 * The generated app's data, shown as a table next to the app itself.
 *
 * This is what makes "the data is real" checkable at a glance: the same rows the
 * preview renders, straight from the records API, with the schema the agent
 * declared as the column headers.
 */
export function DataView({
  projectId,
  schema,
}: {
  projectId: string;
  schema: AppSchema;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Derived rather than synced with an effect: when the agent drops a
  // collection the selection falls back on its own, with no extra render pass.
  const active =
    selected && schema.collections.some((c) => c.name === selected)
      ? selected
      : (schema.collections[0]?.name ?? null);

  const collection: Collection | undefined = schema.collections.find(
    (candidate) => candidate.name === active,
  );

  useEffect(() => {
    if (!active) return;

    // Guards against a slow response for a collection the user already
    // switched away from overwriting the newer one.
    let cancelled = false;

    (async () => {
      try {
        const [rowsResponse, schemaResponse] = await Promise.all([
          fetch(`/api/apps/${projectId}/${encodeURIComponent(active)}`),
          fetch(`/api/apps/${projectId}/schema`),
        ]);
        const rowsBody = await rowsResponse.json();
        const schemaBody = await schemaResponse.json();
        if (cancelled) return;

        if (!rowsResponse.ok) {
          setError(rowsBody.error ?? "Could not load rows");
          setRows([]);
        } else {
          setRows(rowsBody.records ?? []);
          setCounts(schemaBody.recordCounts ?? {});
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load rows");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, active, reloadKey]);

  if (schema.collections.length === 0) {
    return (
      <div className="p-6 text-sm text-muted">
        No data model yet. The agent declares one on the first build.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        {schema.collections.map((candidate) => (
          <button
            key={candidate.name}
            onClick={() => {
              setSelected(candidate.name);
              setLoading(true);
            }}
            className={`rounded-md px-2.5 py-1 text-sm ${
              active === candidate.name
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {candidate.label}
            <span className="ml-1.5 font-mono text-[11px] text-muted">
              {counts[candidate.name] ?? 0}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => {
            setLoading(true);
            setReloadKey((key) => key + 1);
          }}
          disabled={loading}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && <p className="px-4 py-3 text-sm text-bad">{error}</p>}

      <div className="min-h-0 flex-1 overflow-auto">
        {!error && rows.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted">
            No rows yet. Add one in the preview and it will appear here.
          </p>
        ) : (
          collection && <Table collection={collection} rows={rows} />
        )}
      </div>
    </div>
  );
}

function Table({ collection, rows }: { collection: Collection; rows: Row[] }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead className="sticky top-0 bg-surface">
        <tr>
          {collection.fields.map((field) => (
            <th
              key={field.name}
              className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium text-muted"
            >
              {field.label}
              <span className="ml-1.5 font-mono text-[10px] opacity-60">{field.type}</span>
            </th>
          ))}
          <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium text-muted">
            created
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-surface-2">
            {collection.fields.map((field) => (
              <td
                key={field.name}
                className="max-w-[280px] truncate border-b border-border px-3 py-2"
                title={format(row[field.name], field)}
              >
                {format(row[field.name], field)}
              </td>
            ))}
            <td className="whitespace-nowrap border-b border-border px-3 py-2 text-muted">
              {new Date(row.createdAt).toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function format(value: unknown, field: Field): string {
  if (value === null || value === undefined) return "—";
  if (field.type === "boolean") return value ? "yes" : "no";
  if (field.type === "number") return Number(value).toLocaleString();
  if (field.type === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  return String(value);
}
