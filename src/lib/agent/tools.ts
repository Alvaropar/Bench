import { z } from "zod";
import { MAX_FILE_BYTES, MAX_FILES, validatePath } from "@/lib/agent/contract";
import {
  appSchemaSchema,
  collectionValidator,
  findCollection,
  formatIssues,
} from "@/lib/schema-validation";
import type { ToolSpec } from "@/lib/agent/providers/types";
import type { AppSchema, FileMap, ToolEvent } from "@/lib/types";

/**
 * Tool definitions, in a provider-neutral shape.
 *
 * Each provider maps `parameters` onto its own wire format — `input_schema` for
 * Anthropic, `function.parameters` for OpenAI-compatible endpoints like Kimi.
 *
 * Deliberately not using strict/structured tool schemas: seed_data's rows are
 * free-form by nature (their shape comes from the schema the agent just
 * declared), which a closed JSON Schema cannot express. Every input is
 * validated with zod instead — and those messages are better than a schema
 * rejection, because they name the offending field and go straight back to the
 * model as the correction signal.
 */
export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "set_schema",
    description:
      "Declare the app's data model. Must be called before any data can be stored. " +
      "Calling it again replaces the entire schema; existing rows are left untouched.",
    parameters: {
      type: "object",
      properties: {
        collections: {
          type: "array",
          description: "One entry per kind of thing the app stores.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: 'camelCase plural, e.g. "customers".',
              },
              label: { type: "string", description: 'Human label, e.g. "Customers".' },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "camelCase key." },
                    label: { type: "string" },
                    type: {
                      type: "string",
                      enum: [
                        "text",
                        "longtext",
                        "richtext",
                        "number",
                        "boolean",
                        "date",
                        "select",
                        "url",
                        "email",
                        "image",
                        "file",
                      ],
                    },
                    required: { type: "boolean" },
                    options: {
                      type: "array",
                      items: { type: "string" },
                      description: 'Required for type "select"; the only accepted values.',
                    },
                  },
                  required: ["name", "label", "type"],
                },
              },
            },
            required: ["name", "label", "fields"],
          },
        },
      },
      required: ["collections"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a file or replace its entire contents. Use edit_file for a targeted change to a file that already exists.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: 'Relative path, e.g. "App.tsx" or "components/CustomerForm.tsx".',
        },
        content: { type: "string", description: "The complete file contents." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace one exact occurrence of a string in an existing file. old_string must appear exactly once.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_string: {
          type: "string",
          description: "Exact text to replace, including indentation. Must be unique in the file.",
        },
        new_string: { type: "string", description: "Replacement text." },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "delete_file",
    description: "Remove a file that is no longer needed.",
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
    },
  },
  {
    name: "seed_data",
    description:
      "Insert realistic starter rows into a collection so the app does not open empty. " +
      "Each row is an object whose keys are the declared field names.",
    parameters: {
      type: "object",
      properties: {
        collection: { type: "string" },
        rows: {
          type: "array",
          description: "6-10 rows of plausible domain data.",
          items: { type: "object" },
        },
      },
      required: ["collection", "rows"],
    },
  },
];

export interface AgentState {
  files: FileMap;
  schema: AppSchema;
  /**
   * Seeds are validated immediately (so mistakes reach the model while it can
   * still fix them) but held until the version commits, so a run that fails
   * halfway does not leave rows behind for an app that was never saved.
   */
  pendingSeeds: { collection: string; rows: Record<string, unknown>[] }[];
}

export interface ToolOutcome {
  /** Text returned to the model as the tool_result. */
  result: string;
  isError?: boolean;
  /** Timeline entry for the UI. Omitted when nothing user-visible happened. */
  event?: ToolEvent;
}

const writeFileInput = z.object({ path: z.string(), content: z.string() });
const editFileInput = z.object({
  path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
});
const deleteFileInput = z.object({ path: z.string() });
const seedDataInput = z.object({
  collection: z.string(),
  rows: z.array(z.record(z.string(), z.unknown())),
});

function failure(message: string): ToolOutcome {
  return { result: message, isError: true, event: { kind: "error", message } };
}

function invalidInput(tool: string, error: z.ZodError): ToolOutcome {
  return failure(`Invalid input for ${tool}: ${formatIssues(error).join("; ")}`);
}

export function executeTool(
  state: AgentState,
  name: string,
  rawInput: unknown,
): ToolOutcome {
  switch (name) {
    case "set_schema":
      return setSchema(state, rawInput);
    case "write_file":
      return writeFile(state, rawInput);
    case "edit_file":
      return editFile(state, rawInput);
    case "delete_file":
      return deleteFile(state, rawInput);
    case "seed_data":
      return seedData(state, rawInput);
    default:
      return failure(`Unknown tool "${name}".`);
  }
}

