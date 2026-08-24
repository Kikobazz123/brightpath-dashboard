/**
 * Provider-agnostic model access.
 *
 * The pipeline asks for "structured JSON matching this schema" and does not
 * care who answers. That keeps the build cheap — the free tiers are genuinely
 * sufficient here — and means swapping providers is an env var, not a refactor.
 *
 * A deliberate design point: `stub` is a first-class provider, not a test
 * mock. The whole app runs end to end with no key and no network, returning
 * clearly-labelled placeholder evidence. That matters because it means the
 * demo can never fail live for want of a rate limit, and because it forces the
 * rest of the system to cope with low-confidence output honestly.
 */

export type ProviderName =
  | "stub"
  | "gemini"
  | "groq"
  | "openrouter"
  | "anthropic"

export interface GenerateRequest {
  /** Stable across calls — put it first so provider-side caching can bite. */
  system: string
  user: string
  /** JSON Schema the response must satisfy. */
  schema: Record<string, unknown>
  maxOutputTokens?: number
}

export interface GenerateResult {
  json: unknown
  provider: ProviderName
  model: string
  inputTokens: number | null
  outputTokens: number | null
  durationMs: number
  /**
   * Why this result came from the stub rather than the configured provider.
   *
   * Set only on a degraded call. Stages surface it alongside their output so
   * the reason reaches whoever is looking at the lead — an operator seeing
   * "not analysed" is owed the cause, and on a serverless host the log line
   * carrying it may be somewhere they cannot reach.
   */
  degradedReason?: string
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly retryable: boolean,
  ) {
    super(message)
    this.name = "ProviderError"
  }
}

function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback
}

export function activeProvider(): ProviderName {
  const raw = env("AI_PROVIDER", "stub").toLowerCase()
  const known: ProviderName[] = [
    "stub",
    "gemini",
    "groq",
    "openrouter",
    "anthropic",
  ]
  return (known as string[]).includes(raw) ? (raw as ProviderName) : "stub"
}

function fallbackProvider(): ProviderName | null {
  const raw = env("AI_FALLBACK_PROVIDER").toLowerCase()
  if (!raw) return null
  return raw === activeProvider() ? null : (raw as ProviderName)
}

/**
 * Strip the fencing and prose that models wrap around JSON even when told not
 * to. Cheaper and more reliable than another round trip asking them to behave.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    // Fall back to the outermost balanced object in the string.
    const start = candidate.indexOf("{")
    const end = candidate.lastIndexOf("}")
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error("Model response contained no parseable JSON")
  }
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  provider: ProviderName,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    // 429 and 5xx are worth another provider's attention; 4xx is our bug.
    const retryable = response.status === 429 || response.status >= 500
    throw new ProviderError(
      `${provider} returned ${response.status}: ${detail.slice(0, 300)}`,
      provider,
      retryable,
    )
  }

  return (await response.json()) as Record<string, unknown>
}

/* ------------------------------------------------------------------ *
 * Schema dialects
 * ------------------------------------------------------------------ *
 *
 * Pipeline stages declare one plain JSON Schema. Every provider then wants it
 * in a slightly different dialect, and getting that wrong is unusually nasty
 * here: a rejected schema is a 400, a 400 is non-retryable, and a non-retryable
 * failure degrades to the stub. The symptom is someone pasting in a perfectly
 * good API key, seeing every lead still come back NEEDS_REVIEW, and concluding
 * the key is broken.
 *
 * So the translation lives in the adapters, where dialect knowledge belongs,
 * rather than making every stage author its schema twice.
 */

const GEMINI_ALLOWED_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "minimum",
  "maximum",
  "minItems",
  "maxItems",
])

/**
 * JSON Schema -> Gemini's `responseSchema`, which is an OpenAPI 3.0 subset.
 *
 * Three differences that actually bite:
 *   - `additionalProperties` is not in the subset and is rejected outright
 *   - a union type (`["string", "null"]`) has to become `nullable: true`
 *   - the type name is a proto enum, so it must be upper-cased
 */
function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema)
  if (typeof node !== "object" || node === null) return node

  const input = node as Record<string, unknown>
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (!GEMINI_ALLOWED_KEYS.has(key)) continue

    if (key === "type") {
      const types = Array.isArray(value) ? value : [value]
      if (types.includes("null")) output.nullable = true
      const concrete = types.find((t) => t !== "null")
      if (typeof concrete === "string") output.type = concrete.toUpperCase()
      continue
    }

    if (key === "properties" && typeof value === "object" && value !== null) {
      const properties: Record<string, unknown> = {}
      for (const [name, child] of Object.entries(
        value as Record<string, unknown>,
      )) {
        properties[name] = toGeminiSchema(child)
      }
      output.properties = properties
      continue
    }

    if (key === "items") {
      output.items = toGeminiSchema(value)
      continue
    }

    output[key] = value
  }

  return output
}

