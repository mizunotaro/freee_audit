# INT-03 — Integration tests: export / import / investor routes

## Scope

Added real-handler (request → route handler → response) integration tests for the
non-Class-A route groups under `src/app/api/{export,import,investor}/**`, following
the INT-01/INT-02 pattern established by `tests/integration/api/{dashboard,reports-monthly,
analysis,board-meetings,dd-checklists,inventory,settings}.test.ts`.

No source files were modified. No Class-A path was touched. Only four **new** test
files were added.

## Files added (4 files / 46 tests)

| File | Routes covered | Tests |
|------|----------------|------|
| `tests/integration/api/export.test.ts` | `GET /api/export/csv`, `POST /api/export/{excel,pdf,pptx}` | 12 |
| `tests/integration/api/import.test.ts` | `GET/POST /api/import/{journals,account-items,monthly-balances}` | 21 |
| `tests/integration/api/investor-invite.test.ts` | `POST /api/investor/invite` | 7 |
| `tests/integration/api/investor-access-log.test.ts` | `POST /api/investor/access-log` | 6 |

## What is exercised (real behavior, not mocks-of-mocks)

Each test imports the **real route handler** and mocks only the service / auth
boundary — the same boundary a real request crosses. Assertions cover auth, RBAC,
input validation, the success response shape, and audit logging.

- **Auth seam** — `session` cookie → `validateSession` for the `getAuthUser`-based
  routes (export, investor) and the real `withAuth` → `getAuthenticatedUser` pipeline
  (`@/lib/api`) for the import routes. 401 (no/expired session) and the require-company
  / role checks (403) are driven through the real code paths.
- **Validation** — missing required params/fields (400), Zod failures with `details`
  (investor invite/access-log), unsupported file extension / no file / oversize file
  (import), and `createExportService` failure → 400 (pdf/pptx).
- **Success** — export response shape incl. `Date → ISO` serialization of `expiresAt`;
  import `preview`/`import` shapes incl. the `dryRun` form-field routing and the shaped
  `errors`/`warnings` slices; investor invite `inviteUrl` construction + audit; access-log
  `INVESTOR_<ACTION>` upper-casing, ip/user-agent defaults, and `details.investorEmail` merge.
- **Audit** — `logRouteAudit` (export excel/pdf/pptx, all import writes, investor invite)
  and `auditLogger.log` (investor access-log) are asserted with `objectContaining` on
  action / resource / userId / details, and asserted **not called** on preview / 401 / 403.

## Key gotchas applied

- **jsdom ↔ undici File brand mismatch (import routes only).** `NextRequest.formData()`
  is parsed by undici, which builds file parts through the global `File` and brand-checks
  them; jsdom's `File` fails that check (every file body → 500). Fixed file-locally by
  pinning `globalThis.File` to `node:buffer`'s `File` in `beforeAll` **and** building the
  `multipart/form-data` body as a raw `Buffer` (manual `--boundary` parts) instead of a
  jsdom `FormData`. Export/investor routes upload no files, so they need none of this.
  See memory `jsdom-file-undici-formdata-brand-mismatch`.
- **`dryRun` is a form field, not a query param.** The import routes read
  `formData.get('dryRun')`; the test passes it as a multipart field and asserts it
  propagates to both the importer options and the audit `details`.
- **`expect.any(File)` is unreliable under this Node's undici File identity**, so file
  arguments are asserted via `expect.anything()` plus an explicit `.name` / `.size` check
  on `mock.calls[0][0]` — stronger and unambiguous.
- **`Buffer` body fails `tsc` against Next 16 `RequestInit`** (vitest/esbuild does not
  catch this; only the `tsc --noEmit` gate step does). The multipart body is passed as
  `body: body as BodyInit` with a structurally-typed init object. See memory
  `real-handler-integration-test-gotchas` item 7.
- **`Date → ISO`** in `NextResponse.json()` bodies: export `expiresAt` assertions use the
  ISO string, not the `Date` instance.

## Definition of done

```
node scripts/autopm_verify.mjs --changed-only   → exit 0
```

- typecheck: 0 errors (whole-repo `tsc --noEmit`, filtered to the 4 changed files)
- eslint: 0 warnings (`--max-warnings=0` on the 4 files)
- vitest: 4 files, 46 tests pass

## Notes / hand-offs

- These tests mock the service boundary (`@/services/export`, `@/services/import/*`,
  `@/services/investor/invitation-service`, `@/lib/audit/audit-logger`) by design — they
  are handler-level integration tests, not DB-level. The DB-wiring of these services is
  out of scope for INT-03.
- `@/lib/audit/audit-logger` is Class-A and was **mocked, not modified**, in the
  access-log test (the route itself, `src/app/api/investor/access-log`, is non-Class-A).
- No new dependencies, no `any`/`@ts-ignore`/`.skip`/lint-disable, no coverage thresholds
  changed.
