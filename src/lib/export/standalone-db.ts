/**
 * `bench/db.ts` as shipped inside an exported project.
 *
 * The hosted version talks to Bench over postMessage. A downloaded project has
 * no parent frame and no credentials, so this implements the identical API on
 * localStorage, seeded with the rows the app had at export time. The app keeps
 * working, offline, with its data intact — it is simply no longer the same data
 * anyone else is looking at.
 *
 * Uploaded files stay readable: asset URLs are public capability ids, so an
 * absolute link back to Bench still resolves. New uploads are held as data URLs
 * in local storage instead, since uploading requires a project this copy is no
 * longer part of.
 */
export const STANDALONE_DB_SOURCE = String.raw`
import { useCallback, useEffect, useRef, useState } from "react";
import { BENCH_ORIGIN } from "./config";
import seed from "./seed.json";

export interface BenchRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

const STORAGE_KEY = "bench-standalone-data";

type Store = Record<string, BenchRecord[]>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // Corrupted storage should not brick the app; fall back to the seed.
  }
  const initial = seed as Store;
  save(initial);
  return initial;
}

function save(store: Store): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Over quota: keep working in memory for this session.
  }
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Notifies every mounted useCollection when the store changes. */
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((listener) => listener());
}

export interface ListOptions {
  limit?: number;
  order?: "asc" | "desc";
}

export function collection<T extends BenchRecord = BenchRecord>(name: string) {
  return {
    async list(options: ListOptions = {}): Promise<T[]> {
      const rows = ((load()[name] ?? []) as T[]).slice();
      rows.sort((a, b) =>
        options.order === "asc"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
      );
      return options.limit ? rows.slice(0, options.limit) : rows;
    },

    async create(data: Partial<T>): Promise<T> {
      const store = load();
      const now = new Date().toISOString();
      const row = { ...data, id: uid(), createdAt: now, updatedAt: now } as T;
      store[name] = [...(store[name] ?? []), row];
      save(store);
      emit();
      return row;
    },

    async update(id: string, data: Partial<T>): Promise<T> {
      const store = load();
      const rows = (store[name] ?? []) as T[];
      const index = rows.findIndex((row) => row.id === id);
      if (index === -1) throw new Error("Record not found");
      const updated = { ...rows[index], ...data, updatedAt: new Date().toISOString() } as T;
      rows[index] = updated;
      store[name] = rows;
      save(store);
      emit();
      return updated;
    },

    async remove(id: string): Promise<void> {
      const store = load();
      store[name] = ((store[name] ?? []) as T[]).filter((row) => row.id !== id);
      save(store);
      emit();
    },
  };
}

export const db = { collection };

export function useCollection<T extends BenchRecord = BenchRecord>(
  name: string,
  options: ListOptions & { pollMs?: number } = {},
) {
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const refresh = useCallback(async () => {
    try {
      setRecords(await collection<T>(name).list(optionsRef.current));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    refresh();
    // Local writes notify directly; there is no server to poll.
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  const create = useCallback(
    async (data: Partial<T>) => collection<T>(name).create(data),
    [name],
  );
  const update = useCallback(
    async (id: string, data: Partial<T>) => collection<T>(name).update(id, data),
    [name],
  );
  const remove = useCallback(async (id: string) => collection<T>(name).remove(id), [name]);

  return { records, loading, error, refresh, create, update, remove };
}

export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  bytes: number;
}

const LOCAL_ASSET_PREFIX = "local:";

/**
 * Files uploaded before export still live on Bench and are public, so their
 * ids resolve to an absolute URL. Anything uploaded in this copy is a data URL
 * held in local storage.
 */
export function assetUrl(id: string | null | undefined): string {
  if (!id) return "";
  if (id.startsWith(LOCAL_ASSET_PREFIX)) {
    try {
      return window.localStorage.getItem(id) ?? "";
    } catch {
      return "";
    }
  }
  return BENCH_ORIGIN + "/api/assets/" + id;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function storeLocally(file: Blob, name: string, mime: string): Promise<UploadedFile> {
  const id = LOCAL_ASSET_PREFIX + uid();
  const dataUrl = await readAsDataUrl(file);
  try {
    window.localStorage.setItem(id, dataUrl);
  } catch {
    throw new Error("This file is too large to store locally");
  }
  return { id, name, mime, bytes: file.size };
}

export async function uploadFile(file: File): Promise<UploadedFile> {
  return storeLocally(file, file.name, file.type || "application/octet-stream");
}

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

  const blob = shrunk ?? file;
  return storeLocally(blob, file.name.replace(/\.[^.]+$/, "") + ".jpg", "image/jpeg");
}
`.trimStart();
