import { z } from "zod";
import type { AppSchema, Collection, Field } from "@/lib/types";

/**
 * Turns an agent-declared AppSchema into a runtime validator.
 *
 * This is why the agent never writes SQL: it declares fields as *data*, and the
 * server derives both storage shape and validation from that declaration. No
 * model-authored DDL, no migration at request time, no injection surface.
 */

const ISO_DATE = z.union([z.iso.date(), z.iso.datetime()]);

function fieldBase(field: Field): z.ZodType {
  switch (field.type) {
    case "text":
      return z.string().max(2_000);
    case "longtext":
      return z.string().max(20_000);
    case "number":
      // Coerced: HTML number inputs hand back strings, and having the agent
      // remember to parse them every time is a reliability tax we can just pay
      // once here.
      return z.coerce.number().finite();
    case "boolean":
      // NOT coerced — z.coerce.boolean() turns the string "false" into true,
      // which is a silent data-corruption bug waiting to happen.
      return z.boolean();
    case "date":
      return ISO_DATE;
    case "select":
      return field.options?.length
        ? z.enum(field.options as [string, ...string[]])
        : z.string().max(2_000);
    case "url":
      return z.url();
    case "email":
      return z.email();
  }
}

export function collectionValidator(collection: Collection) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of collection.fields) {
    const base = fieldBase(field);
    shape[field.name] = field.required ? base : base.nullable().optional();
  }
  // strictObject, not strip: an unknown key means the generated UI and the
  // declared schema have drifted. Surfacing that as a 422 gives the self-healing
  // loop something actionable instead of silently dropping the user's data.
  return z.strictObject(shape);
}

export function findCollection(schema: AppSchema, name: string): Collection | undefined {
  return schema.collections.find((c) => c.name === name);
}

/** Flat, agent-readable issue strings: `fieldName: message`. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `${path}: ${issue.message}`;
  });
}

/** The AppSchema itself needs validating too — it arrives from a tool call. */
export const fieldSchema: z.ZodType<Field> = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Field names must be camelCase and start with a letter"),
  label: z.string().min(1).max(80),
  type: z.enum(["text", "longtext", "number", "boolean", "date", "select", "url", "email"]),
  required: z.boolean().optional(),
  options: z.array(z.string().min(1)).max(40).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});

export const collectionSchema: z.ZodType<Collection> = z.strictObject({
  name: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]*$/, "Collection names must be camelCase and start with a letter"),
  label: z.string().min(1).max(80),
  fields: z.array(fieldSchema).min(1).max(24),
});

export const appSchemaSchema: z.ZodType<AppSchema> = z.strictObject({
  collections: z.array(collectionSchema).max(8),
});
