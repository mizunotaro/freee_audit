# Gap: unit tests for `src/components/conversion/project-progress.tsx`

**Task ID:** gap-untested-module-d782e27fba
**Risk class:** C
**Target:** `src/components/conversion/project-progress.tsx` (no prior `tests/` entry)
**Deliverable:** `tests/components/conversion/project-progress.test.tsx`

## Result

- New test file: **32 tests, all passing** (`vitest run`).
- `eslint --max-warnings=0` on the new file: **clean**.
- `tsc --noEmit` (full repo): **exit 0**.

## What the component does (the contract under test)

`ProjectProgress` mounts with `progress = null` / `error = null`, immediately fetches
`GET /api/conversion/projects/{projectId}/progress`, and re-polls on a `setInterval`
(default `pollInterval = 2000`). It expects `{ data: ConversionProgress }`.

- Fetch failure (`!res.ok`, thrown `Error`, or a non-Error rejection) → sets `error`,
  renders a destructive error card (`進捗の取得に失敗しました: <message>` / `Unknown error`).
- On a successful poll it renders: a status icon + localized status text (`getStatusIcon`
  / `getStatusText`), a `Math.round(progress)` percentage + `<Progress value=…>`, the
  `processed / total` journal counts, an optional `estimatedCompletion` time, an optional
  `currentItem` line, and a capped error list (first 3 + `…他 N件` overflow).
- `onComplete` fires when a polled status is `completed`; it does **not** fire for
  `error` or any other status.
- Cleanup sets a `mounted = false` guard and `clearInterval`s on unmount.

## Coverage rationale

The component's only export is the `ProjectProgress` React component, so coverage is
organized by render state and lifecycle rather than per-method:

- **Loading state** — null-progress spinner path (`!progress` branch).
- **Fetch error handling** — every `error`-state branch: non-ok response (`throw`), `Error`
  rejection, non-Error rejection (`Unknown error`), and the destructive styling.
- **Status icon + text** — every `getStatusIcon`/`getStatusText` case (`converting`,
  `completed`, `error`, `validating`) plus the `default` fallback (raw status string +
  Clock). Includes the important distinction between the *data* `error` status and a
  *fetch* failure.
- **Progress value + bar** — `Math.round` rounding, `0`/`100` boundaries, and the
  indicator transform (the shadcn `Progress` does not forward `value` to `aria-valuenow`,
  so the `translateX(-(100-value)%)` transform is the deterministic reflection).
- **Journal counts** — happy-path and `0 / 0` boundary.
- **estimatedCompletion** — present/absent branches; expected time computed with the same
  `toLocaleTimeString('ja-JP')` call as the component so it is timezone-agnostic.
- **currentItem** — present/absent; asserted via the box `textContent` because the label
  and value are split across a `<span>` + sibling text node.
- **Error list** — ≤3 messages, the 3-entry cap with `…他 N件` overflow, and the empty
  list (no `<ul>`).
- **Polling** — mount fetch + URL, default-interval cadence, custom `pollInterval`, and
  error-card recovery on a subsequent successful poll.
- **onComplete** — fires on `completed`; does not fire on `error` or `converting`.
- **Cleanup / fail-safe** — interval is cleared after unmount (no further fetches), and an
  in-flight fetch resolving after unmount is a no-op via the `mounted` guard (no error).

## Determinism / isolation notes

- `vi.useFakeTimers()` + `vi.setSystemTime(NOW)` for a fixed clock; `fetch` stubbed per
  test; no real network/clock/random.
- The immediate mount-time fetch is flushed with `await vi.advanceTimersByTimeAsync(0)`
  inside `act` (this vitest 4.1.10 has no `vi.runAllTicksAsync`).
- `ResizeObserver` stubbed (the radix `Progress` peer); the loading-state case uses a
  never-resolving promise so `progress` stays null with no dangling setState.

## Assertions added (per test)

| # | Test | Assertions |
|---|------|-----------|
| 1 | loading state | spinner `.animate-spin` present; no `進捗の取得に失敗しました` text |
| 2 | non-ok response | error card text `…Failed to fetch progress` |
| 3 | fetch rejects (Error) | error card text `…network down` |
| 4 | fetch rejects (non-Error) | error card text `…Unknown error` |
| 5 | error card styling | `.border-destructive` present; `.text-destructive` present |
| 6 | converting | `変換中…`; `svg.animate-spin.text-primary` |
| 7 | completed | `完了`; `svg.text-green-500` |
| 8 | validating | `検証中…`; `svg.text-muted-foreground` |
| 9 | error status | no fetch-error card; `getAllByText('エラー')` ≥1; `svg.text-destructive` |
| 10 | default/mapping | `mapping`; `svg.text-muted-foreground`; no `.animate-spin` |
| 11 | rounding | `43%` for `42.6` |
| 12 | zero boundary | `0%` |
| 13 | max boundary | `100%` |
| 14 | progress bar | indicator `transform: translateX(-50%)` |
| 15 | journal counts | `7 / 42` |
| 16 | journal counts boundary | `0 / 0` |
| 17 | estimatedCompletion present | `完了予定` label; localized time matches |
| 18 | estimatedCompletion absent | no `完了予定` |
| 19 | currentItem present | box `textContent` = `処理中: 売掛金の変換` |
| 20 | currentItem absent | box absent; no `/処理中:/` |
| 21 | error list ≤3 | both messages present; no `他 N件` overflow |
| 22 | error list cap | `エラー1/2/3` present; `エラー4/5` absent; `他 2件` |
| 23 | error list empty | no `<ul>`; no `他 N件` |
| 24 | mount fetch | called 1× with `/api/conversion/projects/proj-1/progress` |
| 25 | default interval | call count 1 → 2 → 3 at 2000 ms steps |
| 26 | custom interval | call at 500 ms; not at +499 ms |
| 27 | error recovery | error card shown then replaced by `変換中…` |
| 28 | onComplete completed | `onComplete` called 1× |
| 29 | onComplete error | `onComplete` not called |
| 30 | onComplete converting | `onComplete` not called |
| 31 | interval cleared after unmount | fetch stays at 1× after +5000 ms |
| 32 | in-flight fetch after unmount | no `console.error` (mounted guard) |

**Total: 32 tests, ~70 assertions.**
