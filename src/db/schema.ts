import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AppSchema, FileMap, ToolEvent } from "@/lib/types";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  /** anonymous owner: a signed cookie, no auth flow needed for the demo */
  sessionId: text("session_id").notNull(),
  published: boolean("published").notNull().default(false),
  /**
   * Deliberately NOT a foreign key: projects <-> versions would be a circular
   * reference and force a two-step migration for no real benefit.
   */
  currentVersionId: uuid("current_version_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const versions = pgTable(
  "versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** fork lineage; null for the first version */
    parentId: uuid("parent_id"),
    label: text("label"),
    files: jsonb("files").$type<FileMap>().notNull(),
    appSchema: jsonb("app_schema").$type<AppSchema>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("versions_project_idx").on(t.projectId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull().default(""),
    toolEvents: jsonb("tool_events").$type<ToolEvent[]>(),
    /** the version this turn produced, if any */
    versionId: uuid("version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("messages_project_idx").on(t.projectId, t.createdAt)],
);

/**
 * Data belonging to *generated* apps.
 *
 * Scoped to the project, not the version, so the user's data survives every
 * time the agent rewrites the UI.
 */
export const records = pgTable(
  "records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    collection: text("collection").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("records_scope_idx").on(t.projectId, t.collection, t.createdAt)],
);

export type Project = typeof projects.$inferSelect;
export type Version = typeof versions.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type RecordRow = typeof records.$inferSelect;
