/**
 * Checks the agent's tool layer without touching the database or the API.
 *
 *   npm run tools:check
 *
 * Two things are worth proving here. First, every tool rejects bad input with a
 * message specific enough for the model to act on — those strings are the only
 * correction signal it gets. Second, the system prompt and the injected runtime
 * still agree: if the prompt documents a component the scaffold does not export,
 * generated apps break in a way the agent cannot see.
 */
import { SCAFFOLD_PATHS, assembleFiles, MAX_FILES } from "../src/lib/agent/contract";
import { SYSTEM_PROMPT } from "../src/lib/agent/prompt";
import { TOOL_SPECS, executeTool, type AgentState } from "../src/lib/agent/tools";
import {
  ToolCallAccumulator,
  toOpenAIMessages,
} from "../src/lib/agent/providers/moonshot";
import { PROVIDER_IDS, isProviderId } from "../src/lib/agent/providers";
import { UI_SOURCE } from "../src/lib/agent/ui-kit";
import { CHARTS_SOURCE } from "../src/lib/agent/charts-kit";
import { ROUTER_SOURCE } from "../src/lib/agent/router-kit";
import { DB_CLIENT_SOURCE } from "../src/lib/agent/db-client";
import { EMPTY_SCHEMA } from "../src/lib/types";
import { richTextToPlain, sanitizeHtml } from "../src/lib/sanitize-html";

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}`);
  } else {
    failed++;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}`);
    if (detail !== undefined) console.log("       ", detail);
  }
}

function freshState(): AgentState {
  return { files: {}, schema: structuredClone(EMPTY_SCHEMA), pendingSeeds: [] };
}

const CRM_COLLECTIONS = {
  collections: [
    {
      name: "customers",
      label: "Customers",
      fields: [
        { name: "company", label: "Company", type: "text", required: true },
        { name: "value", label: "Value", type: "number" },
        { name: "stage", label: "Stage", type: "select", options: ["Lead", "Won"] },
      ],
    },
  ],
};

console.log("\nBench agent tool layer\n");

// ---------------------------------------------------------------- set_schema
{
  const state = freshState();
  const ok = executeTool(state, "set_schema", CRM_COLLECTIONS);
  check("valid schema accepted", !ok.isError, ok.result);
  check("schema recorded on state", state.schema.collections.length === 1);
  check(
    "emits a timeline event naming the collections",
    ok.event?.kind === "set_schema" &&
      ok.event.collections.join() === "customers",
    ok.event,
  );

  const snake = executeTool(freshState(), "set_schema", {
    collections: [{ name: "my_things", label: "X", fields: CRM_COLLECTIONS.collections[0].fields }],
  });
  check("snake_case collection rejected", Boolean(snake.isError));

  const noOptions = executeTool(freshState(), "set_schema", {
    collections: [
      {
        name: "things",
        label: "Things",
        fields: [{ name: "stage", label: "Stage", type: "select" }],
      },
    ],
  });
  check("select without options rejected", Boolean(noOptions.isError));
  check(
    "rejection names the offending field",
    noOptions.result.includes("things.stage"),
    noOptions.result,
  );

  const duplicate = executeTool(freshState(), "set_schema", {
    collections: [...CRM_COLLECTIONS.collections, ...CRM_COLLECTIONS.collections],
  });
  check("duplicate collection names rejected", Boolean(duplicate.isError));
}

// ------------------------------------------------------------- file writing
{
  const state = freshState();

  const scaffold = executeTool(state, "write_file", {
    path: "bench/db.ts",
    content: "hacked",
  });
  check("cannot overwrite the scaffold", Boolean(scaffold.isError), scaffold.result);

  const traversal = executeTool(state, "write_file", {
    path: "../../etc/passwd.ts",
    content: "x",
  });
  check("path traversal rejected", Boolean(traversal.isError));

  const absolute = executeTool(state, "write_file", { path: "/App.tsx", content: "x" });
  check("absolute path rejected", Boolean(absolute.isError));

  const wrongExt = executeTool(state, "write_file", { path: "App.js", content: "x" });
  check("unsupported extension rejected", Boolean(wrongExt.isError));

  const good = executeTool(state, "write_file", {
    path: "App.tsx",
    content: "export default function App() { return <div>hi</div>; }",
  });
  check("valid write accepted", !good.isError, good.result);
  check("file lands on state", "App.tsx" in state.files);
  check(
    "write event reports byte count",
    good.event?.kind === "write_file" && good.event.bytes > 0,
    good.event,
  );

  for (let i = 0; i < MAX_FILES; i++) {
    executeTool(state, "write_file", { path: `components/F${i}.tsx`, content: "x" });
  }
  const overflow = executeTool(state, "write_file", { path: "OneTooMany.tsx", content: "x" });
  check("file count limit enforced", Boolean(overflow.isError), overflow.result);
}