/* ------------------------------------------------------------------ *
 * Adapters
 * ------------------------------------------------------------------ */

async function callGemini(req: GenerateRequest): Promise<GenerateResult> {
  const key = env("GEMINI_API_KEY")
  if (!key) throw new ProviderError("GEMINI_API_KEY is not set", "gemini", false)
  const model = env("GEMINI_MODEL", "gemini-2.5-flash")
  const started = Date.now()

  /**
   * Turn thinking off on the 2.5 flash models.
   *
   * They think by default, and thinking tokens come out of `maxOutputTokens` —
   * so the model can spend the entire budget reasoning, return an empty text
   * part with finishReason MAX_TOKENS, and produce a 200 that contains no
   * answer. Extraction is a transcription job with a fixed schema; there is
   * nothing here worth thinking about, and paying for it in the same budget as
   * the response is how this call silently returns nothing.
   *
   * Only flash accepts a zero budget — 2.5 Pro enforces a floor — so Pro keeps
   * its default and is given headroom instead.
   */
  const thinks = /2\.5/.test(model)
  const canDisableThinking = thinks && /flash/i.test(model)

  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: 0,
        // Headroom, because a truncated response is indistinguishable from a
        // refusal by the time it reaches the parser.
        maxOutputTokens: req.maxOutputTokens ?? 4096,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(req.schema),
        ...(canDisableThinking
          ? { thinkingConfig: { thinkingBudget: 0 } }
          : {}),
      },
    },
    "gemini",
  )

  const candidates = data.candidates as
    | Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
    | undefined
  const candidate = candidates?.[0]
  const text = candidate?.content?.parts?.[0]?.text ?? ""
  const usage = data.usageMetadata as Record<string, number> | undefined

  /**
   * An empty body on a 200 is its own failure and needs its own message.
   *
   * Left to fall through, `extractJson("")` throws "no parseable JSON", which
   * names the symptom and hides the cause — and the cause is usually one of
   * three specific things worth telling apart: the budget went on thinking,
   * a safety filter blocked the answer, or the response was cut off.
   */
  if (!text.trim()) {
    const reason = candidate?.finishReason ?? "no candidates returned"
    const thinkingTokens = usage?.thoughtsTokenCount
    const detail =
      thinkingTokens && thinkingTokens > 0
        ? ` ${thinkingTokens} tokens went to thinking.`
        : ""

    throw new ProviderError(
      `gemini returned an empty response (finishReason=${reason}).${detail}` +
        ` Model "${model}" may not exist for this key, or the output budget was exhausted.`,
      "gemini",
      reason === "MAX_TOKENS",
    )
  }

  return {
    json: extractJson(text),
    provider: "gemini",
    model,
    inputTokens: usage?.promptTokenCount ?? null,
    outputTokens: usage?.candidatesTokenCount ?? null,
    durationMs: Date.now() - started,
  }
}

/** Groq and OpenRouter both speak the OpenAI chat-completions shape. */
async function callOpenAiCompatible(
  req: GenerateRequest,
  provider: "groq" | "openrouter",
): Promise<GenerateResult> {
  const config =
    provider === "groq"
      ? {
          key: env("GROQ_API_KEY"),
          keyName: "GROQ_API_KEY",
          url: "https://api.groq.com/openai/v1/chat/completions",
          model: env("GROQ_MODEL", "llama-3.3-70b-versatile"),
          extraHeaders: {} as Record<string, string>,
        }
      : {
          key: env("OPENROUTER_API_KEY"),
          keyName: "OPENROUTER_API_KEY",
          url: "https://openrouter.ai/api/v1/chat/completions",
          model: env("OPENROUTER_MODEL", "google/gemini-2.0-flash-exp:free"),
          extraHeaders: { "x-title": "BrightPath Sales Assistant" },
        }

  if (!config.key) {
    throw new ProviderError(`${config.keyName} is not set`, provider, false)
  }

  const started = Date.now()
  const data = await postJson(
    config.url,
    { authorization: `Bearer ${config.key}`, ...config.extraHeaders },
    {
      model: config.model,
      temperature: 0,
      max_tokens: req.maxOutputTokens ?? 2048,
      /**
       * Strict mode is off deliberately. It additionally demands that every
       * declared property appear in `required` and rejects numeric bounds, so
       * the analyst schema — where `note` is optional and `confidence` is
       * bounded 0-1 — would be refused with a 400, which degrades to the stub
       * rather than failing loudly. The schema is a strong hint; the real gate
       * is the Zod parse plus the verbatim-quote check, which no provider flag
       * can substitute for.
       */
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: false, schema: req.schema },
      },
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    },
    provider,
  )

  const choices = data.choices as
    | Array<{ message?: { content?: string } }>
    | undefined
  const usage = data.usage as Record<string, number> | undefined

  return {
    json: extractJson(choices?.[0]?.message?.content ?? ""),
    provider,
    model: config.model,
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    durationMs: Date.now() - started,
  }
}

