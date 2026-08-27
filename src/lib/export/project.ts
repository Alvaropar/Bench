import { SCAFFOLD_FILES } from "@/lib/agent/contract";
import { STANDALONE_DB_SOURCE } from "@/lib/export/standalone-db";
import { createZip, type ZipEntry } from "@/lib/export/zip";
import type { AppSchema, FileMap } from "@/lib/types";

/**
 * Turns a generated app into a standalone Vite project.
 *
 * The point is that a downloaded app is genuinely yours: `npm install && npm
 * run dev` and it runs, with its data, on your machine, with no account and no
 * connection back here. The only substitution is the data layer — the hosted
 * `bench/db.ts` talks to Bench over postMessage, and the exported one keeps the
 * same API against localStorage seeded from the rows at export time.
 */

export interface ExportInput {
  title: string;
  slug: string;
  files: FileMap;
  schema: AppSchema;
  /** Current rows, per collection, as the generated app sees them. */
  data: Record<string, unknown[]>;
  /** Where uploaded files still live. */
  origin: string;
}

const PACKAGE_JSON = (name: string) =>
  JSON.stringify(
    {
      name,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc --noEmit && vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^19.2.0",
        "react-dom": "^19.2.0",
      },
      devDependencies: {
        "@types/react": "^19.2.0",
        "@types/react-dom": "^19.2.0",
        "@vitejs/plugin-react": "^5.0.0",
        typescript: "^5.9.0",
        vite: "^7.1.0",
      },
    },
    null,
    2,
  ) + "\n";

const VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`;

const TSCONFIG =
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        isolatedModules: true,
        esModuleInterop: true,
      },
      include: ["src"],
    },
    null,
    2,
  ) + "\n";

const INDEX_HTML = (title: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./bench/styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const README = (input: ExportInput) => `# ${input.title}

Built with [Bench](${input.origin}). This is a complete, standalone Vite
project — it runs on your machine with no account and no connection back.

\`\`\`bash
npm install
npm run dev
\`\`\`

## Where the data went

The hosted version stores its rows in Bench and shares them with everyone who
has the link. This copy has no server, so \`src/bench/db.ts\` implements the same
API against \`localStorage\`, seeded from \`src/bench/seed.json\` — the rows this
app had when you exported it.

Everything else is unchanged: the same components, the same code you saw in the
preview. Swap \`src/bench/db.ts\` for a real backend and the rest of the app does
not need to know.

## Data model

${input.schema.collections
  .map(
    (collection) =>
      `**${collection.label}** (\`${collection.name}\`)\n\n` +
      collection.fields
        .map(
          (field) =>
            `- \`${field.name}\` — ${field.type}${field.required ? ", required" : ""}`,
        )
        .join("\n"),
  )
  .join("\n\n")}

## Uploaded files

Images and documents uploaded before the export still load from Bench: their
URLs are public and unguessable. Anything you upload in this copy is kept in
local storage instead.

## Layout

| Path | What it is |
| --- | --- |
| \`src/App.tsx\` | The app, as generated |
| \`src/bench/ui.tsx\` | Component kit |
| \`src/bench/charts.tsx\` | Chart primitives |
| \`src/bench/router.tsx\` | Hash router |
| \`src/bench/db.ts\` | Data layer (localStorage in this copy) |
| \`src/bench/seed.json\` | Your rows at export time |
`;

/**
 * Everything an exported project contains, as a path → contents map.
 *
 * Kept separate from zipping so the file tree can show exactly what a download
 * would produce.
 */
export function buildProjectFiles(input: ExportInput): FileMap {
  const project: FileMap = {
    "package.json": PACKAGE_JSON(input.slug),
    "vite.config.ts": VITE_CONFIG,
    "tsconfig.json": TSCONFIG,
    "index.html": INDEX_HTML(input.title),
    "README.md": README(input),
    "src/main.tsx": MAIN_TSX,
  };

  // The generated app itself.
  for (const [path, contents] of Object.entries(input.files)) {
    project[`src/${path}`] = contents;
  }

  // The scaffold it was written against, minus the pieces that only make sense
  // inside Bench.
  for (const [path, contents] of Object.entries(SCAFFOLD_FILES)) {
    if (path === "index.tsx" || path === "bench/db.ts" || path === "bench/inspect.ts") continue;
    project[`src/${path}`] = contents;
  }

  project["src/bench/db.ts"] = STANDALONE_DB_SOURCE;
  project["src/bench/config.ts"] = `export const BENCH_ORIGIN = ${JSON.stringify(input.origin)};\n`;
  project["src/bench/seed.json"] = JSON.stringify(input.data, null, 2) + "\n";

  return project;
}

export function buildProjectZip(input: ExportInput): Blob {
  const files = buildProjectFiles(input);
  const entries: ZipEntry[] = Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => ({ path: `${input.slug}/${path}`, content }));

  return createZip(entries);
}
