# gap-untested-module-f1a351503e — Unit tests for `AiSettings.tsx`

**Target:** `src/components/settings/AiSettings.tsx`
**Test file:** `tests/components/settings/ai-settings.test.tsx`
**Risk class:** C
**Result:** extended an existing partial test file (9 → 21 tests); no new dependency, no production code changed.

## Starting point

A mirrored test file already existed (`tests/components/settings/ai-settings.test.tsx`, 9 tests).
Per the gap-task convention this is a stale scan (stem/casing mismatch), so the file was **extended
with edge / error / fail-safe cases** rather than duplicated. Baseline ran green before changes.

## Source surface covered

`AiSettings` is a single default-exported React client component (no exported helpers) wrapping
these behaviors:

- `loadConfig` (mount effect): GET `/api/settings/ai`, guarded by `response.ok` and `data.config`,
  with `provider || 'openai'` / `model || ''` fallbacks; catch logs and degrades to defaults.
- `handleSave`: POST `/api/settings/ai`; on `ok` shows success + clears the API key, on `!ok`
  surfaces `data.error || '保存に失敗しました'`, on throw sets the generic message; `saving`
  toggles the button label and `disabled` state.
- `handleProviderChange`: resets the API key and selects the provider's first model from
  `PROVIDER_MODELS`.
- Render branches: `loading` skeleton vs. form; `error`/`success` toast regions each with a
  dismiss button; show/hide API-key toggle flipping the input `type`; provider button group with
  `aria-pressed`; model `<select>` driven by the active provider.

## Tests added (12)

| # | Test | Assertions | Source path covered |
|---|------|------------|---------------------|
| 10 | shows the loading skeleton until the config finishes loading | `.animate-pulse` present; heading absent while pending; heading appears after resolve | `if (loading)` skeleton branch (lines 91–100) |
| 11 | keeps the default provider when the load response is not ok | openai button carries active `border-primary-500` class | `loadConfig` `!response.ok` fail-safe (line 39) |
| 12 | keeps the defaults when the load payload has no config object | openai button active | `if (data.config)` falsey guard (line 41) |
| 13 | falls back to the openai provider when the stored provider is empty | openai `aria-pressed='true'`, gemini `'false'` | `data.config.provider || 'openai'` fallback (line 43) |
| 14 | shows the generic error message when the save request throws | generic `保存に失敗しました` text rendered | `handleSave` `catch` block (lines 75–77) |
| 15 | falls back to the generic message when the error response has no error field | generic `保存に失敗しました` text rendered | `data.error || '保存に失敗しました'` fallback (line 73) |
| 16 | clears the error when its dismiss button is clicked | `role=alert` present → absent after click on `エラーを閉じる` | error dismiss `onClick={() => setError(null)}` (line 114) |
| 17 | clears the success message when its dismiss button is clicked | `role=status` present → absent after click on `メッセージを閉じる` | success dismiss `onClick={() => setSuccess(null)}` (line 131) |
| 18 | disables the save button and shows the saving label while the request is in flight | `保存中...` button `disabled` mid-request, then `保存` re-enabled after resolve | `disabled={saving}` + `saving ? '保存中...' : '保存'` (lines 215–218) |
| 19 | switches the API key input between password and text | input `type` password → text → password across toggles | `type={showApiKey ? 'text' : 'password'}` (line 174) |
| 20 | updates the selected model when a different option is chosen | combobox value `gpt-4` → `gpt-3.5-turbo` after change | model `<select>` `onChange` (line 201) |
| 21 | switches to gemini and lists only the gemini models | combobox value `gemini-pro`; option set exactly `['gemini-pro','gemini-pro-vision']` | `handleProviderChange('gemini')` + `PROVIDER_MODELS` map (lines 83–89, 204) |

## Coverage rationale (happy / edge / error / fail-safe)

- **Happy-path**: provider switch + model list (21), model selection (20), save success path was
  already covered by test 3 and is reused as the setup for the dismiss-success case (17).
- **Edge cases**: empty/missing stored config fields (12, 13), loading → ready transition (10),
  save-in-flight disabled state (18), provider-specific model option set (21).
- **Error paths**: load rejection (pre-existing 5), load `!ok` (11), save network throw (14),
  save `!ok` with no `error` field (15).
- **Fail-safe / safe degradation**: on every load failure the component renders the form with
  openai defaults instead of crashing (11, 12, 13); on every save failure it surfaces a Japanese
  user-facing message inside `role=alert` and never leaves the button stuck in the saving state
  (14, 15, 18); dismiss controls restore a clean UI (16, 17).

## Determinism / mocking

- `fetch` is stubbed per test via `vi.stubGlobal('fetch', …)` and restored in `afterEach`; no real
  network. The two in-flight-state tests (10, 18) use a captured-deferred promise so the pending
  window is observed deterministically and then resolved before the test ends (no dangling
  rejections).
- The `console.error` noise in the two intentional-rejection tests (5, 14) is expected component
  logging, not a test failure.

## Quality gate

- `eslint --max-warnings=0` on the changed file → exit 0.
- `tsc --noEmit` (whole repo) → exit 0.
- `vitest run tests/components/settings/ai-settings.test.tsx` → 21/21 passed.
