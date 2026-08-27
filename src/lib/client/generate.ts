import type { StreamEvent } from "@/lib/agent/events";

/**
 * Consumes the generation SSE stream.
 *
 * Errors after the first byte cannot be HTTP statuses — the response is already
 * committed — so the server sends them as a terminal `error` event and this
 * yields them like any other.
 */
export async function* streamGeneration(
  projectId: string,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`/api/projects/${projectId}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => ({}) as { error?: string });
    yield { type: "error", message: body.error ?? `Request failed (${response.status})` };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; a partial one stays in the buffer
    // until the rest of it arrives.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      const line = chunk.split("\n").find((candidate) => candidate.startsWith("data: "));
      if (!line) continue;

      try {
        yield JSON.parse(line.slice(6)) as StreamEvent;
      } catch {
        // A malformed frame is not worth killing the run over.
      }
    }
  }
}
