# SEC-AUDIT-01 — Make `audit:check` real (fail on critical) + resolve critical advisories

## Outcome

- `audit:check` is no longer fake-green: the `|| true` is removed and the level
  is tightened from `moderate` → **`critical`**. It now exits non-zero when any
  critical advisory is present.
- The one current **critical** advisory (vitest <4.1.0, GHSA-5xrq-8626-4rwp) is
  **resolved**, so `pnpm audit --audit-level=critical` → **exit 0**.
- Cheap **high** advisories resolved in passing (direct deps + safe transitive
  overrides). The remaining 3 highs are **dev-server-only** (Vite) and are
  **deferred-for-human** with rationale below — they cannot be fixed without
  either adding a new direct dependency (forbidden) or accepting a non-functional
  override that emits misleading peer warnings.

`node scripts/autopm_verify.mjs --changed-only` → **exit 0**
(diff is deps + lockfile only → `other` bucket; no TS/test steps triggered).
vitest 4.1.10 smoke-tested manually: `tests/unit/types/result.test.ts` → 30/30
pass (runner bump verified, no fake green).

## Audit result (before → after)

| Severity  | Before | After |
|-----------|-------:|------:|
| critical  | 1      | **0** |
| high      | 32     | 3 (deferred, dev-server-only) |
| moderate  | 46     | 21    |
| low       | 10     | 4     |
| **total** | **89** | **28** |

## What changed

### `package.json` — scripts

```diff
- "audit:check": "pnpm audit --audit-level=moderate || true"
+ "audit:check": "pnpm audit --audit-level=critical"
```

This is the core deliverable. `--audit-level=critical` makes the gate fail only
on criticals (the agreed bar); removing `|| true` makes the exit code propagate.
CI job is left **non-required** (promotion to required is the owner's call once
green), per the task brief.

### `package.json` — direct dependency floors (security patches, same major)

| Package                 | Before     | After      | Advisory | Why safe |
|-------------------------|------------|------------|----------|----------|
| `vitest` (dev)          | `^4.0.18`  | `^4.1.0`   | CRITICAL GHSA-5xrq-8626-4rwp (arbitrary file read/exec via Vitest UI server) | Same major (4.0→4.1 minor). Runner smoke-tested (30/30). Vitest UI server is not exposed in this app. |
| `@vitest/coverage-v8` (dev) | `^4.0.18` | `^4.1.0` | (kept in lockstep with vitest) | Must match vitest's major. |
| `next`                  | `^16.1.6`  | `^16.2.3`  | HIGH DoS with Server Components (patched 16.2.3) | Same major; `^16.1.6` already *permitted* 16.2.x — only the lockfile floor + resolution moved. Resolves to 16.2.10. |
| `eslint-config-next` (dev) | `^16.1.6` | `^16.2.3` | (alignment with `next`; versioned in lockstep by the Next team) | Same major, tracks `next`. |
| `mathjs`                | `^15.1.1`  | `^15.2.0`  | HIGH unsafe object property setter (patched 15.2.0) | Same major (minor). Mature math lib, 15.1→15.2 is additive. |

