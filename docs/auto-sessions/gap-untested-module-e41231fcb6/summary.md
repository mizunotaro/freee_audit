# gap-untested-module-e41231fcb6 — unit tests for `conversion-progress.tsx`

**Target:** `src/components/conversion/conversion-progress.tsx`
**New test file:** `tests/components/conversion/conversion-progress.test.tsx`
**Risk class:** C (pure presentational React component + `fetch` polling effect)

## Scope of the module under test

`ConversionProgress` is a client component that:

1. Renders status-specific labels/icons/colors via `STATUS_CONFIG` for all 7
   `ConversionStatus` values (`draft`, `mapping`, `validating`, `converting`,
   `reviewing`, `completed`, `error`).
2. Renders the numeric progress: a one-decimal percentage `Badge`, a radix
   `Progress` bar, and processed/total journal counts.
3. Optionally renders `currentItem`, the elapsed time (`formatDuration`), a
   remaining-time estimate, the error list, and an "自動更新中..." polling
   indicator.
4. While the status is active (`mapping`/`validating`/`converting`), polls
   `GET /api/conversion/projects/:projectId/progress` on a `setInterval`,
   forwarding results via `onProgressUpdate` / `onComplete` / `onError`, and
   stops polling once the API returns `completed` or `error`.

`formatDuration(seconds)` is the only non-exported helper; its branches are
exercised through the rendered elapsed/remaining text.

## Coverage rationale

The component's public surface is the component itself (plus the private
`formatDuration`). Tests are grouped by behavior:

- **STATUS_CONFIG labels** — every status renders the correct ja + en label;
  the `error` status uses the destructive badge variant, others secondary; the
  status icon spins only for active statuses.
- **Progress / counts / current item** — `toFixed(1)` formatting at zero and a
  fractional value; the `Progress` bar receives the value (aria attributes +
  indicator `translateX` transform); journal counts use `toLocaleString`;
  `currentItem` renders when present and is omitted otherwise.
- **Error list** — count header + each message render when errors exist; the
  block is hidden when `errors` is empty (fail-safe).
- **formatDuration** — every boundary of the helper: `<60s` (seconds), `>=60s`
  minutes with/without trailing seconds, `>=60m` hours with/without trailing
  minutes, plus `startedAt` absent (0s), future `estimatedCompletion`
  (remaining appended), absent `estimatedCompletion` (no remaining), and a past
  `estimatedCompletion` (clamped to 0s via `Math.max(0, …)`).
- **Default state** — when `initialProgress` is omitted the component falls
  back to a `draft`/0% object without crashing.
- **Polling** — happy path (polls the URL, forwards the payload, keeps polling
  while active), terminal paths (`completed` → `onComplete` + polling stops;
  `error` → `onError` + polling stops), and fail-safe paths (non-ok response →
  no callbacks; thrown/rejected `fetch` → logged + swallowed, no crash).

## Assertions added

### Status display
- `getByText(label)` and `getByText(labelEn)` for each of the 6 non-error
  statuses (parameterized).
- `getByText('エラー')` / `getByText('Error')` and
  `container.querySelector('.bg-destructive')` is non-null for `error`.
- `container.querySelector('.bg-secondary')` is non-null for `completed`.
- `container.querySelector('.animate-spin')` non-null for `converting`, null
  for `draft`.

### Progress / counts / current item
- `getByText('42.6%')` (42.56 → `toFixed(1)`).
- `getByText('0.0%')` at zero.
- Progressbar `aria-valuemin='0'`, `aria-valuemax='100'`; indicator
  `style.transform === 'translateX(-50%)'`. (Note: this repo's
  `ui/progress.tsx` does not forward `value` to the radix `Root`, so the value
  is observable only via the indicator transform, not `aria-valuenow`.)
- `getByText(`${(1500).toLocaleString()} / ${(3000).toLocaleString()} 仕訳`)`.
- `getByText('処理中: 売掛金の変換')` when provided;
  `queryByText(/処理中:/)` null when absent.

### Error list
- `getByText('エラー (2件)')`, plus each error message rendered.
- `queryByText(/エラー \(\d+件\)/)` null when `errors` is empty.

### formatDuration (parameterized over seconds → expected)
- 0→`0秒`, 30→`30秒`, 59→`59秒`, 60→`1分`, 61→`1分1秒`, 90→`1分30秒`,
  120→`2分`, 3540→`59分`, 3600→`1時間`, 3900→`1時間5分`.
- `startedAt` absent → `getByText('経過: 0秒')`.
- Future completion → `getByText('経過: 30秒 / 残り: 1分30秒')`.
- Absent completion → `getByText('経過: 30秒')` (no remaining suffix).
- Past completion → `getByText('経過: 30秒 / 残り: 0秒')` (clamped).

### Default state
- `getByText('下書き')`, `getByText('Draft')`, `getByText('0.0%')`,
  `getByText('0 / 0 仕訳')`, `getByText('経過: 0秒')`.

### Polling
- Active status shows `getByText('自動更新中...')`.
- Inactive status: no auto-refresh indicator, and `fetch` never called after
  advancing time 5s.
- Active happy path: `fetch` called with
  `/api/conversion/projects/proj-1/progress`; `onProgressUpdate` called once
  with the payload; a second tick yields a second `fetch` (polling continues).
- Completed: `onComplete` called once; second tick does NOT call `fetch` again
  (polling stopped).
- Error: `onError` called once with the errors array; second tick does NOT
  call `fetch` again (polling stopped).
- Non-ok response: `fetch` called once; none of `onProgressUpdate` /
  `onComplete` / `onError` fire (safe degradation).
- Rejected `fetch`: `fetch` called once; `console.error` called;
  `onProgressUpdate` not called; component still renders `マッピング中`
  (no crash).

## Test determinism / isolation notes

- `vi.useFakeTimers()` + `vi.setSystemTime(NOW)` for the whole file →
  `Date.now()` and `new Date()` are frozen, making elapsed/remaining and the
  poll interval fully deterministic (no real clock).
- `fetch` is stubbed globally per test (default no-op; re-stubbed with
  resolved/rejected values for polling cases) → no network.
- `ResizeObserver` is stubbed (radix `ScrollArea` needs it under jsdom).
- Cleanup: `useRealTimers()` + `unstubAllGlobals()` + `restoreAllMocks()` in
  `afterEach`; RTL auto-cleanup unmounts components (clearing the interval via
  the effect cleanup) between tests.
