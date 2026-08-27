import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import type { Message } from "@/db/schema";
import type { ToolEvent } from "@/lib/types";

export async function listMessages(projectId: string): Promise<Message[]> {
  return getDb()
    .select()
    .from(messages)
    .where(eq(messages.projectId, projectId))
    .orderBy(asc(messages.createdAt));
}

export async function appendMessage(input: {
  projectId: string;
  role: "user" | "assistant";
  content: string;
  toolEvents?: ToolEvent[];
  versionId?: string;
}): Promise<Message> {
  const [message] = await getDb()
    .insert(messages)
    .values({
      projectId: input.projectId,
      role: input.role,
      content: input.content,
      toolEvents: input.toolEvents ?? null,
      versionId: input.versionId ?? null,
    })
    .returning();
  return message;
}
