/**
 * Does the failover chain actually walk?
 *
 * Run: npx tsx scripts/verify-failover.ts
 *
 * No keys, no network, no database. Every provider is configured *without* a
 * key, so each one throws on the way in — which is exactly the condition that
 * makes the chain observable. What is being tested is the routing, not the
 * models.
 *
 * This exists because the failover was described in the architecture, shipped
 * switched off, and then failed to cover a real outage. Two of those three are
 * things a test catches.
 */

import assert from "node:assert/strict"

import {
  configuredFallbacks,
  generateStructured,
  registerStub,
} from "../src/lib/ai/provider"

let passed = 0
let failed = 0

function check(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++
      console.log(`  PASS  ${name}`)
    })
    .catch((error: Error) => {
      failed++
      console.log(`  FAIL  ${name}`)
      console.log(`        ${error.message.split("\n")[0]}`)
    })
}

const SYSTEM = "failover-probe"
registerStub(SYSTEM, () => ({ probe: true }))

const REQ = {
  system: SYSTEM,
  user: "irrelevant",
  schema: { type: "object" } as Record<string, unknown>,
}

/** Configure the chain for one case. Keys are left unset on purpose. */
function configure(primary: string, fallbacks: string) {
  process.env.AI_PROVIDER = primary
  process.env.AI_FALLBACK_PROVIDER = fallbacks
  for (const k of [
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
  ]) {
    delete process.env[k]
  }
}

async function main() {
  console.log("\nChain parsing\n")

  await check("a comma-separated list becomes an ordered chain", () => {
    configure("gemini", "groq,openrouter")
    assert.deepEqual(configuredFallbacks(), ["groq", "openrouter"])
  })

  await check("a single value still works", () => {
    configure("gemini", "groq")
    assert.deepEqual(configuredFallbacks(), ["groq"])
  })

  await check("whitespace and empty entries are tolerated", () => {
    configure("gemini", " groq , , openrouter ")
    assert.deepEqual(configuredFallbacks(), ["groq", "openrouter"])
  })

  await check("an unknown name is skipped, not silently treated as stub", () => {
    configure("gemini", "grok,groq")
    assert.deepEqual(configuredFallbacks(), ["groq"])
  })

  await check("the primary is dropped from its own fallback list", () => {
    configure("gemini", "gemini,groq")
    assert.deepEqual(configuredFallbacks(), ["groq"])
  })

  await check("duplicates collapse", () => {
    configure("gemini", "groq,groq,openrouter")
    assert.deepEqual(configuredFallbacks(), ["groq", "openrouter"])
  })

  await check("stub is not accepted as a fallback", () => {
    configure("gemini", "stub,groq")
    assert.deepEqual(configuredFallbacks(), ["groq"])
  })

  console.log("\nWalking the chain\n")

  await check("every provider is tried before the stub is used", async () => {
    configure("gemini", "groq,openrouter")
    const result = await generateStructured(REQ)

    assert.equal(result.provider, "stub", "should land on the stub")
    const reason = result.degradedReason ?? ""
    for (const who of ["gemini", "groq", "openrouter"]) {
      assert.ok(reason.includes(who), `chain report is missing ${who}`)
    }
  })

  await check(
    "a non-retryable failure still advances — a dead model must not stop the chain",
    async () => {
      /**
       * The regression this file was written for. A missing key raises a
       * non-retryable ProviderError, exactly like the 404 from a retired model
       * name. The old code only failed over on retryable errors, so both took
       * the assistant down while a healthy second provider sat unused.
       */
      configure("gemini", "groq")
      const result = await generateStructured(REQ)
      assert.ok(
        (result.degradedReason ?? "").includes("groq"),
        "groq was never attempted after a non-retryable gemini failure",
      )
    },
  )

  await check("an unconfigured chain says so, rather than looking protected", async () => {
    configure("gemini", "")
    const result = await generateStructured(REQ)
    assert.match(result.degradedReason ?? "", /no AI_FALLBACK_PROVIDER configured/)
  })

  await check("a configured chain does not claim to be unprotected", async () => {
    configure("gemini", "groq")
    const result = await generateStructured(REQ)
    assert.doesNotMatch(
      result.degradedReason ?? "",
      /no AI_FALLBACK_PROVIDER configured/,
    )
  })

  await check("the stub label names how far the chain got", async () => {
    configure("gemini", "groq,openrouter")
    const result = await generateStructured(REQ)
    assert.match(result.model, /all 3 providers/)
  })

  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed === 0 ? 0 : 1)
}

main()
