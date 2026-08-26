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
| 1 | Projects, messages, records API | — |
| 2 | Agent loop with tool use | — |
| 3 | Live preview + injected `db` SDK | — |
| 4 | Publish, shared data, version history, self-healing | — |

## Stack

- **Next.js 16** (App Router) on Vercel
- **Neon Postgres** + **Drizzle ORM**
- **Anthropic SDK** with tool use for the generation agent
- **Sandpack** as the preview runtime
- **Tailwind 4**

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

**Records hang off the project, not the version.** When the agent rewrites the
UI, the data survives. Your data outlives your code edits.

**`projects.currentVersionId` is not a foreign key.** projects ↔ versions would be
circular and force a two-step migration for no real benefit.

## Local setup

```bash
npm install
cp .env.example .env.local   # add your Neon URL and Anthropic key
npm run db:push
npm run dev
```

Visit `/` for a live status panel, or `/api/health` for the JSON version.

## Deploy

1. Push to GitHub.
2. Import the repo on Vercel.
3. Set `DATABASE_URL` and `ANTHROPIC_API_KEY` in project settings.
4. Run `npm run db:push` once against the production database.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Emit a SQL migration from the schema |
| `npm run db:push` | Apply the schema to the database |
| `npm run db:studio` | Browse the database |

## Known issues

`drizzle-kit` pulls a transitively vulnerable `esbuild` (moderate, dev-server
only). Fixing it means downgrading to `drizzle-kit@0.18`, which is a breaking
change for a dev-only dependency — not worth it here.
