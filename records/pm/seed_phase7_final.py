# SPDX-License-Identifier: MIT
"""Phase-7: the last substantive non-Class-A wave (likely final). Prior waves
done (done>175). These are the remaining genuinely-valuable, no-new-dependency
items: dead-code sweep, i18n coverage, large-file refactor, input-validation
completeness, logging completeness, and non-Class-A perf proposal impl.
Class-A stays human-gated. Idempotent; atomic."""
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
  T("deadcode-01", "Thorough dead-code / unused-export sweep across non-Class-A", "C", 600,
    ["src/services", "src/lib", "src/components"],
    "## Goal\nRepo-wide: find exports/functions/files with ZERO importers (grep incl. "
    "dynamic-import strings and route conventions) in NON-Class-A modules and remove "
    "them + their tests. Be conservative — only remove if provably unreferenced; if "
    "unsure, list in the PR body and leave. Never touch Class-A or anything it "
    "imports.\n\n" + COMMON),
  T("i18n-cov-01", "i18n coverage: key remaining hard-coded user-facing strings (non-Class-A UI)", "C", 601,
    ["src/components", "src/lib/i18n"],
    "## Goal\nFind hard-coded user-facing strings in NON-Class-A UI components that "
    "bypass the i18n layer; move them to the i18n catalog and reference by key. Keep "
    "existing behavior/text. Add/adjust tests. Do not touch Class-A views.\n\n" + COMMON),
  T("refactor-large-01", "Split the largest non-Class-A source files for maintainability", "C", 602,
    ["src/services", "src/lib"],
    "## Goal\nIdentify the largest NON-Class-A source files (e.g. >400 lines) and split "
    "each into cohesive modules (extract helpers/sub-concerns), preserving the public "
    "API and behavior. Update imports + tests. No behavior change; never touch "
    "Class-A.\n\n" + COMMON),
  T("validate-01", "Zod input-validation completeness on remaining non-Class-A API routes", "C", 603,
    ["src/app/api", "tests/integration"],
    "## Goal\nAudit NON-Class-A API routes for request inputs not validated with a Zod "
    "`safeParse` (query/body/params); add schemas returning 400 on bad input. Add "
    "tests for the 400 path. Do not touch Class-A routes.\n\n" + COMMON),
  T("obs-02", "Structured-logging completeness across remaining non-Class-A services", "C", 604,
    ["src/services", "src/lib/utils"],
    "## Goal\nEnsure remaining NON-Class-A services use the project logger (structured "
    "fields, levels) instead of console.*; keep audit-logging untouched (Class-A). Add "
    "tests where log output is contractual. No new deps.\n\n" + COMMON),
  T("perf-impl-02", "Implement remaining non-Class-A recommendations from perf-02/perf-03 proposals", "B", 605,
    ["docs/proposals/perf-02.md", "docs/proposals/perf-03.md", "src/services", "src/lib/cache"],
    "## Goal\nRead docs/proposals/perf-02.md and perf-03.md. Implement any NON-Class-A "
    "recommendations not yet done (memoization, pagination, query shaping, cache use) "
    "in non-Class-A read paths. Anything touching Class-A stays deferred (note in PR "
    "body). Add/adjust tests; no regression.\n\n" + COMMON),
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