function setSchema(state: AgentState, rawInput: unknown): ToolOutcome {
  const parsed = appSchemaSchema.safeParse(rawInput);
  if (!parsed.success) return invalidInput("set_schema", parsed.error);

  const names = parsed.data.collections.map((collection) => collection.name);
  if (new Set(names).size !== names.length) {
    return failure("Collection names must be unique.");
  }

  for (const collection of parsed.data.collections) {
    const fieldNames = collection.fields.map((field) => field.name);
    if (new Set(fieldNames).size !== fieldNames.length) {
      return failure(`Field names within "${collection.name}" must be unique.`);
    }
    for (const field of collection.fields) {
      if (field.type === "select" && !field.options?.length) {
        return failure(
          `Field "${collection.name}.${field.name}" is a select and must list its options.`,
        );
      }
    }
  }

  state.schema = parsed.data;
  return {
    result: `Schema set. Collections: ${names.join(", ")}.`,
    event: { kind: "set_schema", collections: names },
  };
}

function writeFile(state: AgentState, rawInput: unknown): ToolOutcome {
  const parsed = writeFileInput.safeParse(rawInput);
  if (!parsed.success) return invalidInput("write_file", parsed.error);
  const { path, content } = parsed.data;

  const pathError = validatePath(path);
  if (pathError) return failure(pathError);

  if (content.length > MAX_FILE_BYTES) {
    return failure(
      `"${path}" is ${content.length} characters, over the ${MAX_FILE_BYTES} limit. Split it into smaller files.`,
    );
  }
  if (!(path in state.files) && Object.keys(state.files).length >= MAX_FILES) {
    return failure(`This app already has ${MAX_FILES} files, which is the limit.`);
  }

  state.files[path] = content;
  return {
    result: `Wrote ${path} (${content.length} characters).`,
    event: { kind: "write_file", path, bytes: content.length },
  };
}

function editFile(state: AgentState, rawInput: unknown): ToolOutcome {
  const parsed = editFileInput.safeParse(rawInput);
  if (!parsed.success) return invalidInput("edit_file", parsed.error);
  const { path, old_string: oldString, new_string: newString } = parsed.data;

  const pathError = validatePath(path);
  if (pathError) return failure(pathError);

  const current = state.files[path];
  if (current === undefined) {
    const known = Object.keys(state.files).join(", ") || "(none)";
    return failure(`"${path}" does not exist. Existing files: ${known}.`);
  }

  const occurrences = current.split(oldString).length - 1;
  if (occurrences === 0) {
    return failure(`old_string was not found in "${path}". Check exact whitespace and indentation.`);
  }
  if (occurrences > 1) {
    return failure(
      `old_string appears ${occurrences} times in "${path}". Include more surrounding context to make it unique.`,
    );
  }

  state.files[path] = current.replace(oldString, newString);
  return { result: `Edited ${path}.`, event: { kind: "edit_file", path } };
}

function deleteFile(state: AgentState, rawInput: unknown): ToolOutcome {
  const parsed = deleteFileInput.safeParse(rawInput);
  if (!parsed.success) return invalidInput("delete_file", parsed.error);
  const { path } = parsed.data;

  const pathError = validatePath(path);
  if (pathError) return failure(pathError);
  if (!(path in state.files)) return failure(`"${path}" does not exist.`);

  delete state.files[path];
  return { result: `Deleted ${path}.`, event: { kind: "delete_file", path } };
}

function seedData(state: AgentState, rawInput: unknown): ToolOutcome {
  const parsed = seedDataInput.safeParse(rawInput);
  if (!parsed.success) return invalidInput("seed_data", parsed.error);
  const { collection, rows } = parsed.data;

  const declared = findCollection(state.schema, collection);
  if (!declared) {
    const known = state.schema.collections.map((c) => c.name).join(", ") || "(none)";
    return failure(`Unknown collection "${collection}". Declared: ${known}.`);
  }
  if (rows.length === 0) return failure("seed_data needs at least one row.");
  if (rows.length > 20) return failure("seed_data accepts at most 20 rows per call.");

  const validator = collectionValidator(declared);
  const validated: Record<string, unknown>[] = [];

  for (const [index, row] of rows.entries()) {
    const result = validator.safeParse(row);
    if (!result.success) {
      return failure(
        `Row ${index + 1} of "${collection}" does not match the schema: ${formatIssues(result.error).join("; ")}`,
      );
    }
    validated.push(result.data as Record<string, unknown>);
  }

  state.pendingSeeds.push({ collection, rows: validated });
  return {
    result: `Queued ${validated.length} rows for "${collection}".`,
    event: { kind: "seed_data", collection, count: validated.length },
  };
}
