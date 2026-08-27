# Bench — 笔试说明文档

**Describe an internal tool. Get a working one your team can actually use.**

| | |
| --- | --- |
| Live demo | https://agentic-fullstack-gen.vercel.app |
| A published app | https://agentic-fullstack-gen.vercel.app/p/equipment-checkout-7ygprm |
| Source | https://github.com/Alvaropar/Bench |
| Model | Kimi K3 (`kimi-k3`), swappable to Claude Opus 5 via one env var |

---

## 1. What it is

Bench is an agent-driven app generator. You describe a tool in plain language —
"a CRM for a small sales team" — and an agent designs the data model, generates
the interface, seeds it with realistic rows, and renders it live. Follow-up
messages edit it in place.

```
User: "Create a CRM for a small sales team."
   ↓
Agent  ├── understand the request
       ├── set_schema()   → collections + typed fields provisioned
       ├── write_file()   → UI bound to the injected data client
       ├── seed_data()    → realistic starter rows
       └── summary
   ↓
Live app ──postMessage──▶ Bench API ──▶ records table
   ↓
Publish → /p/<slug> ──▶ the same rows for everyone with the link
```

### The one thing that makes it different

Most prompt-to-UI generators produce a mockup: refresh the page and the data is
gone. **Bench's generated apps are full-stack.** The agent declares a data model,
the platform provisions storage for it, and the running app reads and writes real
rows. Publish it, send the link to a coworker, and the row they add appears in
your window.

That is the demo worth watching: open the published link in two windows, add a
row in one, see it in the other.

---

## 2. Implementation approach and key tradeoffs

### The agent never writes SQL

The obvious implementation is to let the model emit `CREATE TABLE`. That means
runtime migrations, an injection surface, and a schema that can break every app
built before it.

Instead the agent declares an **`AppSchema`** — collections and typed fields — as
*data*, through a `set_schema` tool. One generic `records(project_id, collection,
data JSONB)` table stores everything, and a zod validator is generated per
collection from the declaration. 90% of the capability, ~10% of the risk.

The cost is real and worth stating: no joins, no per-app indexes, no SQL access
for generated apps. At this scale nothing needed them.

### A fixed runtime contract is the biggest lever on output quality

Free-form "generate any React app" produces a different-looking app every run and
a lot of broken layout. Every generated app is instead injected with a scaffold
it must build against:

- **`bench/db.ts`** — a typed data client plus a `useCollection` hook that loads,
  writes, and **polls**. Because polling is inside the contract, the multi-user
  property is automatic: the agent never has to think about it, and the
  two-window demo works without ever being asked for.
- **`bench/ui.tsx`** — a fixed component set (Page, Card, Table, Modal, Badge,
  Field, Stat…) and one stylesheet.

The agent composes rather than invents. Output quality went up sharply and demos
became repeatable.

This creates a failure mode worth guarding: if the system prompt documents a
component the scaffold doesn't export, generated apps break in a way the agent
cannot see. `npm run tools:check` extracts every export from the injected runtime
and **fails if the prompt doesn't document it** — prompt/runtime drift is a test,
not a discipline.

### Data outlives code

`records` hangs off the **project**, not the version. When the agent rewrites the
UI — or you restore an older version — the rows survive. For an internal tool
that is the difference between a toy and something a team can rely on.

### Seeds are validated immediately but written last

`seed_data` validates on the tool call, so a bad row reaches the model while it
can still correct itself, but rows are only inserted after the version commits. A
run that dies halfway leaves nothing behind for an app that never existed.

### The preview talks over postMessage, not fetch

Generated code never sees a project id or a token. It posts to its parent, Bench
resolves the request against the records API, and posts back. No CORS with the
sandbox origin, no credentials in generated source. Trust runs inbound: a message
is honored only if its source is a frame Bench is actually rendering.

### A manual agent loop, not a vendor tool runner

The SDK tool runners drive tool calls well, but the loop needs three things they
don't expose cleanly: ordered domain events per tool call (for the timeline),
file state mutating across the whole run, and exactly one version commit at the
end. That cost ~80 lines and bought all three.

### Provider-swappable

The loop runs against a `Provider` interface, not an SDK. Nothing above
`src/lib/agent/providers/` knows which model is running.

| | Claude | Kimi K3 |
| --- | --- | --- |
| Wire format | Messages API | OpenAI-compatible |
| Reasoning stream | `thinking` blocks | `reasoning_content` deltas |
| Tool results | one batched message | one message per call |

The awkward part of the OpenAI-compatible path: tool arguments arrive as JSON
**fragments** keyed by index across many chunks. Parsing any single chunk yields
truncated JSON — the quiet way this port breaks. `ToolCallAccumulator` is
extracted from the stream loop specifically so it can be tested without a network
call, and it is covered for fragmented names, out-of-order parallel calls,
missing ids, and truncated JSON degrading into a *rejectable* input rather than a
crash.

### Rejection messages are the model's only correction signal