// -------------------------------------------------------------- file editing
{
  const state = freshState();
  executeTool(state, "write_file", {
    path: "App.tsx",
    content: "const title = 'Sales CRM';\nconst other = 'x';\nconst dup = 1;\nconst dup2 = 1;",
  });

  const missingFile = executeTool(state, "edit_file", {
    path: "Nope.tsx",
    old_string: "a",
    new_string: "b",
  });
  check("editing a missing file fails", Boolean(missingFile.isError));
  check(
    "failure lists the files that do exist",
    missingFile.result.includes("App.tsx"),
    missingFile.result,
  );

  const notFound = executeTool(state, "edit_file", {
    path: "App.tsx",
    old_string: "nowhere to be found",
    new_string: "b",
  });
  check("unmatched old_string fails", Boolean(notFound.isError));

  const ambiguous = executeTool(state, "edit_file", {
    path: "App.tsx",
    old_string: "const dup",
    new_string: "const changed",
  });
  check("ambiguous old_string fails", Boolean(ambiguous.isError));
  check(
    "ambiguity failure reports the occurrence count",
    ambiguous.result.includes("2 times"),
    ambiguous.result,
  );

  const applied = executeTool(state, "edit_file", {
    path: "App.tsx",
    old_string: "'Sales CRM'",
    new_string: "'Pipeline'",
  });
  check("unique edit applies", !applied.isError && state.files["App.tsx"].includes("Pipeline"));
  check("edit leaves the rest of the file alone", state.files["App.tsx"].includes("const other"));
}

// ---------------------------------------------------------------- seed_data
{
  const state = freshState();

  const beforeSchema = executeTool(state, "seed_data", {
    collection: "customers",
    rows: [{ company: "Acme" }],
  });
  check("seeding before set_schema fails", Boolean(beforeSchema.isError));

  executeTool(state, "set_schema", CRM_COLLECTIONS);

  const badRow = executeTool(state, "seed_data", {
    collection: "customers",
    rows: [
      { company: "Acme", stage: "Lead" },
      { company: "Tesla", stage: "Nonsense" },
    ],
  });
  check("row violating a select option fails", Boolean(badRow.isError));
  check("failure identifies which row", badRow.result.includes("Row 2"), badRow.result);

  const undeclared = executeTool(state, "seed_data", {
    collection: "customers",
    rows: [{ company: "Acme", madeUp: 1 }],
  });
  check("row with an undeclared field fails", Boolean(undeclared.isError));

  const good = executeTool(state, "seed_data", {
    collection: "customers",
    rows: [
      { company: "Acme Corp", value: 120000, stage: "Won" },
      { company: "Tesla", value: 80000, stage: "Lead" },
    ],
  });
  check("valid rows queued", !good.isError, good.result);
  check("seeds are buffered, not written", state.pendingSeeds[0]?.rows.length === 2);
  check(
    "number stays a number after validation",
    state.pendingSeeds[0]?.rows[0].value === 120000,
  );
}

// ------------------------------------------------------ prompt/runtime drift
{
  const exported = [
    ...UI_SOURCE.matchAll(/export (?:function|const) (\w+)/g),
    ...CHARTS_SOURCE.matchAll(/export (?:function|const) (\w+)/g),
    ...ROUTER_SOURCE.matchAll(/export (?:function|const) (\w+)/g),
  ].map((m) => m[1]);
  const undocumented = exported.filter((name) => !SYSTEM_PROMPT.includes(name));
  check(
    "every UI component the scaffold exports is documented in the prompt",
    undocumented.length === 0,
    undocumented,
  );

  const dbExports = [...DB_CLIENT_SOURCE.matchAll(/export (?:function|const) (\w+)/g)].map(
    (m) => m[1],
  );
  const undocumentedDb = dbExports.filter((name) => !SYSTEM_PROMPT.includes(name));
  check(
    "every db export is documented in the prompt",
    undocumentedDb.length === 0,
    undocumentedDb,
  );

  const promptComponents = ["Page", "PageHeader", "Card", "Table", "Modal", "Badge"];
  const missing = promptComponents.filter((name) => !exported.includes(name));
  check("every component the prompt promises actually exists", missing.length === 0, missing);
}

