# COV-LIB-04 — Unit-test coverage: lib/ai (non-security) + lib/prompts

## Outcome

Filled the genuine coverage gaps under `src/lib/ai` (excluding `security/**`) and
`src/lib/prompts`. Three modules were missing real-assertion coverage; all are now
covered. No Class-A path was touched (read-only reference only).

**Definition of Done met:** `node scripts/autopm_verify.mjs --changed-only` → exit 0
(typecheck 0 errors / eslint 0 warnings / vitest 78 passed).

## Gap enumeration (how the targets were chosen)

A full export-vs-test cross-check (aided by a read-only enumeration subagent) confirmed
that `src/lib/ai` is already heavily saturated by prior cov waves — context-manager,
token-counter, task-classifier, complexity-analyzer, model-selector, intent-router,
response-synthesizer, orchestrator, providers/registry (all methods), template-engine,
validators, all 6 IR per-template files, keidanren-prompts, all personas, config/defaults
and model-config (except one method), tokenizer/* are all genuinely covered (0 fake-green,
per the cov-wave scanner). Barrels (`*/index.ts`) and `*.types.ts` are pure re-exports /
type-only — not independent gaps.

The only untested runtime surfaces were:

1. `src/lib/ai/prompts/templates/ir/index.ts` — the IR prompt **registry** (no test imported
   `@/lib/ai/prompts/templates/ir`; the 6 per-template tests cover only the data, not the barrel).
2. `src/lib/ai/config/model-config.ts` — `ModelConfigService.getCacheStats()` (every sibling
   method was tested; this one was not).
3. `src/lib/ai/personas/accounting-expert.ts` — `buildPrompt(context)` override (the lone
   persona whose `buildPrompt` had no test; cfo/cpa/financial-analyst/tax-accountant/big4-auditor
   all test theirs).

## Changes

### 1. NEW — `tests/unit/lib/ai/prompts/templates/ir/index.test.ts` (24 tests)
Pure-logic registry, real assertions on the Result-pattern API:
- `getAll()` returns all 6 templates; `IR_TEMPLATES_LIST` equals `getAll()`.
- `getById()` known → template, unknown → `undefined`.
- `getBySectionType()` known → template (all 6 mapped), unknown → `undefined`.
- `getTemplate()` resolves by id, by section-type, unknown → `undefined`, id-precedence.
- `irPromptRegistry.templates` (Map, size 6), `.getBySectionType`, `.getAll` delegation.
- `registerTemplate()` duplicate id → `success:false` / `TEMPLATE_ALREADY_EXISTS`; new id →
  `success:true` and retrievable via `getById`/`getTemplate`.
- Re-exported per-template getters return the matching registry entry.
- Mutation tests (`registerTemplate`) ordered last so shared module state never pollutes the
  size-6 read assertions.

### 2. EXTENDED — `tests/unit/lib/ai/personas/accounting-expert.test.ts` (+5 tests)
`buildPrompt` describe: Japanese default (systemPromptJa + appended `## 出力形式（JSON）`,
`userPrompt` is the sanitized query, `personaType`/`personaVersion`, `estimatedTokens>0`);
English branch (`language:'en'` selects the English prompt, asserts the ja marker is absent);
empty query → `validation_error`; non-string query → `validation_error`; over-long query (20k
chars) sanitized to the 10000 limit.

### 3. EXTENDED — `tests/unit/lib/ai/config/model-config.test.ts` (+3 tests)
`getCacheStats` describe: empty before any resolve; reflects 2 distinct cache keys
(`openai`, `openai:user:user1`) after resolves; returns to empty after `clearCache`.
Also removed a **pre-existing** dead import (`getDefaultModel`, imported but unused) that
would otherwise have failed the gate's `--max-warnings=0` lint on this touched file.

## What was deliberately NOT done (honesty)

- `AIOrchestrator.process()` outer-catch / `all_failed`-when-all-personas-fail branches: would
  require fragile cross-module mocking of `getAIService`/persona resolution; risk of false
  failures outweighs value. Left as-is.
- `AccountingExpertPersona.buildPrompt` `compilation_error` catch: only reachable if
  `sanitizeString`/`estimateTokens` throw, which they do not on real input — not triggerable
  without contortion. Not asserted (would be fake).

## Verification (run only on changed files — never the full suite, per OOM constraint)

```
pnpm exec vitest run <the 3 files>          → 78 passed
pnpm exec eslint --max-warnings=0 <3 files> → clean
pnpm exec tsc --noEmit (whole repo)         → 0 errors
node scripts/autopm_verify.mjs --changed-only → exit 0
```

Worktree bootstrapped per memory: `corepack pnpm install --frozen-lockfile` then
`corepack pnpm db:generate` (node_modules + prisma client were absent on arrival).
