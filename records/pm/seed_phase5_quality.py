# SPDX-License-Identifier: MIT
"""Phase-5: quality & depth wave. The mechanical coverage/impl waves are done
(done>150); this keeps the fleet on GENUINELY valuable non-Class-A work —
end-to-end user flows, integration depth, a safe coverage ratchet, error-path
and a11y depth, and docs. Class-A stays audit-only. Idempotent; atomic."""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path
import importlib.util

_spec = importlib.util.spec_from_file_location("_p1", str(Path(__file__).parent / "seed_phase1.py"))
_p1 = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_p1)
T, COMMON = _p1.T, _p1.COMMON
ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

SEEDS = [
  # ---- Coverage ratchet (lock in the gains safely) ----
  T("cov-ratchet-01", "Measure real coverage and raise vitest thresholds to a safe floor", "C", 400,
    ["vitest.config.ts"],
    "## Goal\nCoverage is now high (many cov-*/gap-* tasks done) but thresholds are "
    "stuck at 60/55/45/60. Run `pnpm test:coverage` (or the sharded-merge path if "
    "needed), read the ACTUAL totals, and raise vitest.config.ts thresholds to just "
    "below the measured values (round DOWN to the nearest 5, leave ~2-3pt margin so a "
    "flaky delta doesn't fail CI). Never set a threshold ABOVE actual coverage. State "
    "old→new numbers + measured coverage in the PR body.\n\n" + COMMON),

  # ---- E2E user-flow depth (only a few flows exist) ----
  T("e2e-flow-01", "E2E: budget vs actual + variance flow (mock mode)", "C", 410,
    ["tests/e2e"],
    "## Goal\nE2E in FREEE_MOCK_MODE/AI_MOCK_MODE for the budget-vs-actual flow: "
    "navigate to the budget/variance view, assert the comparison renders, drivers/"
    "waterfall shows, and an export responds. Deterministic waits (roles/testids), no "
    "sleeps. UI-level only.\n\n" + COMMON),
  T("e2e-flow-02", "E2E: KPI dashboard + management-accounting view (mock mode)", "C", 411,
    ["tests/e2e"],
    "## Goal\nE2E for the KPI/managerial dashboards: cards render, charts render, "
    "filters apply. Mock mode; deterministic.\n\n" + COMMON),
  T("e2e-flow-03", "E2E: settings + data import flow (mock mode)", "C", 412,
    ["tests/e2e"],
    "## Goal\nE2E for settings save + CSV/data import happy path (mock mode): upload a "
    "small fixture, assert success state + validation error on a bad file.\n\n" + COMMON),

  # ---- Integration depth (routes not yet integration-tested) ----
  T("int-04", "Integration tests: benchmark/external-info/peer-companies routes", "C", 420,
    ["src/app/api", "tests/integration"],
    "## Goal\nAdd integration tests (auth guard, 400 on bad input, happy-path shape; "
    "DB/AI mocked at boundary) for these non-Class-A routes if present under "
    "src/app/api. Use tests/helpers + factories.\n\n" + COMMON),
  T("int-05", "Integration tests: market-data/fixed-assets/account-items routes", "C", 421,
    ["src/app/api", "tests/integration"],
    "## Goal\nSame as int-04 for these non-Class-A routes.\n\n" + COMMON),

  # ---- Error-path & edge-case depth ----
  T("edge-01", "Deepen error/edge-case tests in analytics + budget services", "C", 430,
    ["src/services/analytics", "src/services/budget", "tests/unit/services"],
    "## Goal\nFor already-tested modules in these non-Class-A services, add tests for "
    "under-covered branches: empty inputs, zero/negative, missing periods, boundary "
    "rounding. Real assertions; do not touch Class-A.\n\n" + COMMON),
  T("edge-02", "Deepen error/edge-case tests in report/reports/cashflow services", "C", 431,
    ["src/services/report", "src/services/reports", "src/services/cashflow", "tests/unit/services"],
    "## Goal\nSame as edge-01 for these non-Class-A services.\n\n" + COMMON),

  # ---- Accessibility depth ----
  T("a11y-01", "A11y + states audit: dashboard/analysis/settings component groups", "C", 440,
    ["src/components", "tests/components"],
    "## Goal\nFor these UI component groups, ensure aria roles/labels, keyboard nav, "
    "and explicit loading/error/empty states; add state + a11y assertions. UI layer "
    "only; no Class-A service changes.\n\n" + COMMON),

  # ---- Observability / docs ----
  T("doc-arch-01", "Author docs/ARCHITECTURE.md (module map + data flow, non-Class-A view)", "C", 450,
    ["docs"],
    "## Goal\nWrite a concise `docs/ARCHITECTURE.md`: top-level module map "
    "(services/lib/components/app-api), the request→service→db flow, the Result<T,E> "
    "+ Zod conventions, and the Class-A boundary (list the human-owned paths, "
    "read-only). New file only; do not edit protected docs.\n\n" + COMMON),
  T("doc-03", "JSDoc for remaining exported APIs: currency/closing/validation/storage", "C", 451,
    ["src/services/currency", "src/services/closing", "src/services/validation", "src/services/storage"],
    "## Goal\nConcise JSDoc on exported functions lacking it. Docs only.\n\n" + COMMON),

  # ---- Dedup / tech-debt ----
  T("dedup-01", "Consolidate duplicated helpers across non-Class-A services into lib/utils", "C", 460,
    ["src/lib/utils", "src/services/analytics", "src/services/report", "src/services/reports"],
    "## Goal\nFind small duplicated helpers (formatting, date/period math, safe number "
    "ops) copy-pasted across these non-Class-A modules; extract ONE canonical version "
    "into src/lib/utils and update importers. Behavior-preserving; add tests for the "
    "extracted helper; never touch Class-A.\n\n" + COMMON),
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
