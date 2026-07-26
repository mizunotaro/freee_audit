# SPDX-License-Identifier: MIT
"""Seed the approved Phase-0 wave plan into records/pm/task_queue.json.

Authored by the Fable 5 maintainer session (2026-07-07) per the owner's
instruction, following the Layer-2 supervisor's approved wave plan and the
exact prompt style of api-z-001. Idempotent (skips existing ids); atomic write.
Run from the repo root:  python records/pm/seed_phase0.py
"""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

CLASS_A_BAN = (
    "- DO NOT touch any path under `.autopm/`, `prisma/`, `src/lib/auth*`, "
    "`src/lib/crypto.ts`, `src/lib/audit/`, `src/services/audit/`, "
    "`src/lib/conversion/`, `src/services/conversion/`, "
    "`src/app/api/{audit,journals,journal-proposal,valuation,tax,kpi,"
    "deferred-accrual,debt,freee,conversion,auth}/**`, "
    "`src/services/{valuation,tax,kpi,deferred-accrual,debt,freee,"
    "journal-proposal}/**`, `src/lib/integrations/freee/`, "
    "`python-service/`, `r-service/`, `src/lib/ai/security/`.\n"
)

COMMON_RULES = (
    "## Constraints (worker rules — non-negotiable)\n"
    + CLASS_A_BAN +
    "- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable "
    "comments, or coverage-threshold changes. Fake green is forbidden.\n"
    "- Any new helper returns `Result<T, E>` per `@/types/result`; no thrown "
    "exceptions. Inputs validated with Zod `safeParse`.\n"
    "- Additive, minimal diffs; do not refactor surrounding code.\n"
    "- No new dependencies.\n\n"
    "## Definition of done\n"
    "- `node scripts/autopm_verify.mjs --changed-only` exits 0.\n"
    "- Honest completion: if part of the scope cannot be done safely, say so "
    "in the PR body instead of forcing it.\n"
)

AUDIT_ONLY_RULES = (
    "## Constraints (worker rules — non-negotiable)\n"
    "- READ-ONLY with respect to source: this task writes EXACTLY ONE file, "
    "the proposal document named below. Touch nothing else.\n"
    + CLASS_A_BAN +
    "- The document must state findings per route (validation present / "
    "missing / partial), a concrete Zod schema PROPOSAL per gap, and mark "
    "every conclusion `PENDING HUMAN DETERMINATION`. Never write 'approved', "
    "a reviewer name, or a sign-off.\n\n"
    "## Definition of done\n"
    "- The single proposal doc exists, is well-structured markdown, and "
    "`node scripts/autopm_verify.mjs --changed-only` exits 0 (docs-only diff).\n"
)


def t(id, title, risk, prio, files, body):
    return {
        "task": {
            "id": id, "title": title, "risk_class": risk, "priority": prio,
            "status": "pending", "files": files,
            "prompt_file": f"records/pm/prompts/{id}.md", "max_resume": 3,
        },
        "prompt": f"# {id.upper()}: {title}\n\n{body}",
    }


