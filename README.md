# Bench

**Describe an internal tool. Get a working one your team can actually use.**

Bench is an agent-driven app generator. You describe a tool in plain language
("a CRM for a small sales team"); an agent designs the data model, generates the
UI, seeds it with realistic rows, and publishes it to a link. The difference from
a typical prompt-to-UI generator: **generated apps have real, shared persistence.**
Open the published link in two windows, add a row in one, and it appears in the
other.

```
User: "Create a CRM for a small sales team."
   ↓
Agent  ├── plan
       ├── set_schema()   → collections + fields provisioned
       ├── write_file()   → UI bound to the injected db client
       ├── seed_data()    → realistic starter rows
       └── done()
   ↓
Live app ──postMessage──▶ Bench API ──▶ records table ──▶ same data for everyone
```

## Status

| Phase | Scope | State |
| --- | --- | --- |
| 0 | Deploy spine: Next.js + Neon + schema + health checks | ✅ |
| 1 | Data spine: projects, records, schema-derived validation | ✅ |
| 2 | Agent loop: tool use, streaming, version commits | ✅ |
| 3 | Live preview, postMessage bridge, chat + agent timeline | ✅ |
| 4 | Publish + shared data | ✅ |
| 5 | Data view, self-healing, version history, hardening | ✅ |

## Stack

- **Next.js 16** (App Router) on Vercel
- **Neon Postgres** + **Drizzle ORM**
- **Claude** (`claude-opus-5`) or **Kimi K3** (`kimi-k3`) for the generation agent
- **Sandpack** as the preview runtime
- **Tailwind 4**

## Publishing

Publishing a project puts the app at `/p/<slug>` for anyone with the link, with
no chat, no file list and no account. Everyone who opens it reads and writes the
same rows: add one in a second window and it appears in the first, because the
injected `useCollection` hook polls.

Publishing shares the *data*, never the source. Running the agent and flipping
the flag stay owner-only, so a link recipient can use the tool but cannot
rebuild it or unpublish it. `npm run smoke` asserts each of those boundaries.

## Limits

| Action | Limit |
| --- | --- |
| Generations | 8 per 15 min per session+address |
| New apps | 20 per hour |
| Writes from generated apps | 120 per minute |
| Rows per app | 5,000 |
| Agent tool-call rounds | 12 per generation |

Rate limiting is in-memory (`src/lib/rate-limit.ts`). On serverless each
instance keeps its own counters, so the real ceiling is roughly limit x
instances — a cost guard and an abuse speed bump, not a security control. That
is the right tradeoff for a demo whose public link is writable by anyone;
swapping in a shared store means changing only that one file.

## Model providers

The agent loop is provider-swappable. Nothing above `src/lib/agent/providers/`
knows which model is running — the tool executors, schema validation, runtime
contract, SSE events and UI are all model-agnostic.

| | Claude | Kimi K3 |
| --- | --- | --- |
| Env var | `ANTHROPIC_API_KEY` | `MOONSHOT_API_KEY` |
| Default model | `claude-opus-5` | `kimi-k3` |
| Wire format | Messages API | OpenAI-compatible |
| Reasoning stream | `thinking` blocks | `reasoning_content` deltas |
| Effort levels | low–max (5) | low / high / max |
| Default effort | `high` | `low` (see below) |

Measured on the same prompt, K3 at `high` effort took **473s** and emitted about
10,000 reasoning deltas; at `low` it took **112s** and produced an app of the
same quality — same collections, same seeded rows, the same component kit used
throughout. Since a serverless function is capped at 300s, `low` is the default
for Kimi. Thinking cannot be disabled on K3, so this is less reasoning, not none.

Set the key for whichever you want; if only one is present it is picked
automatically, and `BENCH_PROVIDER` overrides. Adding a third provider means
implementing one interface — `streamTurn` — in `src/lib/agent/providers/`.

The awkward part of the OpenAI-compatible path is that tool arguments arrive as
JSON *fragments* keyed by index across many chunks; parsing any single chunk
yields truncated JSON. `ToolCallAccumulator` handles reassembly and is covered
by tests that need no network.

## Key design decisions

**The agent never writes SQL or DDL.** It declares an `AppSchema` — collections
and typed fields — as *data* (`src/lib/types.ts`). Everything lands in one
generic `records` table scoped by project, validated against the declared schema.
Dynamic `CREATE TABLE` from model output would mean runtime migrations and an
injection surface, for very little added capability at this scale.

