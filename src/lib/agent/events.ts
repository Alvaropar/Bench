import type { AppSchema, FileMap, ToolEvent } from "@/lib/types";

/** What the browser receives over SSE while a generation runs. */
export type StreamEvent =
  | { type: "start" }
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool"; event: ToolEvent }
  | {
      type: "done";
      versionId: string;
      summary: string;
      schema: AppSchema;
      files: FileMap;
      seededRows: number;
    }
  | { type: "error"; message: string };

export function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