async function callAnthropic(req: GenerateRequest): Promise<GenerateResult> {
  const key = env("ANTHROPIC_API_KEY")
  if (!key) {
    throw new ProviderError("ANTHROPIC_API_KEY is not set", "anthropic", false)
  }
  const model = env("ANTHROPIC_MODEL", "claude-haiku-4-5")
  const started = Date.now()

  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": key, "anthropic-version": "2023-06-01" },
    {
      model,
      max_tokens: req.maxOutputTokens ?? 2048,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      output_config: {
        format: { type: "json_schema", schema: req.schema },
      },
    },
    "anthropic",
  )

  const content = data.content as Array<{ type: string; text?: string }> | undefined
  const text = content?.find((b) => b.type === "text")?.text ?? ""
  const usage = data.usage as Record<string, number> | undefined

  return {
    json: extractJson(text),
    provider: "anthropic",
    model,
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    durationMs: Date.now() - started,
  }
}

/**
 * Stub responses are produced by the caller, not invented here — each pipeline
 * stage supplies its own placeholder via `stubFactory`. Everything it returns
 * is marked low-confidence and unsourced, so the rubric routes it to
 * NEEDS_REVIEW exactly as it would a genuinely thin lead. The system never
 * pretends a stub is knowledge.
 */
async function callStub(req: GenerateRequest): Promise<GenerateResult> {
  const started = Date.now()
  const factory = STUB_REGISTRY.get(req.system)
  return {
    json: factory ? factory() : {},
    provider: "stub",
    model: "stub",
    inputTokens: null,
    outputTokens: null,
    durationMs: Date.now() - started,
  }
}

const STUB_REGISTRY = new Map<string, () => unknown>()

/** Register the placeholder a stage should return when no provider is configured. */
export function registerStub(systemPrompt: string, factory: () => unknown) {
  STUB_REGISTRY.set(systemPrompt, factory)
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

async function dispatch(
  provider: ProviderName,
  req: GenerateRequest,
): Promise<GenerateResult> {
  switch (provider) {
    case "gemini":
      return callGemini(req)
    case "groq":
      return callOpenAiCompatible(req, "groq")
    case "openrouter":
      return callOpenAiCompatible(req, "openrouter")
    case "anthropic":
      return callAnthropic(req)
    case "stub":
    default:
      return callStub(req)
  }
}

/**
 * Generate structured JSON, falling back to a second provider on a retryable
 * failure and to the stub if everything is unavailable.
 *
 * Falling back to the stub rather than throwing is a deliberate choice: a rate
 * limit should degrade the lead to "needs review", not take down lead capture.
 * Losing a lead is the failure this whole system exists to prevent.
 */
export async function generateStructured(
  req: GenerateRequest,
): Promise<GenerateResult> {
  const primary = activeProvider()

  try {
    return await dispatch(primary, req)
  } catch (error) {
    const fallback = fallbackProvider()
    const retryable = error instanceof ProviderError ? error.retryable : true

    /**
     * Log the real reason before degrading.
     *
     * Without this the failure is invisible: the caller gets usable stub
     * output, the run is labelled honestly in the UI, and nothing anywhere
     * says *why*. A misconfigured key and a rate limit then look identical
     * from the outside, and the first is a five-second fix.
     */
    console.error(
      `[ai] ${primary} failed (retryable=${retryable}):`,
      error instanceof Error ? error.message : String(error),
    )

    if (fallback && retryable) {
      try {
        return await dispatch(fallback, req)
      } catch (fallbackError) {
        console.error(
          `[ai] fallback ${fallback} also failed:`,
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError),
        )
      }
    }

    if (primary !== "stub") {
      console.warn(
        `[ai] degrading to stub output — this lead will read as NEEDS_REVIEW`,
      )
      const stubbed = await callStub(req)
      return {
        ...stubbed,
        model: `stub (after ${primary} failed)`,
        degradedReason:
          error instanceof Error
            ? `${primary}: ${error.message}`
            : `${primary}: ${String(error)}`,
      }
    }

    throw error
  }
}
