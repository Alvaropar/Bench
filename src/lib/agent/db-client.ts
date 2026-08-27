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
import { BENCH_ORIGIN } from "./config";

export interface BenchRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

type Op = "list" | "create" | "update" | "remove" | "upload";

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

export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  bytes: number;
}

/** Public URL for an uploaded file. Safe to use directly as an <img src>. */
export function assetUrl(id: string | null | undefined): string {
  return id ? BENCH_ORIGIN + "/api/assets/" + id : "";
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => {
      const result = String(reader.result);
      // Strip the "data:<mime>;base64," prefix the API does not want.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads a file and returns its id. Store the id in a field declared as
 * "file" (or "image"), never the bytes.
 */
export async function uploadFile(file: File): Promise<UploadedFile> {
  const base64 = await toBase64(file);
  return call("upload", {
    name: file.name,
    mime: file.type || "application/octet-stream",
    base64,
  }) as Promise<UploadedFile>;
}

/**
 * Uploads an image, downscaling it first.
 *
 * A photo straight off a phone is several times the upload limit, so resizing
 * in the browser is the difference between this working and failing on most
 * real files.
 */
export async function uploadImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<UploadedFile> {
  const { maxDimension = 1600, quality = 0.85 } = options;

  const shrunk = await new Promise<Blob | null>((resolve) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      if (scale === 1 && file.size < 1_000_000) return resolve(null);

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) return resolve(null);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    image.src = url;
  });

  if (!shrunk) return uploadFile(file);

  const base64 = await toBase64(shrunk);
  return call("upload", {
    name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    mime: "image/jpeg",
    base64,
  }) as Promise<UploadedFile>;
}
`.trimStart();
