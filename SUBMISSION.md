# Bench — 全栈岗位笔试

**Describe an internal tool. Get a working one your team can actually use.**

| | |
| --- | --- |
| Live demo | https://bench-gen-ai.vercel.app |
| A published app | https://bench-gen-ai.vercel.app/p/team-expense-tracker-xg7pua |
| Source | https://github.com/Alvaropar/Bench |
| Model | Kimi K3 (`kimi-k3`), swappable to Claude Opus 5 with one environment variable |

---

## 1. What it is

You describe a tool in plain language. An agent designs the data model,
provisions storage for it, writes the interface, seeds it with realistic rows,
and renders it live. Follow-up messages edit it in place.

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

### The one thing that makes it different

Most prompt-to-UI generators produce a mockup: refresh the page and the data is
gone. **Bench's generated apps are full-stack.** The agent declares a data
model, the platform provisions storage, and the running app reads and writes
real rows.

The demo worth watching: open a published link in two windows, add a row in one,
watch it appear in the other within about a second.

---

## 2. Approach and key tradeoffs

### The agent never writes SQL

The obvious implementation lets the model emit `CREATE TABLE`. That means
runtime migrations, an injection surface, and a schema that can break every app
built before it.

Instead the agent declares an **`AppSchema`** — collections and typed fields — as
*data*, through a `set_schema` tool. One generic `records(project_id, collection,
data JSONB)` table stores everything, and a zod validator is generated per
collection from that declaration. Roughly 90% of the capability for 10% of the
risk.

The cost is real: no joins, no per-app indexes, no SQL for generated apps. See
§5 — it is the limitation that bites first.

### A fixed runtime contract is the biggest lever on output quality

Free-form "generate any React app" produces a different-looking app every run
and a lot of broken layout. Every generated app is instead injected with a
scaffold it must build against:

| Injected file | What it gives the agent |
| --- | --- |
| `bench/db.ts` | Typed data client + `useCollection`, which keeps rows live |
| `bench/ui.tsx` | Page, Card, Table, Modal, Badge, Field, uploads, rich text |
| `bench/charts.tsx` | Bar, Line, Donut, Sparkline, plus `countBy` / `sumBy` |
| `bench/router.tsx` | Hash routing: `Routes`, `Route`, `Link`, `useParams` |
| `bench/inspect.ts` | The click-to-edit picker |

The agent composes rather than invents. Output quality rose sharply and demos
became repeatable.

**Because polling lives inside `useCollection`, multi-user is automatic.** The
agent never reasons about it, and the two-window demo works without ever being
asked for.

### The contract is enforced by tests, not discipline

If the prompt documents something the scaffold does not provide, generated apps
break in a way the agent cannot see. Two guards, and the second exists because
the first was not enough:

1. **Export drift** — every export of the injected runtime must appear in the
   system prompt. This caught `assetUrl` the day it was added.
2. **Prop drift** — every prop a component takes must be *shown* in the prompt.
   This exists because a real bug got through: the prompt named `Modal` without
   showing its props, the model reached for the near-universal `open`, the kit
   ignored it, and users got a dialog they could not close. The contract is not
   "which components exist" but "which props they take" — and a model will
   confidently invent the half you leave unspecified.

### Data outlives code

`records` hangs off the **project**, not the version. When the agent rewrites
the UI — or you restore an older version, or hand-edit a file — the rows survive.

### Seeds validated immediately, written last

`seed_data` validates on the tool call, so a bad row reaches the model while it
can still correct itself; rows are inserted only after the version commits. A
run that dies halfway leaves nothing behind for an app that never existed.

### The preview talks over postMessage, not fetch

Generated code never sees a project id or a token. It posts to its parent, Bench
resolves the request against the records API, and posts back. No CORS with the
sandbox origin, no credentials in generated source. Trust runs *inbound*: a
message is honoured only if its source is a frame Bench is actually rendering.

### A manual agent loop, not a vendor tool runner

