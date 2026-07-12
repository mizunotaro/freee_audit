# gap-untested-module-f4bec378e7 — Unit tests for analysis-cache.ts

**Target:** `src/app/api/analysis/cache/analysis-cache.ts`
**Risk class:** B
**Test file added:** `tests/unit/api/analysis/cache/analysis-cache.test.ts`
**Result:** 47 tests, all passing. `eslint --max-warnings=0` clean. `tsc --noEmit` clean for the file.

## Path / placement decision

The gap prompt suggested `tests/app/api/analysis/cache/`. The established repo
convention for `src/app/api/analysis/*` is the sibling tree `tests/unit/api/analysis/*`
(proven by `tests/unit/api/analysis/utils/{circuit-breaker,boundary-check,retry,sanitizer,validation}.test.ts`
mirroring `src/app/api/analysis/utils/*`, where the `app` segment is dropped under
`tests/unit/`). The only existing `tests/app/**` entries are `[locale]/(authenticated)/…`
page-component tests, not API-route utilities. To stay consistent with the nearest
siblings and the proven source→test mapping, the file was placed at
`tests/unit/api/analysis/cache/analysis-cache.test.ts`. Vitest's include glob
(`tests/**/*.test.ts`) discovers it identically either way.

The module is time-dependent (`Date.now()` drives TTL/expiry), so every suite uses
`vi.useFakeTimers()` + `vi.setSystemTime()` for determinism (same pattern as the
existing `circuit-breaker.test.ts`). No new dependencies were added.

## Public surface covered

Every exported symbol is exercised:

| Symbol | Kind | Covered |
|---|---|---|
| `AnalysisCache` (class) | class | constructor, `get`, `set`, `invalidate`, `clear`, `has`, `size`, `generateHash` (private, indirectly) |
| `getAnalysisCache` | function | singleton identity + persistence |
| `clearAnalysisCache` | function | clears singleton; safe when uninitialized |
| `CacheEntry<T>` | interface | shape asserted via internal entry reads (data/timestamp/ttl/hash) |

## Assertions added (by group)

### constructor (2)
- Default `maxSize` is 100 — filling 100 slots keeps size at 100; a 101st new key overflows and evicts `k0` while keeping size at 100.
- A custom `maxSize` is stored on the instance.

### get (8)
- Returns stored data for a live key.
- Returns `undefined` for a missing key.
- Generic type is preserved through `get<number>`.
- Handles every JSON-serializable type (string, number, boolean, null, array, nested object).
- Returns the value while within the TTL window (`elapsed < ttl`).
- **Boundary:** returns the value at exactly `elapsed === ttl` (expiry uses `>`, not `>=`).
- Returns `undefined` once `elapsed > ttl`.
- **Fail-safe:** an expired entry is lazily deleted on read (size drops from 1 → 0), so stale data is never handed back.

### set (8)
- Stores data retrievable via `get`.
- Default TTL equals `CACHE_CONFIG.analysis.ttl` (3600000) when omitted.
- A custom TTL is honored.
- Entry timestamp equals `Date.now()` at write time.
- Overwriting an existing key replaces data and refreshes the timestamp (size stays 1).
- **Fail-safe:** refreshing a key resets its TTL window (no premature expiry after update).
- Hash is a hex string and is deterministic — identical payloads produce identical hashes; distinct payloads differ.
- **Error path:** `set(key, undefined)` throws `TypeError` (`JSON.stringify(undefined)` → `undefined` → `.length` throws).
- **Error path:** circular data throws `TypeError` (JSON.stringify circular-structure failure).

### eviction / maxSize (6)
- Evicts the oldest key when capacity is exceeded by a new key.
- Does **not** evict when updating an existing key at capacity (`!this.cache.has(key)` guard).
- `maxSize = 1` behaves as a single-slot cache.
- Re-setting a key promotes it to newest, changing which key is evicted next.
- **Behavioral fact:** `get` does **not** reorder access — eviction follows insertion/re-insertion order, not access (LRU) order. A recently-`get`'d key can still be evicted.
- **Degenerate config:** `maxSize = 0` still stores an entry (no prior entry exists to evict).

### invalidate (6)
- Removes only keys matching an anchored regex, leaving non-matching keys intact.
- No-op when nothing matches (size unchanged).
- Clears every key when the pattern matches all (`/.*/`).
- Matches anywhere in the key for an unanchored regex.
- Keeps `accessOrder` consistent so eviction keeps working correctly afterward.
- Safe to run against an empty cache.

### clear (3)
- Removes every entry (size → 0, `get` → `undefined`).
- Safe to run against an empty cache.
- Cache is repopulable after clearing.

### has (4)
- `true` for a live key.
- `false` for a missing key.
- **Fail-safe:** `false` for an expired key and the entry is dropped (size → 0).
- **Boundary:** `true` at exactly `elapsed === ttl`.

### size (3)
- `0` on a fresh cache.
- Reflects the live entry count.
- Decrements after `invalidate`.

### Singleton: getAnalysisCache / clearAnalysisCache (6)
- Returns an `AnalysisCache` instance.
- Returns the same instance on every call (identity equality).
- Data set on the singleton persists across calls until cleared.
- `clearAnalysisCache` empties the shared instance.
- Identity is stable across clear (same instance before and after).
- `clearAnalysisCache` is safe when no instance has been created yet.

## Coverage rationale

- **Happy paths:** every public method has a forward-path assertion.
- **Edge / boundary:** TTL boundary probed at `< ttl`, `=== ttl`, `> ttl`; `maxSize`
  probed at 0, 1, 2, and the default 100; eviction probed at exact capacity and on
  update-in-place; regex matching probed anchored, unanchored, all-match, no-match.
- **Error paths:** two real throw modes documented — `undefined` data and circular
  references both break the internal `JSON.stringify`-based `generateHash`.
- **Fail-safe behavior:** three assertions pin that the cache never serves stale data
  (expired entries are dropped lazily on both `get` and `has`) and that TTL refresh on
  update prevents premature expiry.
- **Determinism:** all time is faked via `vi.useFakeTimers()`/`vi.setSystemTime()`;
  no real clock, network, or unseeded randomness is involved. External collaborator
  (`CACHE_CONFIG`) is read through its real export, not mocked.

## Quality gates

- `corepack pnpm exec vitest run tests/unit/api/analysis/cache/analysis-cache.test.ts` → 47/47 pass.
- `corepack pnpm exec eslint <file> --max-warnings=0` → clean.
- `corepack pnpm exec tsc --noEmit` → no errors in the new file (prisma client
  generated first via `corepack pnpm db:generate`).
