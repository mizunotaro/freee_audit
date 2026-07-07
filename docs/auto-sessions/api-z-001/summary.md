# API-Z-001 — Audit Zod input validation (dashboard / chat / health / board-reports)

## Outcome
1 of 4 routes modified; 3 are no-op passes. Diff is **not** empty.

## Per-route decision

| Route | Method | Request input beyond standard auth | Pre-existing validation | Action |
|-------|--------|------------------------------------|-------------------------|--------|
| `src/app/api/dashboard/route.ts` | GET | none (auth via `getAuthUser` only) | — | **no-op** |
| `src/app/api/chat/route.ts` | POST | JSON body (`message`, `sessionId`, `context`, `options`) | manual checks on `message` only; **no Zod** | **added Zod** |
| `src/app/api/health/route.ts` | GET | none | — | **no-op** |
| `src/app/api/board-reports/route.ts` | GET | none (`companyId` comes from the validated session, not request input) | — | **no-op** |

## Change made — `src/app/api/chat/route.ts`
- Added `import { z } from 'zod'` (existing dependency, no new dep).
- Added module-level `chatRequestSchema` (minimal + additive; uses `.passthrough()` on the
  container objects so existing happy-path payloads are not stripped/rejected):
  - `message: z.string().min(1).max(10000)` — mirrors the prior manual contract exactly.
  - `sessionId`, `context.{companyId,language,financialData}`, `options.{maxCost,maxLatencyMs,stream,preferredPersonas}` — optional, conservatively typed.
- `parseRequestBody` now runs `chatRequestSchema.safeParse(body)` and returns **400** on failure.
  Error-code mapping preserves the prior contract for the `message` field:
  - `too_big` on `message` → `{ code: 'message_too_long', message: 'Message exceeds maximum length' }`
  - any other issue (incl. missing/empty/non-string `message`, bad nested types, unsupported `language`) → `{ code: 'invalid_input', message: 'Message is required' }`
  - unparseable JSON → `{ code: 'invalid_json', message: 'Invalid JSON body' }` (unchanged)
- Happy path (success branch) is unchanged: returns `{ success: true, data: parsed.data as ChatRequest }`.
- No handler refactor; no new helper functions (so no `Result<T,E>` obligation triggered).

## Constraints honored
- Touched only `src/app/api/chat/route.ts` + test. No forbidden paths (`.autopm/`, `prisma/`, `src/lib/auth*`, `src/lib/audit/`, audit/conversion/freee services/routes, etc.).
- No `any` / `@ts-ignore` / `@ts-expect-error` / `.skip` / lint-disable.
- No new dependencies; reuses `zod@^3.23`.

## Test — `tests/integration/api/chat.test.ts` (new, 10 tests)
Mocks `getAuthUser`, `createContextManager`, `createOrchestrator`; builds real `NextRequest`s and invokes `POST`.
- 401 when unauthenticated
- 400 when `message` missing / non-string / empty / >10000 chars
- 400 for invalid JSON
- 400 when a nested option has a wrong type (`options.maxCost` string)
- 400 when `context.language` is an unsupported locale
- 200 for a full well-formed payload (asserts `success:true`, `sessionId`, orchestrator invoked)
- 200 for a minimal `{ message }` payload

## Verification
`node scripts/autopm_verify.mjs --changed-only` → **exit 0**.
- typecheck: 298 pre-existing repo errors, **0 relevant to diff**
- eslint (`--max-warnings=0`): clean on both files
- vitest: 17 passed (10 new integration + 7 pre-existing unit `tests/unit/app/api/chat/route.test.ts` — backward compatible)

## Note for the automation framework
Suggested PR title prefix: `feat(api):` (adds validation behavior to the chat route).