None of these touch a Class-A path. The Class-A exclusion list covers **source
files / dirs** (`src/lib/auth*`, `src/lib/crypto.ts`, `prisma/**`, the service &
API route trees, microservices, etc.); dependency version bumps are not source
edits and are explicitly permitted by the task ("version bumps of EXISTING deps
via pnpm are allowed"). No Class-A source file was modified.

### `package.json` — `pnpm.overrides` (transitive advisories)

Bumped two **existing** overrides and added surgical ones. All are patch-level
or same-minor bumps on packages already present — **no new packages added**.

| Override                | Action | Advisory path / why safe |
|-------------------------|--------|--------------------------|
| `flatted` `^3.4.0` → `^3.4.2` | bump existing | HIGH prototype-pollution (patched 3.4.2); tiny lib via `eslint>file-entry-cache>flat-cache`. Patch bump. |
| `undici` `^7.24.0` → `^7.28.0` | bump existing | HIGH TLS-cert bypass via SOCKS5 ProxyAgent (patched 7.28.0); stays in 7.x (jsdom consumer). |
| `axios` → `^1.15.1` (new) | add | HIGH NO_PROXY bypass (incomplete CVE-2025-62718 fix); via `@slack/web-api`. Same major (1.x). |
| `form-data` → `^4.0.6` (new) | add | HIGH CRLF injection; via `@slack/web-api`. Patch bump (4.0.x). |
| `tmp` → `^0.2.6` (new) | add | HIGH path traversal; via `exceljs`. Patch bump (0.2.x). |
| `lodash` → `^4.18.1` (new) | add | HIGH code injection via `_.template`; via `recharts`. 4.18.x is a drop-in security release over 4.17.21 — backward compatible. |
| `picomatch@2.3.1` → `2.3.2` (new) | **version-targeted** | HIGH ReDoS. The tree genuinely needs picomatch **2.x AND 4.x** (different majors via tailwindcss/chokidar vs sucrase/tinyglobby/fdir), so a global override is impossible. A version-targeted key bumps only the 2.3.1 resolution → 2.3.2 (patch). |
| `picomatch@4.0.3` → `4.0.4` (new) | **version-targeted** | Same ReDoS, the 4.x instance; 4.0.3 → 4.0.4 (patch). No cross-major downgrade. |

Verified post-install: picomatch resolves to 2.3.2 (×10) and 4.0.4 (×75) with
**no** vulnerable 2.3.1 / 4.0.3 remaining; no peer-dependency warnings from any
of the above overrides.

### `pnpm-lock.yaml`

Regenerated by `pnpm install` to reflect the new floors + overrides. This is the
mechanism by which the transitive fixes actually take effect (overrides are
meaningless without a lockfile rewrite).

## Deferred-for-human (documented, not forced)

### Vite — 3 HIGH advisories (dev-server-only)

`vite 7.3.1` is pulled in solely as a **peer** dependency of `vitest` and
`@vitejs/plugin-react`; no package declares it as a hard dependency. The three
advisories are all **Vite dev-server** issues (`server.fs.deny` bypass; dev-server
WebSocket arbitrary file read) — there is **no production attack surface** (this
app does not ship a Vite dev server; Vite is used only by the test runner /
build tooling).

A `vite` override (`^7.3.5`, then exact `7.3.6`) was attempted and **could not be
applied**: pnpm treats an override on a peer-only dependency as a *peer
preference*, not a force-install — vite stayed at 7.3.1 and pnpm emitted
misleading `unmet peer vite@7.3.5: found 7.3.1` warnings. `pnpm dedupe` and
`pnpm install --force` likewise left it at 7.3.1. The only way to force 7.3.6
would be to **add `vite` as a direct devDependency**, which violates the
"no new dependencies" constraint. The non-functional override was therefore
**removed** to avoid shipping misleading peer warnings.

Recommendation for the human reviewer: either (a) accept the residual risk
(dev-only), or (b) add `vite` as an explicit devDependency pinned to `^7.3.5`
in a follow-up (that is a new direct dep and was out of scope here).

### Remaining moderate / low

Out of scope per the task ("fix criticals; highs = fix cheap, list rest"). The
moderates are mostly transitive build-tooling chains (eslint/js-yaml,
typescript-eslint/brace-expansion, postcss, next-intl) that would need broader
override work or upstream releases.

## Verification

- `pnpm audit --audit-level=critical` → **exit 0** (0 criticals).
- `node scripts/autopm_verify.mjs --changed-only` → **exit 0**.
- vitest 4.1.10 runner smoke test: `tests/unit/types/result.test.ts` → 30/30 pass.
- `pnpm install` succeeds; the only peer warnings are **pre-existing**
  (`@react-pdf/renderer` vs react 19; `next-intl` vs next 16) and are **not**
  introduced by this change.

## PR labelling

This PR **must** carry `human-review-required` + `do-not-auto-merge` (security /
supply-chain changes never auto-merge). Labels to be applied via `gh pr edit`.
CI `audit` job remains **non-required** for now (owner promotes when green).
