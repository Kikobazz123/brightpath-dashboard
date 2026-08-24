# BRIGHTPATH BACKEND SCOPE

## Fresh-project rule
This is a new BrightPath Solutions sales-assistant build. The case-study PDF is authoritative.

## Pain points
- Leads arrive through multiple channels.
- Sales cannot respond quickly to every lead.
- High-potential prospects can miss timely follow-up.
- Representatives spend too much time reviewing lead information.
- Representatives spend too much time writing follow-up messages.

## Required capabilities
- Lead capture and organization
- Lead analysis
- Lead scoring/classification
- Personalized follow-up generation
- Next-action recommendation
- Lead status tracking

## Judge demonstration
1. Capture/upload lead.
2. AI reviews and qualifies.
3. Show clear score/priority.
4. Show personalized sales message.
5. Show recommended next action.
6. Show status/progress.

## Qualification standard
The scoring system must use explicit BrightPath qualification criteria rather than letting the model decide ad hoc what a "good" lead means.

The core signals are:
- company size/fit
- industry/fit
- budget
- need
- interest/intent

Missing evidence must reduce confidence or trigger `NEEDS_REVIEW`; it must never be silently guessed.

The system should distinguish evidence, AI recommendation, and final sales status.

## System shape
Frontend: BrightPath website.
Backend: API + AI orchestration + persistence + integration boundaries.
AI roles: Lead Analyst, Qualification/Scoring, Follow-Up Writer, Next-Action Advisor.
Deterministic support: lead routing/ownership, status, activity and follow-up state.
Human: Sales representative.

## Sales-assistant operating standard
The assistant should help prevent the exact failure in the case study: a valuable lead arriving and then waiting.

Therefore the backend must make priority, owner/queue, next action, and follow-up state visible and queryable.

## Non-core
Do not make these core: LordGen consulting diagnostic flow, three-category diagnostic system, automation marketplace, developer handoff, automation blueprint agent, PDF generation, broad delivery workflow, self-improving AI OS, or voice phone agent.

## Principle
Solve the stated BrightPath sales pain first. Do not add features merely because they existed in another project.