The SDK tool runners drive tool calls well, but this loop needs three things
they do not expose cleanly: ordered domain events per tool call (for the
timeline), file state mutating across the whole run, and exactly one version
commit at the end. That cost about eighty lines and bought all three.

### Provider-swappable

The loop runs against a `Provider` interface, not an SDK. Nothing above
`src/lib/agent/providers/` knows which model is running.

| | Claude | Kimi K3 |
| --- | --- | --- |
| Wire format | Messages API | OpenAI-compatible |
| Reasoning stream | `thinking` blocks | `reasoning_content` deltas |
| Tool results | one batched message | one message per call |
| Default effort | `high` | `low` (see §3) |

The awkward part of the OpenAI-compatible path: tool arguments arrive as JSON
**fragments** keyed by index across many chunks, so parsing any single chunk
yields truncated JSON. `ToolCallAccumulator` is extracted from the stream loop
specifically so it can be tested without a network call.

### Rejection messages are the model's only correction signal

Every tool failure names the specific problem: which field, which row, how many
times a string matched, which files exist. Unknown keys are **rejected, not
stripped** — an undeclared field means the UI and schema have drifted, and a 422
naming the field gives the self-healing loop something to act on.

---

## 3. Three findings that only came from running it

**473s → 112s.** The first real K3 generation took 473 seconds and emitted about
10,000 reasoning deltas, past the 300s ceiling a serverless function gets. At
`reasoning_effort: low` the same prompt took 112 seconds and produced an app of
the same quality — same collections, same seeded rows, same components. So the
effort default is provider-aware.

**Seeded dates landed a year in the past.** A vendor tracker seeded renewals for
2026-01 through 2026-06 against a real date of 2026-08-27, so the "upcoming
renewals" panel was empty and a correctly implemented feature had nothing to
show. The model cannot know the date; the context block now carries it.

**A large app can outrun the clock.** Three collections with uploads, charts and
detail pages measured 222s. Past 300s the function is killed with no warning —
the stream stops and the interface looks like nothing happened. The cost is
output generation, not the prompt, which is only ~2,900 tokens a turn. Bench now
stops itself at 200s with an explanation, and the browser reports a truncated
stream instead of going quiet.

---

## 4. What is done

| Area | |
| --- | --- |
| Prompt → generate → preview → iterate | ✅ |
| Real, shared persistence for generated apps | ✅ |
| Accounts: register, sign in, cross-device | ✅ |
| Publish to `/p/<slug>` with shared multi-user data | ✅ |
| Data view — the app's rows as a table | ✅ |
| Version history with restore | ✅ |
| Self-healing — preview errors fed back to the agent | ✅ |
| Click-to-edit — select an element, describe the change | ✅ |
| Charts and multi-screen routing | ✅ |
| Rich text, image and file uploads | ✅ |
| File tree, in-browser editing, download as a runnable project | ✅ |
| Provider-swappable agent (Claude / Kimi K3) | ✅ |
| Rate limits, row ceilings, error boundaries, CI | ✅ |

### Verified, not merely written

| Suite | Assertions | Needs |
| --- | --- | --- |
| `npm run tools:check` | 81 | nothing — no database, no API key |
| `npm run smoke` | 43 | a database |
| `npm run check:app <id>` | type-checks one generated app against the scaffold | a database |

Both run green. CI runs lint, typecheck, `tools:check` and a build on every
push.

Checked directly against production, not locally:

- **A full generation** — 99s, two collections, 15 seeded rows, published and
  read by a fresh session immediately.
- **Shared data across two sessions** — stranger gets 404 before publishing, 201
  on a write after, and the owner sees that row. Unpublishing revokes both.
- **Accounts** — built a project anonymously in one browser, registered, then
  signed in from a second browser with no shared cookie and reached the same
  project. Duplicate email returns 409; an unknown email and a wrong password
  return byte-identical errors, so responses cannot enumerate accounts.
