/**
 * The postMessage protocol between a generated app and Bench.
 *
 * This is the other end of `src/lib/agent/db-client.ts` — the two files must
 * agree on these shapes exactly. Going over postMessage rather than letting the
 * generated app call the API directly keeps the project's identity out of
 * generated code and avoids CORS with the sandbox origin entirely.
 */

export type BridgeOp = "list" | "create" | "update" | "remove" | "upload";

export interface BridgeRequest {
  __bench: "request";
  id: number;
  op: BridgeOp;
  payload: {
    /** Present for every record op; absent for uploads. */
    collection?: string;
    id?: string;
    data?: Record<string, unknown>;
    limit?: number;
    order?: "asc" | "desc";
    /** Upload only. */
    name?: string;
    mime?: string;
    base64?: string;
  };
}

export interface BridgeResponse {
  __bench: "response";
  id: number;
  result?: unknown;
  error?: string;
}

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<BridgeRequest>;
  return (
    message.__bench === "request" &&
    typeof message.id === "number" &&
    typeof message.op === "string" &&
    typeof message.payload === "object" &&
    message.payload !== null &&
    (message.op === "upload" || typeof message.payload.collection === "string")
  );
}

/**
 * Executes one bridge request against the records API.
 *
 * Errors are returned as strings rather than thrown: they travel back into the
 * generated app, where they surface through `useCollection`'s error state — and
 * eventually into the self-healing loop.
 */
export async function handleBridgeRequest(
  projectId: string,
  request: BridgeRequest,
): Promise<BridgeResponse> {
  const { op, payload } = request;
  const base = `/api/apps/${projectId}/${encodeURIComponent(payload.collection ?? "")}`;

  try {
    switch (op) {
      case "list": {
        const params = new URLSearchParams();
        if (payload.limit) params.set("limit", String(payload.limit));
        if (payload.order) params.set("order", payload.order);
        const query = params.toString();
        const body = await request_(query ? `${base}?${query}` : base, { method: "GET" });
        return { __bench: "response", id: request.id, result: body.records };
      }
      case "create": {
        const body = await request_(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.data ?? {}),
        });
        return { __bench: "response", id: request.id, result: body.record };
      }
      case "update": {
        if (!payload.id) throw new Error("update requires a record id");
        const body = await request_(`${base}/${payload.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.data ?? {}),
        });
        return { __bench: "response", id: request.id, result: body.record };
      }
      case "remove": {
        if (!payload.id) throw new Error("remove requires a record id");
        await request_(`${base}/${payload.id}`, { method: "DELETE" });
        return { __bench: "response", id: request.id, result: null };
      }
      case "upload": {
        const body = await request_(`/api/apps/${projectId}/assets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: payload.name ?? "upload",
            mime: payload.mime ?? "application/octet-stream",
            data: payload.base64 ?? "",
          }),
        });
        return { __bench: "response", id: request.id, result: body.asset };
      }
      default:
        throw new Error(`Unknown operation "${op}"`);
    }
  } catch (error) {
    return {
      __bench: "response",
      id: request.id,
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

interface ApiBody {
  records?: unknown;
  record?: unknown;
  asset?: unknown;
  error?: string;
  details?: unknown;
}

async function request_(url: string, init: RequestInit): Promise<ApiBody> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as ApiBody;

  if (!response.ok) {
    // Validation failures carry field-level detail; passing it through is what
    // makes a schema mismatch debuggable from inside the generated app.
    const details = Array.isArray(body.details) ? ` (${body.details.join("; ")})` : "";
    throw new Error(`${body.error ?? response.statusText}${details}`);
  }
  return body;
}
