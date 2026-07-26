# SPDX-License-Identifier: MIT
"""Phase-2 wave: unblock the merge queue + broaden implementation.
Reuses phase1's Class-A bans / verify DoD. Idempotent; atomic. Run from repo root."""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path
import importlib.util

_spec = importlib.util.spec_from_file_location("_p1", str(Path(__file__).parent / "seed_phase1.py"))
_p1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_p1)
T, cov, audit, COMMON = _p1.T, _p1.cov, _p1.audit, _p1.COMMON
ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

SEEDS = [
  # ===== P0: unblock the merge queue (one failing unit shard blocks ALL PRs) =====
  T("ci-fix-01", "Fix the failing unit-test shard blocking the merge queue", "C", 1,
    ["tests"],
    "## Context\nGitHub CI shards unit tests into 64. One shard fails (observed: "
    "shards ~34 and ~36 of 64) so the aggregate `Unit Tests` required check is red "
    "and EVERY open PR is BLOCKED from merge.\n\n"
    "## Goal\n1. Reproduce: run the failing shard locally "
    "(`pnpm exec vitest run --shard=34/64`, `--shard=36/64`; adjust to vitest.config). "
    "Identify the failing test file(s).\n"
    "2. Root cause: a bug in the TEST (fix the test); a flaky async/timer issue (make "
    "deterministic — pre-attach rejection handlers before advancing fake timers, avoid "
    "cross-test global state); or a real product bug. If the product bug is non-Class-A, "
    "fix it; if Class-A, `it.skip` it with a `// TODO(human): Class-A bug` note and "
    "report it in the PR body.\n"
    "3. Do NOT delete/loosen assertions to force green. No `.skip` except the Class-A "
    "escape. The shard must genuinely pass.\n\n"
    "## Definition of done\n- The identified shard(s) pass: "
    "`pnpm exec vitest run --shard=<n>/64` exits 0.\n"
    "- `node scripts/autopm_verify.mjs --changed-only` exits 0. PR body names the "
    "failing test(s) and root cause.\n"),
  T("ci-fix-02", "Fix E2E CSRF_SECRET (>=32 chars) so the E2E job is green", "C", 2,
    [".github/workflows/ci.yml", "playwright.config.ts", ".env.example"],
    "## Context\nThe `E2E Tests` CI job fails because CSRF_SECRET is <32 chars "
    "(needs >=32).\n## Goal\nSet a 32+ char test CSRF_SECRET in the E2E job env "
    "(ci.yml), mirroring how JWT_SECRET/ENCRYPTION_KEY are supplied to other jobs. "
    "Test-only value. Do not touch Class-A code.\n\n" + COMMON),

  # ===== Wave I: finish Result<T,E> across remaining non-Class-A services =====
  T("err-03", "Result<T,E> in benchmark/external-info/closing/market-data", "C", 800,
    ["src/services/benchmark", "src/services/external-info", "src/services/closing", "src/services/market-data"],
    "## Goal\nConvert expected-failure throws to `Result<T,E>` in these non-Class-A "
    "services, update same-service call sites, add error-branch tests. Keep behavior.\n\n" + COMMON),
  T("err-04", "Result<T,E> in peer-companies/fixed-assets/inventory/account-items", "C", 801,
    ["src/services/peer-companies", "src/services/fixed-assets", "src/services/inventory", "src/services/account-items"],
    "## Goal\nSame as err-03 for these services.\n\n" + COMMON),
  T("err-05", "Result<T,E> in social-insurance/board/investor/storage/validation", "C", 802,
    ["src/services/social-insurance", "src/services/board", "src/services/investor", "src/services/storage", "src/services/validation"],
    "## Goal\nSame as err-03 for these services.\n\n" + COMMON),

  # ===== Wave J: integration tests for non-Class-A API routes =====
  T("int-01", "Integration tests: dashboard/analysis/reports API routes", "C", 810,
    ["src/app/api/dashboard", "src/app/api/analysis", "src/app/api/reports", "tests/integration"],
    "## Goal\nAdd integration tests (request->handler->response; DB/AI mocked via "
    "tests/stubs) for these non-Class-A routes: auth guard, input validation (400 on "
    "bad input), happy-path shape. Use tests/helpers + tests/factories.\n\n" + COMMON),
  T("int-02", "Integration tests: board/dd/inventory/social-insurance/settings routes", "C", 811,
    ["src/app/api/board", "src/app/api/dd", "src/app/api/inventory", "src/app/api/social-insurance", "src/app/api/settings", "tests/integration"],
    "## Goal\nSame as int-01 for these non-Class-A routes.\n\n" + COMMON),
  T("int-03", "Integration tests: export/import/investor routes", "C", 812,
    ["src/app/api/export", "src/app/api/import", "src/app/api/investor", "tests/integration"],
    "## Goal\nSame as int-01 for these non-Class-A routes.\n\n" + COMMON),

  # ===== Wave K: implement non-Class-A parts of the landed proposals =====
  T("impl-perf-01", "Implement non-Class-A query/caching improvements from docs/proposals/perf-01.md", "B", 820,
    ["docs/proposals/perf-01.md", "src/services/report", "src/services/reports", "src/services/analytics", "src/lib/cache"],
    "## Goal\nRead docs/proposals/perf-01.md (on master). Implement ONLY the non-Class-A "
    "recommendations (fix N+1 via select/include, add caching via src/lib/cache) in "
    "report/reports/analytics read paths. Anything touching Class-A stays untouched — "
    "note deferred in PR body. Add/adjust tests; no regression.\n\n" + COMMON),
  T("impl-batch-01", "Implement non-Class-A streaming/pagination from docs/proposals/perf-03.md", "B", 821,
    ["docs/proposals/perf-03.md", "src/jobs", "src/services/report"],
    "## Goal\nRead docs/proposals/perf-03.md. Implement the non-Class-A batching/"
    "pagination/streaming recommendations in src/jobs and non-Class-A read paths. Do "
    "NOT touch audit/journal-ingest verdict logic (Class-A). Add tests.\n\n" + COMMON),

  # ===== Wave L: UI a11y + states for remaining component groups (UI layer only) =====
  T("ui-03", "Loading/error/empty states + a11y: chat/conversion/journal-proposal components", "C", 830,
    ["src/components/chat", "src/components/conversion", "src/components/journal-proposal"],
    "## Goal\nExplicit loading(skeleton)/error/empty states + aria/keyboard a11y for "
    "these UI component groups; add state tests; no visual regression. Do not modify "
    "Class-A service logic these components call.\n\n" + COMMON),
  T("ui-04", "Loading/error/empty states + a11y: valuation/currency components (UI only)", "C", 831,
    ["src/components/valuation", "src/components/currency"],
    "## Goal\nSame as ui-03. NOTE: src/components/valuation is the presentational UI "
    "layer — do NOT touch src/services/valuation (Class-A).\n\n" + COMMON),

  # ===== Wave M: coverage — remaining non-Class-A ai/lib =====
  cov("cov-svc-08", 840, "ai (non-security orchestration helpers) + analytics deeper",
      ["src/services/ai", "src/services/analytics"], "tests/unit/services"),
  cov("cov-lib-04", 841, "lib/ai (non-security) + lib/prompts",
      ["src/lib/ai", "src/lib/prompts"], "tests/unit/lib"),

  # ===== Wave N: structured logging (non-Class-A) =====
  T("obs-01", "Structured logging for non-Class-A services (consistent logger + levels)", "C", 850,
    ["src/lib/utils", "src/services/report", "src/services/analytics"],
    "## Goal\nMake non-Class-A services use the project's existing logger consistently "
    "(structured fields, levels) instead of console.*. Read the existing logging util; "
    "no new deps; no audit-log changes (that is audit-logger's role). Add tests where "
    "log output is part of the contract.\n\n" + COMMON),

  # ===== Wave O: JSDoc for remaining non-Class-A services =====
  T("doc-02", "JSDoc for exported APIs: benchmark/cashflow/inventory/reports services", "C", 860,
    ["src/services/benchmark", "src/services/cashflow", "src/services/inventory", "src/services/reports"],
    "## Goal\nAdd concise JSDoc to EXPORTED functions lacking it (purpose/params/"
    "returns/Result semantics). Docs only.\n\n" + COMMON),

  # ===== Wave P: dead-code sweep (non-Class-A) =====
  T("clean-01", "Remove provably-unused non-Class-A exports/dead code", "C", 870,
    ["src/lib/utils", "src/services/analytics", "src/services/benchmark"],
    "## Goal\nFind exports with ZERO importers (grep the whole repo incl. dynamic "
    "import strings) in these non-Class-A modules and remove them + their tests. Only "
    "remove if provably unreferenced; if unsure, leave and note in PR body. Never touch "
    "Class-A or anything it imports.\n\n" + COMMON),
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
        print(f"seeded {t['id']:14s} rc={t['risk_class']} prio={t['priority']}")
    fd, tmp = tempfile.mkstemp(dir=str(QUEUE.parent), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, QUEUE)
    print(f"\nseeded {added}; queue total {len(data['tasks'])}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
