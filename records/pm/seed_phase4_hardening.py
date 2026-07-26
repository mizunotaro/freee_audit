# SPDX-License-Identifier: MIT
"""Phase-4: hardening wave from the neutral evaluation (2026-07-09).
Security realization / E2E core flows / perf benchmark / vitest-leak root-cause /
PostgreSQL prep (proposal) / test-quality audit / data-quality validators / backup drill.
Idempotent; atomic. Run from repo root."""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path
import importlib.util

_spec = importlib.util.spec_from_file_location("_p1", str(Path(__file__).parent / "seed_phase1.py"))
_p1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_p1)
T, audit, COMMON, CLASS_A_BAN = _p1.T, _p1.audit, _p1.COMMON, _p1.CLASS_A_BAN
ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

# Security / supply-chain output must be owner-reviewed before merge.
SEC_RULES = (
    "## Constraints (security output — non-negotiable)\n" + CLASS_A_BAN +
    "- **PR MUST be labelled `human-review-required` + `do-not-auto-merge`** (security/"
    "supply-chain changes never auto-merge). PR body lists every change + why safe.\n"
    "- No fake green (no `||true`, no skips); no new dependencies (version bumps of "
    "EXISTING deps via pnpm are allowed for vuln fixes).\n\n"
    "## Definition of done\n- `node scripts/autopm_verify.mjs --changed-only` exits 0; "
    "labels applied.\n"
)

