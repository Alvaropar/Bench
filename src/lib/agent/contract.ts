import { CHARTS_SOURCE } from "@/lib/agent/charts-kit";
import { DB_CLIENT_SOURCE } from "@/lib/agent/db-client";
import { ROUTER_SOURCE, ROUTER_STYLES } from "@/lib/agent/router-kit";
import { STYLES_SOURCE, UI_SOURCE } from "@/lib/agent/ui-kit";
import type { FileMap } from "@/lib/types";

/**
 * The scaffold every generated app is built inside.
 *
 * These files are injected by the preview runtime and are NOT writable by the
 * agent. Fixing the runtime this way is what makes generation reliable: the
 * agent composes against a known data client and a known component set instead
 * of inventing a new data layer and a new design language on every run.
 */

export const ENTRY_FILE = "App.tsx";

const INDEX_SOURCE = String.raw`
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./bench/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`.trimStart();

export const SCAFFOLD_FILES: FileMap = {
  "index.tsx": INDEX_SOURCE,
  "bench/db.ts": DB_CLIENT_SOURCE,
  "bench/ui.tsx": UI_SOURCE,
  "bench/charts.tsx": CHARTS_SOURCE,
  "bench/router.tsx": ROUTER_SOURCE,
  "bench/styles.css": STYLES_SOURCE + ROUTER_STYLES,
};

export const SCAFFOLD_PATHS = new Set([...Object.keys(SCAFFOLD_FILES), "bench/config.ts"]);

/** Paths the agent may write. Everything else is rejected at tool-call time. */
export const WRITABLE_EXTENSIONS = [".tsx", ".ts", ".css"];
export const MAX_FILES = 24;
export const MAX_FILE_BYTES = 60_000;

export function validatePath(path: string): string | null {
  if (SCAFFOLD_PATHS.has(path)) {
    return `"${path}" is part of the Bench scaffold and cannot be modified.`;
  }
  if (path.startsWith("/") || path.includes("..") || path.includes("\\")) {
    return `"${path}" must be a relative path without ".." segments.`;
  }
  if (path.startsWith("bench/")) {
    return `The "bench/" directory is reserved for the Bench scaffold.`;
  }
  if (!WRITABLE_EXTENSIONS.some((extension) => path.endsWith(extension))) {
    return `"${path}" must end in one of: ${WRITABLE_EXTENSIONS.join(", ")}.`;
  }
  if (path.length > 120) {
    return `"${path}" is too long.`;
  }
  return null;
}

/**
 * Scaffold + generated files, ready to hand to the preview runtime.
 *
 * `origin` is injected as a scaffold file rather than passed through the bridge
 * so an <img src> works without a round trip. Only the origin goes in -- the
 * project id stays out of generated code, which is why asset URLs are
 * capability ids rather than project-scoped paths.
 */
export function assembleFiles(generated: FileMap, origin = ""): FileMap {
  return {
    ...SCAFFOLD_FILES,
    "bench/config.ts": `export const BENCH_ORIGIN = ${JSON.stringify(origin)};
`,
    ...generated,
  };
}
