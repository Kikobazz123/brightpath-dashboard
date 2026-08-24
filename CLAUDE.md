# CLAUDE.md — BrightPath AI Sales Assistant Backend

## PROJECT RESET
This is a FRESH BUILD commissioned for BrightPath Solutions.
The BrightPath case study/PDF is the source of truth. Do not treat this as the previous LordGen automation project. Do not import unrelated LordGen workflows, demo businesses, consulting diagnostics, PDF/report flows, automation catalogs, or AI-OS features unless they directly support this case.

## CLIENT PROBLEM
BrightPath Solutions provides software and professional services to SMBs. Leads arrive from its website, referrals, social media, events, and advertising campaigns. The sales team struggles to respond quickly to every lead; high-potential prospects can miss timely follow-up; representatives spend significant time reviewing lead information and writing follow-up messages.

## REQUIRED SOLUTION
Build an AI sales assistant that:
1. Captures and organizes lead information from a form, spreadsheet, CRM, or other source.
2. Analyzes company size, industry, budget, need, and interest.
3. Scores/classifies leads by likelihood to become customers.
4. Generates personalized follow-up emails/messages.
5. Recommends the next sales action.
6. Tracks current lead status.

## JUDGE FLOW
Lead arrives -> capture/normalize -> AI reviews/qualifies -> clear score/priority -> personalized message -> recommended next action -> status/progress.

## QUALIFICATION STANDARD
Do not let the model invent its own definition of a good lead. BrightPath's qualification policy must be explicit and configurable.

Minimum qualification signals:
- company fit / size
- industry fit
- need/problem fit
- budget or budget availability
- level of interest / intent

Where information is missing, return `NEEDS_REVIEW` or request the missing information rather than guessing.

Keep three separate concepts:
- evidence extracted from the lead
- AI recommendation/score
- final sales disposition/status

The score must be explainable: show the main positive/negative signals that produced it.

## CORE BACKEND MODULES
1. Lead Intake: accept form/import/integration data and normalize it.
2. Lead Analysis: extract company size, industry, budget, need, interest, source and context; never invent missing facts.
3. Qualification & Scoring: return score, HIGH/MEDIUM/LOW priority, qualification status, reasons/evidence, missing information and confidence.
4. Follow-Up Writer: create personalized subject/message from known lead context.
5. Next-Action Advisor: recommend one primary next step such as schedule call, send information, request information, follow up later, or route to a representative.
6. Status/Activity: maintain lead stage and timeline.
7. Routing/Ownership: assign or recommend the appropriate sales representative/queue so high-priority leads do not disappear.
8. Follow-Up State: record whether follow-up is drafted, approved, sent, replied-to, due, or overdue. Do not claim a message was sent unless a real sending integration confirms it.

## AGENTS
Keep this small; do not build a swarm.
- Lead Analyst
- Qualification & Scoring
- Follow-Up Writer
- Next-Action Advisor

Supporting deterministic services:
- Intake
- Persistence
- Status/CRM state
- Activity/audit
- Integration adapters

Human role:
- Sales representative remains the operator/decision-maker.
- AI prepares qualification, context, drafts and recommendations; the representative owns consequential sales decisions.

## SCOPE DISCIPLINE
Do not add features merely because they are technically interesting or appeared in another project. In particular, do NOT add blueprint systems, animation/video requirements, developer-handoff workflows, consulting diagnostics, PDF/report generation, marketplace features, self-improvement loops, or voice calling unless a later BrightPath requirement explicitly requires them.

## DATA MODEL
Lead: id, source, contact, company, company_size, industry, budget, need, interest_level, raw_context, normalized_context, score, priority, qualification_status, score_reasons, missing_information, recommended_action, follow_up_subject, follow_up_message, status, owner, created_at, updated_at.

Activity: id, lead_id, type, actor, payload, timestamp.

AnalysisRun: id, lead_id, stage, input_reference, output, confidence, status, timestamps.

## API
Use /api/v1.
Minimum:
POST /leads
POST /leads/import
GET /leads
GET /leads/{id}
PATCH /leads/{id}
POST /leads/{id}/analyze
POST /leads/{id}/score
POST /leads/{id}/follow-up
POST /leads/{id}/next-action
PATCH /leads/{id}/status
GET /leads/{id}/activity

Optional integration boundaries:
POST /webhooks/leads/{source}
POST /integrations/{provider}/events

## AI RULES
Reason only from supplied information. Distinguish facts from assumptions. Explain scores. Personalize communication. Recommend one clear next action. Surface missing information.

Never fabricate company details, budgets, interest, qualification, sent messages, CRM changes, conversions, or integration success.

## HUMAN CONTROL
The assistant supports the sales representative; it does not replace them. Require human review before consequential outbound actions unless an explicitly configured automation is authorized.

## SECURITY
Validate input. Protect tenant/lead access. Never log or return passwords, API keys, access tokens or private credentials. Keep secrets outside lead records.

## BUSINESS OUTCOME / MEASUREMENT
Track enough state to evaluate whether the assistant actually solves BrightPath's pain:
- time from lead arrival to first useful sales action
- lead priority/qualification
- follow-up completion and overdue follow-ups
- next-action recommendation
- eventual disposition when known

Do not invent performance numbers. These are system fields/events for measurement, not claims.

## TESTING
Test: lead creation/import, normalization, analysis, scoring/reasons, follow-up draft, next action, status/activity, invalid input, unauthorized access, missing information, and truthful execution states.

## BUILD DISCIPLINE
Inspect first. Reuse only what fits. Build the smallest complete vertical slice. Test it. Expand only when a BrightPath requirement is unmet. Keep backend independent of frontend styling.

## DEFINITION OF DONE
A BrightPath lead can enter the system, be analyzed and qualified, receive a transparent score/priority, get a personalized follow-up draft, receive a clear next-action recommendation, and have its status tracked. The build is judged against the BrightPath case requirements, not against unrelated LordGen features.
