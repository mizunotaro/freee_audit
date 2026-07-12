# gap-untested-module-4c3aa0ac15 — Unit tests for `src/lib/route-audit.ts`

**Risk class:** C
**Target:** `src/lib/route-audit.ts` (no prior `tests/` entry)
**Result:** New test file added; all gates green.

## What was tested

`logRouteAudit(input: RouteAuditInput): Promise<Result<void>>` is the only public
export of the module. It extracts the actor identity and request metadata from a
`NextRequest`, forwards them to `auditLogger.log`, and wraps any thrown error into a
`Result` failure so the calling route handler never crashes on audit logging.

The single collaborator — `auditLogger` from `@/lib/audit/audit-logger` — is fully
mocked (`vi.mock`). No Prisma / DB / network is touched; tests are deterministic.

## Test file

`tests/unit/lib/route-audit.test.ts` — 14 tests, mirroring the sibling
`tests/unit/lib/audit-logger.test.ts` (repo convention is `tests/unit/lib/`, the
location the gate's stem-matcher resolves for `src/lib/*`).

## Assertions added (per test)

### Happy path
1. `logs with explicit userId and defaults result to SUCCESS`
   - `result.success === true`; `auditLogger.log` called exactly once with the full
     mapped object: `userId`, `action`, `resource` forwarded, `resourceId/details/
     ipAddress/userAgent === undefined`, and `result === 'SUCCESS'` (default when
     `input.result` omitted).
2. `forwards resourceId and details when provided`
   - `resourceId === 'item-9'`; `details` object passed through by reference.
3. `passes an explicit FAILURE result through to the logger`
   - `input.result: 'FAILURE'` overrides the SUCCESS default and reaches the logger.
4. `reads ipAddress and userAgent from request headers`
   - `x-forwarded-for` → `ipAddress`; `user-agent` → `userAgent`.

### userId resolution precedence (`input.userId ?? header ?? undefined`)
5. `falls back to the x-user-id header when userId is omitted`
   - `userId === 'header-user'`.
6. `prefers an explicit userId over the x-user-id header`
   - explicit `userId` wins; header ignored (`userId === 'explicit-user'`).
7. `resolves to undefined when neither userId nor the header is present`
   - `headers.get()` returns `null`, collapsed to `undefined` via `??`.

### Edge cases / boundaries
8. `accepts the minimal input of request, action and resource`
   - Only required fields supplied; every optional field resolves to `undefined`,
     `result` to `'SUCCESS'`; full mapped object asserted.
9. `passes a comma-separated x-forwarded-for value through untouched`
   - The module performs no IP parsing; the raw `'a, b'` string is forwarded verbatim.
10. `forwards an empty details object`
    - `{}` is a defined value, not elided (would only be elided if `undefined`).
11. `treats absent x-forwarded-for and user-agent headers as undefined`
    - Boundary: missing header → `null` → `undefined`.

### Fail-safe error handling (the module's `catch`)
12. `returns a DATABASE_ERROR failure preserving the thrown Error message and cause`
    - `auditLogger.log` rejects with an `Error` → `result.success === false`,
      `error.code === ERROR_CODES.DATABASE_ERROR`, `error.message === error.message`,
      `error.cause === <original Error>`, `error.timestamp instanceof Date`.
13. `wraps a non-Error throw into an Error via String()`
    - Reject with a string `'boom string'` → wrapped via `new Error(String(error))`,
      so `error.cause instanceof Error` and its `message === 'boom string'`.
14. `degrades to a failure Result instead of throwing out of the caller`
    - `await expect(logRouteAudit(...)).resolves.toMatchObject({ success: false })` —
      the logger fault never escapes the function (safe degradation).

## Coverage rationale

- **Happy path:** every forwarded field is asserted, including the `result ?? 'SUCCESS'`
  default and the optional-field → `undefined` mapping.
- **Precedence:** the three-way `input.userId ?? x-user-id ?? undefined` chain is
  exercised at each branch (explicit wins, header fallback, neither → undefined).
- **Boundaries:** minimal input, comma-list IP (no-parse contract), empty `{}` details,
  and absent headers (the `null ?? undefined` collapse).
- **Fail-safe:** the catch converts both `Error` and non-`Error` rejections into a
  `DATABASE_ERROR` `Result` failure and never rethrows — this is the safety property
  route handlers rely on, so it is asserted directly (test 14).

## Gates

- `vitest run tests/unit/lib/route-audit.test.ts` → **14/14 passed**
- `tsc --noEmit` (full repo) → **0 errors** (after `pnpm db:generate`)
- `eslint --max-warnings=0 tests/unit/lib/route-audit.test.ts` → **0 warnings**