Every tool failure names the specific problem — which field, which row, how many
times a string matched, which files actually exist. Unknown keys are **rejected,
not stripped**: an undeclared field means the UI and the schema have drifted, and
a 422 naming the field gives the self-healing loop something to act on, where
silently dropping the user's data gives it nothing.

---

## 3. A measurement that changed the design

The first real generation with K3 took **473 seconds** and emitted ~10,000
reasoning deltas. A serverless function is capped at 300s, so the deployed app
would have been killed mid-generation.

Re-run at `reasoning_effort: low`: **112 seconds, same quality.** Same
collections, same seeded row counts, the same component kit used throughout —
the only difference was one file instead of four.

So the effort default is provider-aware: `high` for Claude, `low` for Kimi. K3
always reasons and cannot have thinking disabled, so "low" is less reasoning, not
none.

This is only findable by running the thing.

---

## 4. What is done

| Area | Status |
| --- | --- |
| Prompt → plan → generate → preview → iterate | ✅ |
| Real persistence for generated apps | ✅ |
| Publish to `/p/<slug>` with shared multi-user data | ✅ |
| Data view — the app's rows as a table | ✅ |
| Self-healing — preview errors fed back to the agent | ✅ |
| Version history with restore | ✅ |
| Rate limits, row ceilings, error boundaries | ✅ |
| Provider-swappable agent (Claude / Kimi K3) | ✅ |

### Verified, not just written

- **`npm run smoke`** — 32 assertions against real Postgres: schema-derived
  validation, coercion, partial updates, project isolation, cascade deletes,
  publish/unpublish access boundaries, restore semantics, and the claim that
  records survive a version rewrite.
- **`npm run tools:check`** — 50 assertions with no database or API key:
  every tool rejection path, the streamed-tool-call accumulator, the
  OpenAI-compatible message mapping, and the prompt/runtime drift guard.
- **Shared data, across two real sessions:**

  ```
  before publish   stranger GET /p/<slug>     404
  after publish    stranger GET /p/<slug>     200
                   owner sees                   9 customers
                   STRANGER adds a row        201
                   owner now sees              10 customers
  unpublish        stranger writes            403
  ```

- **Rate limiting** — request 21 of 21 returns 429 with the retry window.
- **Ownership** — a stranger gets 404 on generate, publish, and restore.
- **In production, not just locally** — a generation on the deployed site took
  **99s** end to end, declaring two collections (`equipment`, `checkouts`),
  writing the app and seeding 15 rows; publishing it made it readable by a fresh
  session immediately.

## 5. What is not done

- **No accounts.** Ownership is an anonymous session cookie. Fine for a demo,
  not for real use — the cookie *is* the credential.
- **Rate limiting is in-memory.** Per-instance counters on serverless mean the
  real ceiling is roughly limit × instances. It is a cost guard, not a security
  control. Swapping in a shared store touches one file.
- **The preview depends on a remote bundler** (Sandpack). It buys back several
  hours versus hand-rolling an iframe bundler; the cost is a third-party
  dependency in the critical path.
- **No editing of generated source by hand** — the file list is read-only.
- **No fork.** History is append-only and restorable, but branches are not
  first-class.
- **Generated apps cannot reach the outside world.** No HTTP from inside the
  sandbox, so tools needing live external data are out of scope by construction.

---

## 6. If I kept going

In priority order, and why:

1. **Accounts and per-app permissions.** The single thing blocking real use.
   Anonymous sessions make publish all-or-nothing; teams need "these people can
   write, everyone else can read."
2. **Click-to-edit in the preview.** Select an element, describe the change, and
   the agent patches just that file. The highest-leverage UX win — it removes the
   need to describe *where* in words.
3. **Streaming file writes.** Files currently appear when a tool call completes;
   streaming them as they are written makes long generations feel half as long,
   which matters more than actually making them faster.
4. **A shared rate-limit store and per-project token budgets.** Needed before
   this could be public rather than demoed.
5. **Relations between collections.** The schema is deliberately flat. A
   `reference` field type — customers → activities — is the most common thing
   real internal tools need that Bench cannot express.
6. **Export.** Let someone take the generated app and its data out. A tool you
   cannot leave is a tool people hesitate to adopt.

I would not add more generation *breadth* (charts, dashboards, integrations)
before doing 1 and 2. The narrow, reliable version is worth more than a wider one
that works sometimes.

---

## 7. Running it

```bash
npm install
cp .env.example .env.local   # Neon URL + a provider key
npm run db:migrate
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run db:migrate` | Apply migrations (non-interactive) |
| `npm run smoke` | Data spine against a real database |
| `npm run tools:check` | Agent tool layer, no DB or API key needed |

Deploying: import the repo on Vercel, set `DATABASE_URL` and `MOONSHOT_API_KEY`
(or `ANTHROPIC_API_KEY`), run `npm run db:migrate` once against production, and
enable Fluid Compute so functions are not capped at 60s.

---

## 8. Stack

Next.js 16 (App Router) · Neon Postgres + Drizzle · Kimi K3 / Claude Opus 5 with
tool use · Sandpack · Tailwind 4 · Vercel
