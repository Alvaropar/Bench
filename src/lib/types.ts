/**
 * The runtime contract between the agent and generated apps.
 *
 * The agent never writes SQL or invents a data layer. It declares an AppSchema
 * (via the `set_schema` tool) and writes UI that talks to the injected `db`
 * client. Everything lands in the shared `records` table, scoped by project.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "boolean"
  | "date"
  | "select"
  | "url"
  | "email";

export interface Field {
  /** camelCase key used in `record.data` */
  name: string;
  /** Human label for generated UI */
  label: string;
  type: FieldType;
  required?: boolean;
  /** Only for type: "select" */
  options?: string[];
  defaultValue?: string | number | boolean | null;
}

export interface Collection {
  /** camelCase plural, e.g. "customers" */
  name: string;
  label: string;
  fields: Field[];
}

export interface AppSchema {
  collections: Collection[];
}

export const EMPTY_SCHEMA: AppSchema = { collections: [] };

/** path -> file contents */
export type FileMap = Record<string, string>;

export type ToolEvent =
  | { kind: "plan"; text: string }
  | { kind: "set_schema"; collections: string[] }
  | { kind: "write_file"; path: string; bytes: number }
  | { kind: "edit_file"; path: string }
  | { kind: "delete_file"; path: string }
  | { kind: "seed_data"; collection: string; count: number }
  | { kind: "error"; message: string }
  | { kind: "done"; summary: string };
