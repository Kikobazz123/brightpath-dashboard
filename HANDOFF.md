# BrightPath — session handoff

Both build sessions were interrupted by an API 529 on 2026-08-24. Nothing was
lost: every change was uncommitted at the time and has since been committed and
pushed. This file records exactly where each session stopped.

## Repository layout

Two sessions ran against two working trees:

| Session | Local path | Repo | Last write |
|---|---|---|---|
| 1 — backend | `AIOS/projects/admin-dashboard` | `brightpath-backend` | 00:28 |
| 2 — frontend | `AIOS/projects/admin-dashboard-ui` | `brightpath-dashboard` | 01:48 |

Session 2's tree was branched from session 1's around 00:48, so it contains the
whole backend **byte-identical** plus the UI work. `brightpath-dashboard` is the
superset and is where work should continue. `brightpath-backend` is kept only as
the untouched record of session 1.

Both repos start from the same pristine upstream commit
(`shadcnstore/shadcn-dashboard-landing-template`, nextjs-version, MIT), but were
initialised separately, so their histories are unrelated.

## Session 1 — backend (complete, unverified)

~4,200 lines across 33 files. Timeline: API routes 23:53 → rubric/scoring/
advisor 00:02–00:05 → verify-scoring 00:07 → seed 00:09 → verify-journey 00:25 →
db-status 00:28, then the session died.

Built:

- **Persistence** — Drizzle schema for leads, activity and follow-up state
  (`src/lib/db/schema.ts`), Neon serverless connection (`src/lib/db/index.ts`),
  `drizzle.config.ts`.
- **Contracts** — Zod schemas shared by routes and service
  (`src/lib/contracts/leads.ts`), so an HTTP caller and a Server Component
  validate against one definition.
- **Transport** — response envelope, error mapping, bearer auth
  (`src/lib/api/http.ts`).
- **Pipeline** — `intake → analyst → scoring/rubric → writer → advisor`. Scoring
  uses an explicit BrightPath rubric (company size/fit, industry fit, budget,
  need, intent) rather than letting the model decide what "good" means; missing
  evidence lowers confidence or triggers `NEEDS_REVIEW` instead of being guessed.
- **AI provider** — provider-agnostic (`src/lib/ai/provider.ts`) with gemini /
  groq / openrouter / anthropic adapters and a **stub mode that is the current
  default**, so the whole journey runs end-to-end with no API key.
- **API v1** — 12 routes under `src/app/api/v1/`: leads list/create/import, lead
  detail, analyze, score, follow-up, confirm-send, next-action, status,
  activity, stats, and per-source webhooks.
- **Scripts** — `seed`, `db-status`, `verify-scoring`, `verify-journey`.

### Where it stopped

It finished writing its verification tooling and never ran it. The last file
written was `scripts/db-status.ts`, a diagnostic — consistent with being about to
check the database when the 529 hit.

**Open items:**

1. No end-to-end run against a live database has happened. `DATABASE_URL` points
   at a Neon project in `.env.local`, but the schema was never confirmed pushed
   and `verify-journey.ts` was never executed.
2. The scripts have no npm entries. `tsx` and `drizzle-kit` are installed but
   `package.json` still has only `dev`/`build`/`start`/`lint`. Run them as
   `pnpm tsx scripts/seed.ts` until scripts are added.
3. Checklist items from `BACKEND_BUILD_CHECKLIST.md` not yet evidenced in code:
   access control beyond the shared demo token, and observability.

## Session 2 — frontend (stopped mid-task)

44 files, +1571/−982. Timeline: route templates 00:59 → count-up 01:00 →
dashboard cards 01:05–01:13 → tasks 01:17 → landing rebuild 01:21–01:44 →
upgrade button 01:47 → `server-data.ts` 01:48, then the session died.

Built:

- **Landing** rebranded to BrightPath Solutions — hero, stats, logo carousel,
  about, features, pricing, FAQ, CTA, navbar, footer, contact. Blog, team and
  testimonials sections deleted as off-scope for the sales-assistant demo.
- **Brand tokens** in `src/app/globals.css`; site metadata in `src/config/site.ts`.
- **Auth pages** — sign-in, sign-up and forgot-password, all three variants.
- **Dashboard chrome** — section cards, metrics overview, user stat cards,
  sidebar, site header/footer, logo, upgrade button.
- **Motion** — route `template.tsx` for `(dashboard)` and `landing`, plus
  `src/components/motion/count-up.tsx`.
- **`src/lib/client/server-data.ts`** — cached read accessors (`fetchStats`,
  `fetchLeads`, `fetchLead`, `fetchActivity`) that call the service layer
  directly rather than round-tripping through the app's own HTTP API.

### Where it stopped

Mid-task, on the data layer. `server-data.ts` was the very last file written and
the UI is not yet connected to anything real.

**Open items, in the order the session was heading:**

1. **`src/lib/client/actions.ts` does not exist.** `server-data.ts` says
   "Mutations live in `./actions`" — that file was next and was never written.
   It needs Server Actions for analyze, score, follow-up, confirm-send,
   next-action and status.
2. **Nothing imports `server-data.ts`.** It has zero consumers; no page is wired
   to real data.