**Generated apps get a fixed runtime contract.** Every generated app is handed an
injected `db` client (`db.collection('customers').list() / .create() / …`) and
told about it in the system prompt. The agent fills in a scaffold rather than
inventing a data layer, which is the single biggest lever on output quality and
demo determinism.

**The agent composes against a fixed scaffold.** Every generated app is
injected with `bench/db.ts` (a typed data client plus a `useCollection` hook
that polls, so two people with the same link see each other's rows) and
`bench/ui.tsx` (Page, Card, Table, Modal, Button and friends). The agent writes
`App.tsx` against those instead of inventing a data layer and a design language
on every run. `npm run tools:check` fails the build if the system prompt and the
injected runtime ever drift apart.

**Seeds are buffered until the version commits.** They are validated the moment
the tool is called, so mistakes reach the model while it can still fix them, but
they are only written after the app is saved — a run that dies halfway leaves no
rows behind for an app that never existed.

**The preview talks to Bench over postMessage, not fetch.** Generated code
never sees a project id or a token, and the sandbox origin never has to be
allowed through CORS. Inbound messages are trusted only if their source is a
frame Bench is actually rendering — the generated app posts with targetOrigin
`"*"` because it cannot know ours, so trust runs the other direction.

**Records hang off the project, not the version.** When the agent rewrites the
UI, the data survives. Your data outlives your code edits.

**`projects.currentVersionId` is not a foreign key.** projects ↔ versions would be
circular and force a two-step migration for no real benefit.

## Using it

`/` takes a description (or one of four verified starter prompts) and creates a
project. The workspace is chat on the left, preview on the right: the agent's
work streams in as a timeline — data model declared, each file landing, seed rows
inserted — and the app appears next to it. Follow-up messages edit it in place.

## API surface

| Route | Purpose |
| --- | --- |
| `GET/POST /api/projects` | List your projects, create one |
| `GET/PATCH /api/projects/:id` | Project detail + version list; publish toggle |
| `GET /api/apps/:id/schema` | The app's declared collections and row counts |
| `GET/POST /api/apps/:id/:collection` | Read and create rows in a generated app |
| `PATCH/DELETE /api/apps/:id/:collection/:recordId` | Update and delete rows |
| `POST /api/projects/:id/generate` | Run the agent; streams progress over SSE |

Ownership is an anonymous session cookie minted by `src/proxy.ts` (Next 16
renamed `middleware.ts` to `proxy.ts`). Unpublished projects are visible only to
the session that created them; publishing opens reads *and* writes to anyone
with the link, which is the point: a teammate adds a row and you see it.

## Local setup

```bash
npm install
cp .env.example .env.local   # add your Neon URL and a provider key
npm run db:migrate           # applies drizzle/*.sql to the database
npm run dev
```

`db:migrate` applies the checked-in migrations and needs no terminal input, so
it works in CI and against production. `db:push` diffs the schema directly and
prompts before applying — handy while iterating locally, unusable non-interactively.

Visit `/` for a live status panel, or `/api/health` for the JSON version.

Once the database is up, `npm run smoke` exercises the data spine end to end:
schema validation, coercion, partial updates, project isolation, and the claim
that records survive a version rewrite.

`npm run tools:check` needs neither a database nor an API key: it exercises the
agent's tool layer directly, including every rejection path the model depends on
for self-correction.

## Deploy

1. Push to GitHub.
2. Import the repo on Vercel.
3. Set `DATABASE_URL` and a provider key in project settings.
4. Run `npm run db:migrate` once against the production database.
5. Enable Fluid Compute (Settings → Functions). Without it Hobby caps
   functions at 60s and a generation is killed mid-run.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Emit a SQL migration from the schema |
| `npm run db:migrate` | Apply the checked-in migrations (non-interactive) |
| `npm run db:push` | Diff the schema straight onto the database (prompts) |
| `npm run db:studio` | Browse the database |

## Known issues

`drizzle-kit` pulls a transitively vulnerable `esbuild` (moderate, dev-server
only). Fixing it means downgrading to `drizzle-kit@0.18`, which is a breaking
change for a dev-only dependency — not worth it here.

Sandpack bundles in the browser against a remote bundler, so the preview needs
network access. It works in any normal browser; it does not work offline.
