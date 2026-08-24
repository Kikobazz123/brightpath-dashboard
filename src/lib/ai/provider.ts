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
 * Adapters
 * ------------------------------------------------------------------ */

async function callGemini(req: GenerateRequest): Promise<GenerateResult> {
  const key = env("GEMINI_API_KEY")
  if (!key) throw new ProviderError("GEMINI_API_KEY is not set", "gemini", false)
  const model = env("GEMINI_MODEL", "gemini-2.5-flash")
  const started = Date.now()

  const data = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { "x-goog-api-key": key },
    {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: "user", parts: [{ text: req.user }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
        responseMimeType: "application/json",
        responseSchema: req.schema,
      },
    },
    "gemini",
  )

  const candidates = data.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined
  const text = candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  const usage = data.usageMetadata as Record<string, number> | undefined

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
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: req.schema },
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

    if (fallback && retryable) {
      try {
        return await dispatch(fallback, req)
      } catch {
        // fall through to stub
      }
    }

    if (primary !== "stub") {
      const stubbed = await callStub(req)
      return { ...stubbed, model: `stub (after ${primary} failed)` }
    }

    throw error
  }
}