// ----------------------------------------------------------------- scaffold
{
  const assembled = assembleFiles({ "App.tsx": "x" });
  check("assembled app includes the scaffold", SCAFFOLD_PATHS.size > 0);
  check(
    "scaffold files are all present",
    [...SCAFFOLD_PATHS].every((path) => path in assembled),
    Object.keys(assembled),
  );
  check("generated files are present too", assembled["App.tsx"] === "x");
  check(
    "db client is importable as ./bench/db",
    "bench/db.ts" in assembled && assembled["bench/db.ts"].includes("useCollection"),
  );
}

  console.log("\nRich text sanitiser");

  const drops = [
    ["script tag and its body", "<p>ok</p><script>alert(1)</script>"],
    ["inline event handler", "<p onclick=\"steal()\">ok</p>"],
    ["javascript: href", "<a href=\"javascript:alert(1)\">x</a>"],
    ["iframe", "<p>ok</p><iframe src=\"//evil\"></iframe>"],
    ["style block", "<style>body{display:none}</style><p>ok</p>"],
    ["img with onerror", "<img src=x onerror=alert(1)>"],
    ["svg payload", "<svg><script>alert(1)</script></svg>"],
  ] as const;

  for (const [label, payload] of drops) {
    const cleaned = sanitizeHtml(payload);
    const unsafe =
      /<script|<iframe|<style|<svg|onerror|onclick|javascript:/i.test(cleaned);
    check("strips " + label, !unsafe, cleaned);
  }

  check(
    "keeps the text around a stripped tag",
    sanitizeHtml("<p>ok</p><script>alert(1)</script>").includes("ok"),
  );
  check(
    "preserves allowed formatting",
    sanitizeHtml("<p><strong>bold</strong> and <em>italic</em></p>") ===
      "<p><strong>bold</strong> and <em>italic</em></p>",
    sanitizeHtml("<p><strong>bold</strong> and <em>italic</em></p>"),
  );
  check(
    "keeps safe links and hardens them",
    (() => {
      const out = sanitizeHtml('<a href="https://example.com">x</a>');
      return out.includes('href="https://example.com"') && out.includes("noopener");
    })(),
    sanitizeHtml('<a href="https://example.com">x</a>'),
  );
  check(
    "plain-text preview drops markup",
    richTextToPlain("<p>Hello <strong>there</strong></p><ul><li>one</li></ul>") ===
      "Hello there one",
    richTextToPlain("<p>Hello <strong>there</strong></p><ul><li>one</li></ul>"),
  );

// ------------------------------------------------------- provider adapters
{
  check(
    "every tool spec carries a name, description and parameters",
    TOOL_SPECS.every(
      (spec) => spec.name && spec.description && typeof spec.parameters === "object",
    ),
  );

  // The failure this guards: arguments arrive as JSON fragments, so parsing any
  // single chunk yields truncated JSON.
  const accumulator = new ToolCallAccumulator();
  accumulator.add({ index: 0, id: "call_a", function: { name: "write_", arguments: '{"pa' } });
  accumulator.add({ index: 0, function: { name: "file", arguments: 'th":"App.tsx",' } });
  accumulator.add({ index: 0, function: { arguments: '"content":"x"}' } });

  const [reassembled] = accumulator.finish();
  check("fragmented tool name is reassembled", reassembled.name === "write_file", reassembled.name);
  check(
    "fragmented arguments parse once complete",
    JSON.stringify(reassembled.input) === '{"path":"App.tsx","content":"x"}',
    reassembled.input,
  );
  check("id from the first fragment is kept", reassembled.id === "call_a");

  const parallel = new ToolCallAccumulator();
  parallel.add({ index: 1, id: "b", function: { name: "delete_file", arguments: '{"path":"B.tsx"}' } });
  parallel.add({ index: 0, id: "a", function: { name: "write_file", arguments: '{"path":"A.tsx"}' } });
  check(
    "parallel calls come back in index order",
    parallel.finish().map((call) => call.id).join() === "a,b",
  );

  const idless = new ToolCallAccumulator();
  idless.add({ index: 0, function: { name: "set_schema", arguments: "{}" } });
  check("a missing id is synthesised", idless.finish()[0].id === "call_0");

  const broken = new ToolCallAccumulator();
  broken.add({ index: 0, id: "x", function: { name: "write_file", arguments: '{"path":' } });
  const brokenCall = broken.finish()[0];
  check(
    "truncated JSON degrades to a rejectable input, not a crash",
    typeof brokenCall.input === "object" && brokenCall.input !== null,
  );
  const rejected = executeTool(freshState(), brokenCall.name, brokenCall.input);
  check("and the executor rejects it with a readable message", Boolean(rejected.isError));

  // Claude batches tool results into one message; OpenAI-compatible APIs need
  // one message per call.
  const mapped = toOpenAIMessages("SYS", [
    { role: "user", text: "build it" },
    {
      role: "assistant",
      text: "",
      toolCalls: [{ id: "a", name: "write_file", input: { path: "App.tsx" } }],
    },
    {
      role: "tool_results",
      results: [
        { id: "a", content: "Wrote App.tsx." },
        { id: "b", content: "not found", isError: true },
      ],
    },
  ]);

  check("system prompt leads the message list", mapped[0].role === "system");
  check(
    "each tool result becomes its own message",
    mapped.filter((message) => message.role === "tool").length === 2,
  );
  check(
    "tool errors are marked in the content",
    String(mapped.at(-1)?.content).startsWith("Error:"),
    mapped.at(-1)?.content,
  );
  const assistant = mapped[2] as { tool_calls?: { function: { arguments: string } }[] };
  check(
    "assistant tool calls are serialised as JSON strings",
    assistant.tool_calls?.[0].function.arguments === '{"path":"App.tsx"}',
    assistant.tool_calls?.[0].function.arguments,
  );

  check("both providers are registered", PROVIDER_IDS.length === 2);
  check("unknown provider ids are rejected", !isProviderId("gpt"));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
