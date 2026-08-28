# Bench

[![CI](https://github.com/Alvaropar/Bench/actions/workflows/ci.yml/badge.svg)](https://github.com/Alvaropar/Bench/actions/workflows/ci.yml)

**Describe an internal tool. Get a working one your team can actually use.**

[**Live demo**](https://bench-gen-ai.vercel.app) ·
[**A published app**](https://bench-gen-ai.vercel.app/p/product-catalog-2aak33) ·
[**Write-up**](./SUBMISSION.md)

You describe a tool in plain language — "a CRM for a small sales team". An agent
designs the data model, provisions storage, writes the interface, seeds it with
realistic rows, and renders it live. Follow-up messages edit it in place.

The difference from a typical prompt-to-UI generator: **generated apps have
real, shared persistence.** Open a published link in two windows, add a row in
one, and it appears in the other.

```
User: "A CRM for a small sales team."
   ↓
Agent  ├── set_schema()   → collections + typed fields provisioned
       ├── write_file()   → UI bound to the injected data client
       ├── seed_data()    → realistic starter rows
       └── summary
   ↓
Live app ──postMessage──▶ Bench API ──▶ records table
   ↓
Publish → /p/<slug> ──▶ the same rows, for everyone with the link
```

## Try it

1. Open the [live demo](https://bench-gen-ai.vercel.app) and click a starter
   prompt — a CRM, an applicant tracker, a bug log, an expense tracker.
2. Watch the timeline: the data model, each file, the seeded rows.
3. When it finishes, **Publish**, then open the link in a private window and add
   a row. It shows up in the first window within a second.
4. Open **Files → Full project → Download .zip** for a runnable Vite project.

## What it can build

Internal tools whose data people type in: trackers, registries, logs, request
queues, light planning. Field types are `text`, `longtext`, `richtext`,
`number`, `boolean`, `date`, `select`, `url`, `email`, `image`, `file`.

It cannot reach the outside world — no HTTP from generated apps — so anything
needing live external data is out of scope by construction.

## Key design decisions

**The agent never writes SQL.** It declares an `AppSchema` — collections and
typed fields — as *data*, and one generic `records` table stores everything with
a zod validator generated per collection. Model-authored DDL would mean runtime
migrations and an injection surface for very little added capability.

**Generated apps compose against a fixed scaffold.** `bench/db.ts` (typed client
plus a `useCollection` hook that keeps rows live), `bench/ui.tsx`,
`bench/charts.tsx`, `bench/router.tsx`. The agent composes rather than invents,
which is the single biggest lever on output quality. Because polling lives
inside the hook, the multi-user property is automatic.

**The contract is enforced by tests.** `tools:check` fails if the prompt
documents an export the scaffold lacks, or a component prop the prompt never
shows. The second guard exists because a real bug got through the first: the
prompt named `Modal` without showing its props, the model reached for the
conventional `open`, and users got a dialog they could not close.

**Records hang off the project, not the version.** Rewrite the UI, restore an
old version, hand-edit a file — the data survives.

**The preview talks over postMessage, not fetch.** Generated code never sees a
project id or a token, and the sandbox origin never needs CORS. A message is
honoured only if its source is a frame Bench is actually rendering.

**The agent loop is provider-swappable.** Nothing above
`src/lib/agent/providers/` knows whether it is talking to Claude or Kimi.

## Taking an app with you

Files browses the source as a tree and switches between what the agent wrote and
the full project around it. Files the agent owns are editable in place — Ctrl/⌘S
saves, and the result becomes a version like any other, validated exactly as the
agent's own writes are.

**Download .zip** produces a standalone Vite project: `npm install && npm run
dev` and it runs on your machine, with your rows as a seed. The only
substitution is the data layer — the exported `bench/db.ts` keeps the identical
API against `localStorage`. The zip writer is hand-rolled and store-only; a
compression dependency buys nothing on tens of kilobytes of text.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /api/auth/{register,login,logout}` | Accounts |
| `GET/POST /api/projects` | List your apps, create one |
| `GET/PATCH /api/projects/:id` | Detail and version list; publish toggle |
| `POST /api/projects/:id/generate` | Run the agent; streams over SSE |
| `POST /api/projects/:id/files` | Save a hand edit as a version |
| `POST /api/projects/:id/restore` | Restore an earlier version |
| `GET /api/apps/:id/schema` | Declared collections and row counts |
| `GET/POST /api/apps/:id/:collection` | Read and create rows |
| `PATCH/DELETE /api/apps/:id/:collection/:recordId` | Update and delete |
| `GET /api/apps/:id/changes` | Change token driving live updates |
| `POST /api/apps/:id/assets` · `GET /api/assets/:id` | Uploads |

Publishing shares the *data*, never the source: running the agent, editing files
and restoring versions stay owner-only.

## Model providers

| | Claude | Kimi K3 |
| --- | --- | --- |
| Env var | `ANTHROPIC_API_KEY` | `MOONSHOT_API_KEY` |
| Default model | `claude-opus-5` | `kimi-k3` |
| Wire format | Messages API | OpenAI-compatible |
| Default effort | `high` | `low` |

Set the key for whichever you want; if only one is present it is picked
automatically, and `BENCH_PROVIDER` overrides. Measured on the same prompt, K3
at `high` took 473s and at `low` took 112s for equivalent output — hence the
different defaults.

## Running it

```bash
npm install
cp .env.example .env.local   # Neon URL + a provider key
npm run db:migrate
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply the checked-in migrations (non-interactive) |
| `npm run db:push` | Diff the schema straight onto the database (prompts) |
| `npm run smoke` | Data spine and accounts against a real database |
| `npm run tools:check` | Agent layer — no database or API key needed |

Visit `/` for a status panel or `/api/health` for the JSON version.

**Deploying** — import on Vercel, set `DATABASE_URL` and a provider key, run
`npm run db:migrate` once against production, and enable Fluid Compute so
functions are not capped at 60s.

## Limits

| Action | Limit |
| --- | --- |
| Generations | 30 per 15 min |
| New apps | 40 per hour |
| Writes from generated apps | 120 per minute |
| Rows per app | 5,000 |
| Uploads | 1.5MB per file, 40MB per app |

Rate limiting is in-memory (`src/lib/rate-limit.ts`). On serverless each
instance keeps its own counters, so it is a cost guard and an abuse speed bump,
not a security control — the right tradeoff for a demo whose public link is
writable by anyone, and a one-file change to move to a shared store.

## Known issues

`drizzle-kit` pulls a transitively vulnerable `esbuild` (moderate, dev-server
only). Fixing it means downgrading to `drizzle-kit@0.18`, a breaking change for
a dev-only dependency.

Sandpack bundles in the browser against a remote bundler, so the preview needs
network access.

A large app — three collections with uploads, charts and detail pages — can take
over 200s and approach the serverless time limit. Bench stops itself with an
explanation rather than being killed mid-stream; the practical answer is to
build in two messages.

## Stack

Next.js 16 (App Router) · Neon Postgres + Drizzle · Kimi K3 / Claude Opus 5 with
tool use · Sandpack · Tailwind 4 · Vercel