SEEDS = [
  # ===== Security realization =====
  T("sec-impl-01", "Implement NON-Class-A recommendations from docs/proposals/rev-sec-01.md", "B", 200,
    ["docs/proposals/rev-sec-01.md", "middleware.ts", "src/lib/api", "src/app/api/analysis/middleware"],
    "## Goal\nRead docs/proposals/rev-sec-01.md (on master). Implement ONLY its "
    "non-Class-A recommendations (e.g. security headers, rate-limit wiring, input "
    "hardening in non-banned paths). Anything touching Class-A (lib/auth*, crypto, "
    "lib/security, api/auth) stays untouched — list as deferred-for-human in the PR "
    "body. Add tests per change.\n\n" + SEC_RULES),
  T("sec-audit-01", "Make Security Audit REAL: remove ||true, fail on critical, fix criticals", "B", 201,
    ["package.json", ".github/workflows/ci.yml", "pnpm-lock.yaml"],
    "## Goal\n1. Change the `audit:check` script so it actually fails: "
    "`pnpm audit --audit-level=critical` (no `||true`).\n"
    "2. Resolve CURRENT critical advisories by updating the affected EXISTING "
    "dependencies (pnpm update / overrides in package.json). No new packages. If a "
    "critical cannot be fixed without a breaking major bump, document it in the PR "
    "body as deferred-for-human instead of forcing.\n"
    "3. Keep the CI job non-required for now (promotion to required is the owner's "
    "call once green).\n4. High-level advisories: fix the cheap ones, list the rest.\n\n"
    + SEC_RULES),

  # ===== E2E core flows (ci-fix-02 already queued fixes CSRF_SECRET) =====
  T("e2e-core-01", "E2E green baseline: smoke flow login->dashboard (mock mode)", "C", 210,
    ["tests/e2e", "playwright.config.ts"],
    "## Goal\nWith FREEE_MOCK_MODE/AI_MOCK_MODE, make a minimal happy-path E2E pass "
    "in CI: login (seed admin) -> dashboard renders. Fix remaining E2E env issues "
    "(CSRF_SECRET>=32 may already be fixed by ci-fix-02 — verify, don't duplicate). "
    "Stabilize selectors (roles/testids, no sleeps).\n\n" + COMMON),
  T("e2e-core-02", "E2E: monthly close/report flow (mock) — reports render + export", "C", 211,
    ["tests/e2e"],
    "## Goal\nE2E for the core business flow in mock mode: navigate to reports "
    "(BS/PL/CF), assert data renders, trigger an export (CSV or PDF) and assert a "
    "file/download response. Deterministic waits only.\n\n" + COMMON),
  T("e2e-core-03", "E2E: journal audit flow (mock) — run audit, see results", "C", 212,
    ["tests/e2e"],
    "## Goal\nE2E in mock mode: trigger a journal audit run from the UI, wait for "
    "completion state, assert result list renders with statuses. UI-level only "
    "(verdict logic is Class-A and mocked).\n\n" + COMMON),

  # ===== Performance evidence =====
  T("perf-bench-01", "Synthetic 100k-journal benchmark harness (BACKLOG evidence)", "B", 220,
    ["tests/benchmark", "tests/factories"],
    "## Goal\nAdd a deterministic synthetic-data generator (100k journal entries via "
    "existing factories; seeded RNG) and benchmark specs under tests/benchmark that "
    "measure: report aggregation, budget variance computation, and the hottest "
    "analysis queries. Output timings as a JSON report artifact. Must run standalone "
    "(`pnpm exec vitest run tests/benchmark/...`) and NOT in the default unit shards. "
    "No prod-code changes in this task; if a hotspot needs fixing, report it in the "
    "PR body as a follow-up candidate.\n\n" + COMMON),

  # ===== Test-infra debt =====
  T("leak-01", "Root-cause the vitest memory leak; un-quarantine the 2 test files", "B", 221,
    ["tests", "vitest.config.ts"],
    "## Goal\nThe full suite leaks (2 files quarantined; CI needs 64 shards). "
    "Root-cause it: run suspect groups with `--logHeapUsage`, bisect setup files, "
    "check the usual culprits (msw server not closed per file, unclosed prisma "
    "clients, jsdom listeners, timers not restored, module-level caches). Fix the "
    "leak at the source (afterEach/afterAll cleanup, singleton reset helpers). "
    "SUCCESS = the 2 quarantined files re-enabled and a representative multi-file "
    "run stays flat on heap. If the root cause is only PARTIALLY fixable, report "
    "findings honestly in the PR body and keep quarantine (do NOT fake it).\n\n" + COMMON),
  T("testq-01", "Assertion-strength audit of the gap-* test wave (anti-inflation)", "C", 222,
    ["docs/proposals/testq-01.md"],
    "## Goal\nWrite `scripts/test-quality-report.mjs` (dep-free) that scans test files "
    "added by gap-* PRs for weak patterns: assertion-free its, toBeDefined/"
    "toBeTruthy-only, snapshot-only, expect-count==0, disabled tests. Run it and "
    "write `docs/proposals/testq-01.md` ranking the weakest files with concrete "
    "strengthening suggestions (PENDING HUMAN DETERMINATION). Only those 2 files "
    "(script + report) — do not rewrite tests in this task.\n\n" + COMMON),

  # ===== Data quality =====
  T("dq-01", "Journal data-quality validators (duplicates/gaps/unbalanced flags)", "B", 230,
    ["src/services/validation", "tests/unit/services/validation"],
    "## Goal\nAdd read-only data-quality validators to `src/services/validation`: "
    "duplicate journal detection (same date/amount/accounts), date-gap detection per "
    "period, unbalanced-entry flag, missing-counterparty stats. Journals are "
    "READ-ONLY inputs; validators return findings (Result<T,E>), no mutation. Golden "
    "tests with crafted fixtures. This FLAGS quality only — no financial verdicts.\n\n" + COMMON),

  # ===== Ops =====
  audit("pg-prep-01", 231, "PROPOSAL: PostgreSQL migration plan (schema is Class-A/human)",
        "Read prisma/schema.prisma (READ-ONLY), docker/ and docker-compose files, and "
        "the DB access patterns. Produce a migration plan: SQLite->PostgreSQL type/"
        "constraint diffs, migration strategy (prisma migrate flow), docker-compose "
        "for local PG, test-matrix implications (CI service container), rollback "
        "plan, and data-copy verification steps.",
        "pg-prep-01.md"),
  T("backup-01", "DB backup/restore drill script + verification test", "C", 232,
    ["scripts", "docs"],
    "## Goal\nAdd `scripts/db-backup.mjs` and `scripts/db-restore.mjs` (dep-free, "
    "works for the current SQLite file; structured to extend to PG later): backup "
    "with timestamp+checksum, restore to a temp location, verify row counts match "
    "via prisma. Add a test that exercises backup->restore->verify on a seeded temp "
    "DB. Document usage in docs/DEPLOYMENT.md-adjacent file (new "
    "docs/OPERATIONS_BACKUP.md; do not edit protected docs).\n\n" + COMMON),
]

def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    existing = {t["id"] for t in data.get("tasks", [])}
    PROMPTS.mkdir(parents=True, exist_ok=True); added = 0
    for s in SEEDS:
        t, prompt = s["task"], s["prompt"]
        if t["id"] in existing:
            print("skip (exists):", t["id"]); continue
        (PROMPTS / f"{t['id']}.md").write_text(prompt, encoding="utf-8", newline="\n")
        data["tasks"].append(t); added += 1
        print(f"seeded {t['id']:16s} rc={t['risk_class']} prio={t['priority']}")
    fd, tmp = tempfile.mkstemp(dir=str(QUEUE.parent), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, QUEUE)
    print(f"\nseeded {added}; queue total {len(data['tasks'])}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