SEEDS = [
    # ---- Wave 2: Zod implement lots (Class B areas) ----
    t("api-z-002", "Audit Zod input validation for reports(monthly,periodic) + export(csv,pptx)",
      "B", 200,
      ["src/app/api/reports/", "src/app/api/export/"],
      "## Scope\nAll `route.ts` under `src/app/api/reports/monthly/`, "
      "`src/app/api/reports/periodic/`, `src/app/api/export/csv/`, "
      "`src/app/api/export/pptx/` (enumerate them first; list in the PR body).\n\n"
      "## Goal\nSame procedure as api-z-001: read each handler; where request "
      "input (query/body) lacks Zod validation, add a minimal conservative "
      "schema + `safeParse` returning 400 on failure; leave sufficient "
      "validation untouched.\n\n" + COMMON_RULES),
    t("api-z-003", "Audit Zod input validation for reports(kpi,budget,cashflow,business) + analysis",
      "B", 210,
      ["src/app/api/reports/", "src/app/api/analysis/"],
      "## Scope\nAll `route.ts` under `src/app/api/reports/{kpi,budget,cashflow,business}/` "
      "and `src/app/api/analysis/` (enumerate; list in PR body).\n\n"
      "## Goal\nSame procedure as api-z-001 (add minimal Zod safeParse where "
      "missing, 400 on failure, no-op where sufficient).\n\n" + COMMON_RULES),
    t("api-z-004", "Audit Zod input validation for board(meetings,items) + dd/checklists",
      "B", 220,
      ["src/app/api/board/", "src/app/api/dd/"],
      "## Scope\nAll `route.ts` under `src/app/api/board/` and `src/app/api/dd/` "
      "(enumerate; list in PR body).\n\n"
      "## Goal\nSame procedure as api-z-001.\n\n" + COMMON_RULES),
    t("api-z-005", "Audit Zod input validation for inventory + social-insurance + settings",
      "B", 230,
      ["src/app/api/inventory/", "src/app/api/social-insurance/", "src/app/api/settings/"],
      "## Scope\nAll `route.ts` under `src/app/api/inventory/`, "
      "`src/app/api/social-insurance/`, `src/app/api/settings/` "
      "(enumerate; list in PR body).\n\n"
      "## Goal\nSame procedure as api-z-001. Note: settings handlers touching "
      "AI-provider secrets must keep the existing sanitizer behavior intact.\n\n"
      + COMMON_RULES),
    # ---- Wave 2: Class-A areas — audit-only proposal docs (docs diff = C) ----
    t("api-z-006", "AUDIT-ONLY: Zod validation gap report for audit/journals/journal-proposal APIs",
      "C", 300, ["docs/proposals/api-z-006.md"],
      "## Scope (read-only)\nRead every `route.ts` under `src/app/api/audit/`, "
      "`src/app/api/journals/`, `src/app/api/journal-proposal/`.\n\n"
      "## Output\nWrite `docs/proposals/api-z-006.md` ONLY.\n\n" + AUDIT_ONLY_RULES),
    t("api-z-007", "AUDIT-ONLY: Zod validation gap report for valuation/tax/kpi/deferred-accrual/debt APIs",
      "C", 310, ["docs/proposals/api-z-007.md"],
      "## Scope (read-only)\nRead every `route.ts` under `src/app/api/valuation/`, "
      "`src/app/api/tax/`, `src/app/api/kpi/`, `src/app/api/deferred-accrual/`, "
      "`src/app/api/debt/`.\n\n"
      "## Output\nWrite `docs/proposals/api-z-007.md` ONLY.\n\n" + AUDIT_ONLY_RULES),
    t("api-z-008", "AUDIT-ONLY: Zod validation gap report for conversion/freee/auth/investor APIs",
      "C", 320, ["docs/proposals/api-z-008.md"],
      "## Scope (read-only)\nRead every `route.ts` under `src/app/api/conversion/`, "
      "`src/app/api/freee/`, `src/app/api/auth/`, `src/app/api/investor/`, "
      "`src/app/api/import/`, `src/app/api/prompts/`.\n\n"
      "## Output\nWrite `docs/proposals/api-z-008.md` ONLY.\n\n" + AUDIT_ONLY_RULES),
    # ---- Wave 3: coverage (Class C) ----
    t("cov-001", "Unit-test coverage for src/lib/utils (smoke + edge cases)",
      "C", 400, ["src/lib/utils/", "tests/unit/lib/utils/"],
      "## Scope\nEnumerate modules under `src/lib/utils/` lacking a mirror test "
      "in `tests/unit/lib/utils/`. Add focused tests (5-10 files max this task; "
      "prefer pure functions; real assertions, no snapshot-only tests).\n\n"
      "## Note\nThe full suite has a known memory issue — run only the tests "
      "you add/modify locally (`pnpm exec vitest run <files>` or via "
      "autopm_verify), never the whole suite.\n\n" + COMMON_RULES),
    t("cov-002", "Unit-test coverage for shared/common components",
      "C", 410, ["src/components/", "tests/unit/components/"],
      "## Scope\nEnumerate components under `src/components/{shared,common}/` "
      "lacking tests; add render + interaction tests for up to 8 components "
      "(use Testing Library queries correctly: `getAllBy*` when multiple "
      "matches are legitimate; assert counts).\n\n" + COMMON_RULES),
    t("cov-003", "Unit-test coverage for hooks",
      "C", 420, ["src/hooks/", "tests/unit/"],
      "## Scope\nEnumerate custom hooks (`src/hooks/` and any `hooks/` folders "
      "outside the (dashboard) group already covered). Add renderHook-based "
      "tests for up to 6 hooks: initial state, primary action, error path. "
      "For async rejection paths pre-attach rejection handlers before timer "
      "advances (known vitest worker-crash pattern in this repo).\n\n" + COMMON_RULES),
    # ---- Wave 4: audit-log coverage (non-A implement; A = proposal) ----
    t("log-001", "Wire audit-logger into non-Class-A API routes that lack it",
      "B", 500, ["src/app/api/", "src/lib/audit/audit-logger.ts"],
      "## Scope\nEnumerate `route.ts` files OUTSIDE the banned Class-A list "
      "below. For each handler performing a mutating action (POST/PUT/DELETE) "
      "without an audit-log call, add the existing `audit-logger` call "
      "(read its API from `src/lib/audit/audit-logger.ts` — do NOT modify it) "
      "recording actor (x-user-id), action, target, and outcome. Read-only GET "
      "handlers: skip.\n\n" + COMMON_RULES),
    t("log-002", "AUDIT-ONLY: audit-log gap report for Class-A API routes",
      "C", 510, ["docs/proposals/log-002.md"],
      "## Scope (read-only)\nRead the Class-A routes (audit, journals, "
      "journal-proposal, valuation, tax, kpi, deferred-accrual, debt, freee, "
      "conversion, auth). Report which mutating handlers lack audit logging "
      "and propose the exact call site + payload for each.\n\n"
      "## Output\nWrite `docs/proposals/log-002.md` ONLY.\n\n" + AUDIT_ONLY_RULES),
    # ---- Wave 5 ----
    t("i18n-001", "i18n key-diff audit and completion (messages/ja.json vs en.json)",
      "C", 600, ["messages/ja.json", "messages/en.json"],
      "## Scope\nDiff the key sets of `messages/ja.json` and `messages/en.json` "
      "(deep keys). For keys present in ja but missing in en: add an accurate, "
      "natural English translation (never machine-garbled placeholders; if a "
      "term is domain-specific, translate faithfully — 仕訳=journal entry, "
      "証憑=supporting document, 減価償却=depreciation). For keys in en missing "
      "in ja: add the Japanese. Preserve key order/structure; report counts in "
      "the PR body.\n\n" + COMMON_RULES),
    t("ocr-001", "pytest skeletons for ocr-server (FastAPI)",
      "C", 610, ["ocr-server/"],
      "## Scope\n`ocr-server/main.py` currently has zero tests. Create "
      "`ocr-server/tests/` with pytest tests: import/app-construction smoke, "
      "route registration, and pure-function tests for any parsing/utility "
      "logic. Use FastAPI TestClient for a health/basic endpoint if one "
      "exists. Do NOT invoke real OCR models — mock model calls at the "
      "boundary. Real assertions only (no placeholder skips).\n\n"
      "## Note\n`ocr-server/` is NOT a Class-A path, but keep changes strictly "
      "inside `ocr-server/tests/` plus (if required) a minimal conftest.\n\n"
      + COMMON_RULES),
]


def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    existing = {x["id"] for x in data.get("tasks", [])}
    PROMPTS.mkdir(parents=True, exist_ok=True)
    added = 0
    for s in SEEDS:
        task, prompt = s["task"], s["prompt"]
        if task["id"] in existing:
            print(f"skip (exists): {task['id']}")
            continue
        (PROMPTS / f"{task['id']}.md").write_text(prompt, encoding="utf-8", newline="\n")
        data["tasks"].append(task)
        added += 1
        print(f"seeded: {task['id']}  prio={task['priority']}  rc={task['risk_class']}")
    fd, tmp = tempfile.mkstemp(dir=str(QUEUE.parent), suffix=".json")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    os.replace(tmp, QUEUE)
    print(f"\ntotal seeded now: {added} (queue total: {len(data['tasks'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
