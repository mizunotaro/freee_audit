# gap-untested-module-a21bc1d187 — Unit tests for FreeeSettings.tsx

**Target:** `src/components/settings/FreeeSettings.tsx`
**Test file:** `tests/components/settings/freee-settings.test.tsx`
**Risk class:** C
**Outcome:** Existing test file extended (gap task arrived already partially satisfied — 7 tests present; extended to 21 with edge / error / fail-safe coverage).

## Why extend instead of create

The gap scan reported `FreeeSettings.tsx` as untested, but a matching test file already
existed (`freee-settings.test.tsx`) with 7 happy-path tests (connected/disconnected status,
connection-test count, disconnect confirm/cancel, success/failure banners). Per the gap-task
playbook, the file was **extended** with the missing branches rather than duplicated.

## Coverage rationale

The component has four async handlers (`checkStatus`, `handleConnect`, `handleDisconnect`,
`handleTest`), a mount-time URL-parameter effect, a loading branch, and two env-dependent
labels. The pre-existing tests covered the happy paths and the disconnect non-ok branch. The
additions below close the remaining edge, error, and fail-safe gaps so that every public
behavior degrades to a known-safe state on failure.

## Assertions added (14 new tests)

| # | Test | Branch covered | Key assertions |
|---|------|----------------|----------------|
| 1 | renders the loading skeleton while the status check is in flight | `if (loading)` render path (initial load) | `freee連携設定` heading absent; `.animate-pulse` skeleton present; no `button` rendered |
| 2 | degrades to disconnected and logs when the status request rejects | `checkStatus` catch (network failure) — fail-safe | `未接続` shown; `freeeと連携する` button shown; `console.error` spy called |
| 3 | degrades to disconnected when the status response is not ok | `checkStatus` `!response.ok` branch — fail-safe | `未接続` shown; `fetch` called exactly once (no retry storm) |
| 4 | falls back to the company name when display_name is absent | `display_name || name` fallback | `名前のみ事業所` (name) shown; company id `9` shown |
| 5 | shows the post-connection success banner and clears the query string | mount effect `?connected=true` branch | `freeeとの連携が完了しました` shown; `window.location.search === ''` after cleanup |
| 6 | shows an error banner from the error query string and clears the query string | mount effect `?error=…` branch | `role=alert` shown with text `auth_failed`; `window.location.search === ''` |
| 7 | redirects to the freee auth endpoint and enters the connecting state | `handleConnect` | connect button → `接続中...`; redirect target is `/api/freee/auth` |
| 8 | reports zero companies when the test response omits the companies array | `handleTest` malformed-response edge (`companies?.length \|\| 0`) | `接続テスト成功: 0件の事業所を取得` shown |
| 9 | announces a connection-test failure when the test response is not ok | `handleTest` `!response.ok` else branch | `role=alert` with `接続テストに失敗しました` |
| 10 | announces a connection-test failure when the test request rejects | `handleTest` catch (network failure) — fail-safe | `role=alert` with `接続テストに失敗しました`; `console.error` spy called |
| 11 | announces a disconnect failure when the disconnect request rejects | `handleDisconnect` catch (network failure) — fail-safe | `role=alert` with `連携解除に失敗しました`; `console.error` spy called |
| 12 | clears the error banner when its dismiss control is clicked | error dismiss `setError(null)` | after clicking `エラーを閉じる`, `role=alert` is gone |
| 13 | clears the success banner when its dismiss control is clicked | success dismiss `setSuccess(null)` | after clicking `メッセージを閉じる`, `role=status` is gone |
| 14 | labels the mock-mode section as development when NODE_ENV is development | `NODE_ENV === 'development'` true branch | `開発環境（モック有効）` shown; `本番環境` absent |

## Fail-safe behavior asserted

- Network failure on the initial status check → component does **not** crash; degrades to the
  `未接続` (disconnected) state with the connect CTA available (tests 2, 3).
- Network failure during connect-test / disconnect → a visible `role=alert` error is shown
  rather than a silent hang or crash (tests 10, 11).
- Malformed API payload (missing `companies` array) → `handleTest` coerces to `0件` instead of
  throwing on `undefined.length` (test 8).
- Both error and success banners are dismissible, restoring the UI to a neutral state
  (tests 12, 13).

## Determinism / isolation notes

- `fetch` is stubbed per-test via `vi.stubGlobal('fetch', …)`; no real network.
- No clock/random dependencies.
- The redirect test (7) replaces `window.location` with a plain stub via
  `Object.defineProperty` and restores the original descriptor in `finally`, so the real jsdom
  `Location` is preserved for the URL-parameter tests that follow.
- `afterEach` resets `window.history` to `/` so `?connected=true` / `?error=…` fixtures do not
  leak between tests.
- The NODE_ENV test (14) restores the previous `process.env.NODE_ENV` in a `finally`.

## Verification

- `corepack pnpm exec vitest run tests/components/settings/freee-settings.test.tsx`
  → **21 passed (21)** (7 pre-existing + 14 new), no console noise.
- `corepack pnpm exec eslint --max-warnings=0 tests/components/settings/freee-settings.test.tsx`
  → clean.
- `corepack pnpm exec tsc --noEmit` → 0 errors.
