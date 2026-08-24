# Deploying BrightPath

The flow is **local → GitHub → Vercel**: you push to `master`, Vercel builds
from the repo, nothing is uploaded by hand. This is set up and running —
<https://brightpath-dashboard.vercel.app>.

The two steps Vercel will not let an API do on your behalf are connecting the
GitHub account and entering secrets, so those are recorded here for when they
need doing again.

---

## 1. Connect GitHub to Vercel — **done**

Already set up, and live at <https://brightpath-dashboard.vercel.app>. Kept here
because it is the step that blocks everything else if the link is ever lost, and
because it is the one part of this that is not obvious.

The confusion is that two different things are both called "connecting GitHub":
linking a GitHub identity to your Vercel *login*, and installing the Vercel
GitHub *App* so Vercel can read your repositories. You need the second. The repo
is **private**, so there is no public-URL shortcut.

1. Go to <https://vercel.com/new>.
2. Under **Import Git Repository**, choose **Add GitHub Account** (or
   **Configure GitHub App** if it is already partly set up).
3. Authorise Vercel for the `Kikobazz123` account.
4. Grant it access to `brightpath-dashboard` specifically, or to all repos.

If a project named `brightpath-dashboard` already exists but shows no connected
repo, delete it first — Settings → General → Delete Project. A half-created
project cannot be re-linked, only replaced.

## 2. Import the repo

Back on <https://vercel.com/new>, import `Kikobazz123/brightpath-dashboard`.

Everything auto-detects correctly — Next.js, `pnpm build`, default output. Do
not override the build settings.

**Do not deploy yet.** Add the environment variables first, or the first build
will produce a site where every lead page returns a 500.

## 3. Environment variables

On the import screen, expand **Environment Variables**. Add each of these to
**all three** environments (Production, Preview, Development).

Copy the values from your local `.env.local` — that file is gitignored and its
real values have never been committed.

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | The Neon connection string from `.env.local` | **Yes** |
| `DEMO_API_TOKEN` | The token from `.env.local` | **Yes** |
| `DEMO_TENANT_ID` | `brightpath` | **Yes** |
| `AI_PROVIDER` | `gemini` | Yes, to analyse leads |
| `GEMINI_API_KEY` | From <https://aistudio.google.com/apikey> | Yes, with the above |
| `GEMINI_MODEL` | `gemini-3.6-flash` | No — this is the default |
| `AI_FALLBACK_PROVIDER` | `groq` | Strongly recommended — see below |
| `GROQ_API_KEY` | From <https://console.groq.com/keys> | With the above |
| `SLA_FIRST_TOUCH_MINUTES` | `15` | No — this is the default |
| `DEMO_ACTOR` | `rep` | No — this is the default |
| `CAPTURE_RATE_LIMIT` | `20` | No — this is the default |
| `WEBHOOK_RATE_LIMIT` | `60` | No — this is the default |

Two of these are load-bearing in ways worth knowing:

- **`DEMO_API_TOKEN` is not optional in production.** Left unset, the app
  refuses every API request rather than falling open. That is deliberate: a
  forgotten variable should not publish the lead database to the internet.
- **Without `GEMINI_API_KEY`, the app still runs** — but `AI_PROVIDER` falls
  back to stub, and every newly captured lead comes back `NEEDS_REVIEW` with no
  drafted message. The pre-seeded demo leads keep their scores. `/api/v1/health`
  reports this as `degraded` rather than pretending to be fine.

### Why the fallback is worth five minutes

`AI_PROVIDER` on its own is a single point of failure. Gemini's free tier has a
daily cap, and when it is reached every lead captured until it resets comes back
`NEEDS_REVIEW` with no drafted message. Nothing errors and nothing is lost — the
system degrades honestly — but the assistant stops assisting, and it will happen
at the busiest moment rather than a convenient one.

Setting `AI_FALLBACK_PROVIDER="groq"` with a Groq key means a rate limit, a
quota, or an outage on Gemini rolls over to Groq automatically, per request. Use
a different provider rather than a second Gemini key: two keys on one account
share the quota you are trying to survive.

Then run `pnpm verify:provider`. It calls the fallback directly, with no safety
net, so a bad key or a retired model name fails in that check rather than on the
day the primary goes down.

## 4. Deploy

Hit **Deploy**. The build takes about a minute.

From then on, every `git push origin master` triggers a production deploy, and
every other branch gets a preview URL. That is the whole workflow — there is
nothing to run locally to ship.

---

## Verifying a deployment

```bash
curl https://<your-deployment>.vercel.app/api/v1/health
```

Three answers, three meanings:

- `"status": "ok"` — database reachable, AI provider configured. Everything works.
- `"status": "degraded"` — 200, database fine, but `AI_PROVIDER` is `stub`. The
  app serves and the seeded leads look right; new leads will not be analysed.
- `"status": "unhealthy"` — 503. `DATABASE_URL` is wrong or Neon is unreachable.
  Nothing will work.

Then open the app itself:

- `/dashboard` — pipeline tiles, work queue, response-time summary
- `/leads` — the triage list, with filters in the URL
- `/leads/new` — capture a lead and watch the assistant run

Every request logs one structured JSON line and returns an `x-request-id`
header, so a specific failure can be found in Vercel's runtime logs by id.

---

## Checking your AI key before you rely on it

A wrong key, a model name that does not exist for your account, or a schema the
provider rejects all surface as the same thing: leads that come back
`NEEDS_REVIEW` with no explanation, because the pipeline is designed to degrade
rather than lose a lead. This makes the failure loud instead:

```bash
pnpm verify:provider
```

It makes one real call using a sample lead that states all five qualification
signals, then prints which provider answered, what it extracted, the score that
followed, and the drafted message. It exits non-zero if the answer came from
the stub.

## Verifying the whole system

```bash
pnpm verify:scoring    # 18 checks, no database, no network, no key
pnpm verify:journey    # 20 checks against a real database, self-cleaning
```

`verify:journey` creates its own throwaway tenant and deletes it afterwards, so
it is safe to run against the same database the demo uses.

---

## Notes for a real deployment

Things that are fine for a competition demo and would need attention before
this held real customer data:

- **Auth is one shared token.** Tenant scoping is real and enforced on every
  query, but there are no user accounts. `authenticate()` in
  `src/lib/api/http.ts` is the single place that changes.
- **Rate limit counters are per-instance.** Serverless functions do not share
  memory, and a cold start forgets the count. Move
  `src/lib/api/rate-limit.ts` to Redis or Vercel KV.
- **Webhooks verify no signature.** Any caller can post a lead to
  `/api/v1/webhooks/leads/{source}`.
- **Neon may cold-start.** On the free tier the first request after idle can
  take a few seconds while the compute wakes. Worth one warm-up request before
  demoing.