3. **There is no leads UI at all.** `src/app/(dashboard)/` still holds the
   template's screens (calendar, chat, mail, tasks, users…). The judge journey
   in `BACKEND_SCOPE.md` — capture → qualify → score → message → next action →
   status — has no interface.
4. Dashboard cards are restyled but still render template numbers, not
   `fetchStats()`.

## Suggested next step

Resume in `brightpath-dashboard`. The backend is ahead of the frontend, so the
highest-value move is to close the gap the checklist calls "reconcile gaps after
both builds exist": write `actions.ts`, add a leads list and lead detail page
that consume `server-data.ts`, then run `verify-journey.ts` against a seeded
database to confirm the demo path end to end.

## Local safety copy

A source-only archive of both trees, taken before any of this was committed, is
at `AIOS backup/brightpath-source-20260824-021844.tgz` (19 MB, excludes
`node_modules`/`.next`, includes both `.git` directories and the real
`.env.local` files).

## Secrets

`.gitignore` keeps `.env*` out of git, with an explicit `!.env.example`
exception so the documented config template is tracked. Real values in
`.env.local` — the Neon `DATABASE_URL` and the demo token — were never committed
and are not on GitHub. `.env.example` contains placeholders only.

---

# Addendum — full-project audit (2026-08-24, after the second interruption)

A disk-wide sweep was run to confirm nothing about this project lives outside
the two repos.

## What the sweep found

**No stray code.** The only BrightPath-named things outside the repos are this
project's memory files, the safety archive, a Windows recent-items shortcut, and
the brief in Downloads. All application code was already committed and pushed.

**The brief was not in version control.** `CLAUDE.md`, `BACKEND_SCOPE.md` and
`BACKEND_BUILD_CHECKLIST.md` lived only in
`C:\Users\USER\Downloads\Lordgen main files\Brightpath solution\`. They are the
source of truth for the build and were one deleted folder away from being lost.
They are now committed: `CLAUDE.md` at the repo root (so Claude Code loads it
automatically) and the other two under `brief/`.

**The case-study PDF is not on this machine.** `CLAUDE.md` calls "the BrightPath
case study/PDF" the source of truth, but no such PDF exists anywhere in the user
profile. It is presumably still in email or the competition portal. Worth saving
into `brief/` so the repo is genuinely self-contained.

## Project context recovered from session memory

This is **AI BuildFest 2026, Track 1, Case Study 2** — a competition build.

The original intent was that **both sessions share the single `admin-dashboard`
repo**, split by path: backend owned `src/lib/**`, `src/app/api/v1/**`,
`scripts/**`, `drizzle*`; frontend owned the landing page and
`src/app/(dashboard)/**`. In practice the frontend session copied the tree to
`admin-dashboard-ui` at 00:48 instead of working in place. Nothing was lost —
the backend files are byte-identical across both — but it means
`brightpath-dashboard` is the one repo the original plan called for, and
`brightpath-backend` is a frozen snapshot rather than a parallel line of work.

Neon project `brightpath` = `weathered-haze-95690617`.

### The design decision the build rests on

The model extracts *evidence* (each fact carrying the verbatim quote it came
from); deterministic code in `src/lib/pipeline/scoring.ts` computes the score
against `rubric.ts`. The brief demands explicit criteria and explainable scores,
and a model-emitted number is neither — it drifts between runs and cannot be
audited. It also makes the build nearly free to run.

**Never move scoring into a prompt.** Policy changes belong in `rubric.ts` with a
version bump. Two gates exist there because a plain weighted sum got them wrong:
an explicit "no budget" disqualifies outright, and HIGH priority requires a
*stated* problem.

## Verification status

`npx tsx scripts/verify-scoring.ts` — **18 passed, 0 failed** (run 2026-08-24).
No database or network required. It confirms determinism across 200 runs,
order-independence, rubric traceability, NEEDS_REVIEW on missing evidence, both
gates, and that fabricated evidence is rejected by the contract.

`npx tsx --env-file=.env.local scripts/verify-journey.ts` — **never run.** 20
checks against a real database, self-cleaning. This is still the outstanding
verification and the first thing to do on resuming.

## Spec compliance check

All ten API endpoints required by `CLAUDE.md` exist with the specified verbs,
plus the optional `POST /webhooks/leads/{source}` and an extra `/stats` and
`/leads/{id}/confirm-send`. All three specified tables exist in the schema:
`leads`, `activities`, `analysisRuns`.

Gaps against the brief, unchanged from above: no end-to-end run against a live
database; access control is still a single shared demo token; observability is
not evidenced; and the whole frontend half of "every frontend action maps to an
API" is outstanding.

## Operational note — the scripts have no npm entries

`tsx` and `drizzle-kit` are installed but `package.json` still lists only
`dev`/`build`/`start`/`lint`. Until entries are added, invoke the tooling
directly:

    npx tsx scripts/verify-scoring.ts
    npx tsx --env-file=.env.local scripts/db-status.ts
    npx tsx --env-file=.env.local scripts/seed.ts
    npx tsx --env-file=.env.local scripts/verify-journey.ts
