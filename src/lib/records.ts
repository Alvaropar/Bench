import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/db/schema";
import { notFound, unprocessable } from "@/lib/http";
import { collectionValidator, findCollection, formatIssues } from "@/lib/schema-validation";
import type { AppSchema } from "@/lib/types";

/** What generated apps actually see. `data` is flattened alongside the id. */
export interface PublicRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export function toPublicRecord(row: RecordRow): PublicRecord {
  return {
    ...row.data,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const MAX_LIMIT = 500;

function validateAgainstSchema(
  schema: AppSchema,
  collection: string,
  data: unknown,
  { partial }: { partial: boolean },
): Record<string, unknown> {
  const declared = findCollection(schema, collection);
  if (!declared) {
    const known = schema.collections.map((c) => c.name).join(", ") || "(none declared yet)";
    throw notFound(`Unknown collection "${collection}". Declared collections: ${known}`);
  }

  const validator = collectionValidator(declared);
  const result = (partial ? validator.partial() : validator).safeParse(data);
  if (!result.success) {
    throw unprocessable(
      `Invalid data for collection "${collection}"`,
      formatIssues(result.error),
    );
  }
  return result.data as Record<string, unknown>;
}

export async function listRecords(input: {
  projectId: string;
  collection: string;
  limit?: number;
  order?: "asc" | "desc";
}): Promise<PublicRecord[]> {
  const limit = Math.min(Math.max(input.limit ?? 200, 1), MAX_LIMIT);
  const direction = input.order === "asc" ? asc : desc;

  const rows = await getDb()
    .select()
    .from(records)
    .where(
      and(eq(records.projectId, input.projectId), eq(records.collection, input.collection)),
    )
    .orderBy(direction(records.createdAt))
    .limit(limit);

  return rows.map(toPublicRecord);
}

export async function createRecord(input: {
  projectId: string;
  collection: string;
  schema: AppSchema;
  data: unknown;
}): Promise<PublicRecord> {
  const data = validateAgainstSchema(input.schema, input.collection, input.data, {
    partial: false,
  });

  const [row] = await getDb()
    .insert(records)
    .values({ projectId: input.projectId, collection: input.collection, data })
    .returning();

  return toPublicRecord(row);
}

export async function updateRecord(input: {
  projectId: string;
  collection: string;
  recordId: string;
  schema: AppSchema;
  data: unknown;
}): Promise<PublicRecord> {
  const patch = validateAgainstSchema(input.schema, input.collection, input.data, {
    partial: true,
  });

  const db = getDb();
  const [existing] = await db
    .select()
    .from(records)
    .where(and(eq(records.id, input.recordId), eq(records.projectId, input.projectId)))
    .limit(1);

  if (!existing) throw notFound("Record not found");

  const [row] = await db
    .update(records)
    .set({ data: { ...existing.data, ...patch }, updatedAt: new Date() })
    .where(eq(records.id, input.recordId))
    .returning();

  return toPublicRecord(row);
}

export async function deleteRecord(input: {
  projectId: string;
  recordId: string;
}): Promise<void> {
  const [row] = await getDb()
    .delete(records)
    .where(and(eq(records.id, input.recordId), eq(records.projectId, input.projectId)))
    .returning();
  if (!row) throw notFound("Record not found");
}

/** Bulk insert used by the agent's `seed_data` tool. */
export async function seedRecords(input: {
  projectId: string;
  collection: string;
  schema: AppSchema;
  rows: unknown[];
}): Promise<number> {
  if (input.rows.length === 0) return 0;
  if (input.rows.length > 50) throw unprocessable("Cannot seed more than 50 rows at once");

  const values = input.rows.map((row) => ({
    projectId: input.projectId,
    collection: input.collection,
    data: validateAgainstSchema(input.schema, input.collection, row, { partial: false }),
  }));

  const inserted = await getDb().insert(records).values(values).returning();
  return inserted.length;
}

/** Row counts per collection, for the built-in data view. */
export async function countByCollection(
  projectId: string,
): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ collection: records.collection })
    .from(records)
    .where(eq(records.projectId, projectId));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.collection] = (counts[row.collection] ?? 0) + 1;
  }
  return counts;
}
