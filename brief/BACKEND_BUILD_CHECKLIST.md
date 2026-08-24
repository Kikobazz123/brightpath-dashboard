# BRIGHTPATH BACKEND CHECKLIST

Ticked items name the file that satisfies them, so a claim here can be checked
rather than taken on trust.

- [x] Inspect repository and existing backend
- [x] Confirm persistence — `src/lib/db/schema.ts`, Neon, `drizzle.config.ts`
- [x] Lead model — `leads` table, `leadSchema` in `src/lib/contracts/leads.ts`
- [x] Lead intake — `POST /api/v1/leads`, `src/lib/pipeline/intake.ts`
- [x] Lead import — `POST /api/v1/leads/import`, per-row failure isolation
- [x] Field normalization — `normalizeIntake()`; raw text kept alongside
- [x] Lead analysis — `src/lib/pipeline/analyst.ts`, evidence with verbatim quotes
- [x] Explicit BrightPath qualification criteria — `src/lib/pipeline/rubric.ts`
- [x] Explainable scoring — score reasons, points awarded per rubric line
- [x] Missing-data / NEEDS_REVIEW handling — required signals, confidence floor
- [x] Priority classification — thresholds in `rubric.ts`, not in a prompt
- [x] Personalized follow-up — `src/lib/pipeline/writer.ts`, grounded in evidence
- [x] Next-action recommendation — `src/lib/pipeline/advisor.ts`, one action
- [x] Lead routing / owner or queue — `owner` field, `assignOwner` action
- [x] Follow-up state: drafted/sent/replied/due/overdue — `followUpState`
- [x] Lead status — human-only, `PATCH /api/v1/leads/{id}/status`
- [x] Activity timeline — `activities` table, `GET /leads/{id}/activity`
- [x] Access control — tenant scoping on every query, bearer token with a
      constant-time compare, production refuses to run without a token, and the
      two unauthenticated routes are rate limited (`src/lib/api/rate-limit.ts`)
- [x] Form/CRM/spreadsheet integration boundary — `/webhooks/leads/{source}`,
      `/leads/import`
- [x] Observability — `src/lib/api/observability.ts`: one structured line per
      request with id, route, status and duration; `GET /api/v1/health`
      separates "degraded" (no AI provider) from "unhealthy" (no database)
- [x] End-to-end judge journey test — `scripts/verify-journey.ts`, 20 checks
- [x] Measure response-to-action timing and follow-up state without inventing
      results — `median_first_touch_minutes` is null, never zero, when untouched

## Quality

- [x] No fabricated lead facts — unquotable claims are dropped in `analyst.ts`,
      and the contract rejects a present signal carrying no source span
- [x] No unexplained score — every point traces to a named rubric line
- [x] No false sent/converted/CRM-success claims — `sent` requires a provider
      message id; there is no send button anywhere in the UI
- [x] Missing information surfaced — `missing_information` on every assessment
- [x] Unauthorized access blocked — four cross-tenant checks in verify-journey
- [x] Stable API responses for frontend — one envelope, one error map

## Final integration

- [x] Every frontend action maps to an API — `src/lib/client/actions.ts` is
      named one-for-one against the routes
- [x] Every required backend result has a UI state — evidence, score, missing
      information, draft, next action, status, SLA and timeline all render
- [x] Reconcile gaps after both builds exist
- [x] Run complete BrightPath journey — 38 checks green (18 scoring, 20 journey)

## Known gaps, stated plainly

- **No real auth.** One shared bearer token maps to one tenant. The boundary is
  real and enforced on every query, but there are no user accounts, so the
  template's sign-in pages remain decoration.
- **Rate limiting is per-instance.** In-memory counters, so a serverless cold
  start forgets them. Deliberate, documented, and a Redis swap away.
- **No email integration.** Follow-ups are drafted and copied out by hand. That
  is precisely why `sent` demands a receipt.
- **Webhooks verify no signature.** Any caller can post a lead. Signature
  checking is per-provider work and belongs in each adapter as it is written.
- **AI extraction needs a key.** With `AI_PROVIDER=stub` the pipeline runs but
  extracts nothing, so every newly captured lead reads NEEDS_REVIEW with no
  draft. `pnpm verify:provider` reports whether a configured key actually works.
