/**
 * Source of `bench/db.ts`, injected into every generated app.
 *
 * Single source of truth: the system prompt documents this exact API and the
 * preview runtime injects this exact file. If they drift, generated apps break
 * in ways the agent cannot see.
 *
 * Transport is postMessage to the parent frame rather than fetch, which keeps
 * the project's access token out of generated code and sidesteps CORS with the
 * sandbox origin entirely.
 */
export const DB_CLIENT_SOURCE = String.raw`
import { useCallback, useEffect, useRef, useState } from "react";

export interface BenchRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

type Op = "list" | "create" | "update" | "remove";

let sequence = 0;
const pending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (!message || message.__bench !== "response") return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error));
    else entry.resolve(message.result);
  });
}

function call(op: Op, payload: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ __bench: "request", id, op, payload }, "*");
    setTimeout(() => {
      if (pending.delete(id)) reject(new Error("Bench request timed out"));
    }, 15000);
  });
}

export interface ListOptions {
  limit?: number;
  order?: "asc" | "desc";
}

export function collection<T extends BenchRecord = BenchRecord>(name: string) {
  return {
    list: (options: ListOptions = {}) =>
      call("list", { collection: name, ...options }) as Promise<T[]>,
    create: (data: Partial<T>) =>
      call("create", { collection: name, data }) as Promise<T>,
    update: (id: string, data: Partial<T>) =>
      call("update", { collection: name, id, data }) as Promise<T>,
    remove: (id: string) =>
      call("remove", { collection: name, id }) as Promise<void>,
  };
}

export const db = { collection };

/**
 * Live view of a collection. Polls so two people with the same link see each
 * other's rows without any extra work in the generated app.
 */
export function useCollection<T extends BenchRecord = BenchRecord>(
  name: string,
  options: ListOptions & { pollMs?: number } = {},
) {
  const { pollMs = 4000, ...listOptions } = options;
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(listOptions);
  optionsRef.current = listOptions;

  const refresh = useCallback(async () => {
    try {
      const rows = await collection<T>(name).list(optionsRef.current);
      setRecords(rows);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  const create = useCallback(
    async (data: Partial<T>) => {
      const row = await collection<T>(name).create(data);
      setRecords((current) => [row, ...current]);
      return row;
    },
    [name],
  );

  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      const row = await collection<T>(name).update(id, data);
      setRecords((current) => current.map((r) => (r.id === id ? row : r)));
      return row;
    },
    [name],
  );

  const remove = useCallback(
    async (id: string) => {
      await collection<T>(name).remove(id);
      setRecords((current) => current.filter((r) => r.id !== id));
    },
    [name],
  );

  return { records, loading, error, refresh, create, update, remove };
}
`.trimStart();