- **Uploads** — a PNG uploads and serves with `nosniff` and a locked CSP; SVG
  and HTML are refused with 422.
- **Rich text** — `<script>` stripped on write, `<strong>` kept.
- **Rate limiting** — request 21 of 21 returns 429 with the retry window.
- **The ZIP writer** — validated against Python's `zipfile`: CRCs valid, nested
  paths preserved, UTF-8 byte-exact including CJK.

---

## 5. What is not done

- **The schema is flat.** No relations, so a link between collections is a name
  string rather than a foreign key. In one real generation the agent worked
  around this by seeding placeholder ids and writing a client-side migration to
  re-link them on first load — a hack that runs on every viewer's load. This is
  the limitation real internal tools hit first.
- **Publishing is all-or-nothing.** Accounts exist, but there is no "these
  people can write, everyone else can read".
- **Accounts are email and password only** — no verification, reset or OAuth,
  all of which need an email provider this does not have.
- **Collaboration is ~1s, not sub-second.** A change token polled every second,
  not a push.
- **Uploads live in Postgres as base64**, capped at 1.5MB per file and 40MB per
  app. Fine at this size, wrong at any real one — but only two routes change.
- **The editor is a textarea.** No highlighting: a real code editor is a
  megabyte-scale dependency, and edits here are corrections to agent output.
- **No toolchain in the browser.** Bench never runs `npm install`, a linter or a
  bundler. The exported project has a real one; it runs on your machine.
- **Generated apps cannot reach the outside world.** No HTTP from the sandbox,
  so tools needing live external data are out of scope by construction.
- **Rate limiting is in-memory.** Per-instance counters make it a cost guard and
  an abuse speed bump, not a security control.
- **A large app can hit the time limit** (§3).

---

## 6. If I kept going

1. **Relations between collections.** A `reference` field type. Everything else
   on this list is an improvement; this one is a capability the product is
   missing, and I have a real generation showing the agent inventing a migration
   to work around its absence.
2. **Type-check generated apps automatically.** `npm run check:app` exists and
   found three real prop mismatches the first time it ran; wiring it into the
   generation loop would let the agent fix its own type errors before anyone
   sees the app.
3. **Per-app permissions.** Publishing is a single switch; teams need reader and
   writer roles before this is usable beyond a demo.
4. **Streaming file writes.** Files appear when a tool call completes. Streaming
   them as they are written makes a long generation *feel* half as long, which
   matters more than making it faster.
5. **A shared rate-limit store and per-project token budgets.** Required before
   this could be public rather than demoed.
6. **Syntax highlighting.** Editing works; reading a 15,000-character file in one
   colour is the part that hurts.

I would not add generation *breadth* before 1 and 2. A narrow tool that works
every time is worth more than a wide one that works sometimes.

---

## 7. Engineering notes

**Stack** — Next.js 16 (App Router) · Neon Postgres + Drizzle · Kimi K3 /
Claude Opus 5 with tool use · Sandpack · Tailwind 4 · Vercel.

**Shape** — ~9,000 lines of TypeScript across 73 files. No state library, no
component library, no charting library, no zip library: each was considered and
each would have cost more than it returned at this size.

**Limits**

| Action | Limit |
| --- | --- |
| Generations | 30 per 15 min |
| New apps | 40 per hour |
| Writes from generated apps | 120 per minute |
| Rows per app | 5,000 |
| Uploads | 1.5MB per file, 40MB per app |
| Agent tool-call rounds | 12 per generation |

---

## 8. Running it

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
| `npm run smoke` | Data spine and accounts against a real database |
| `npm run tools:check` | Agent layer — no database or API key needed |

**Deploying** — import the repo on Vercel, set `DATABASE_URL` and
`MOONSHOT_API_KEY` (or `ANTHROPIC_API_KEY`), run `npm run db:migrate` once
against production, and enable Fluid Compute so functions are not capped at 60s.
