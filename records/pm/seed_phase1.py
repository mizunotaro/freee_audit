# SPDX-License-Identifier: MIT
"""Phase-1 thorough implementation wave for freee_audit (GLM worker tasks).

Authored by the Fable5/Opus maintainer session per the owner's "register tasks
exhaustively" instruction, grounded in BACKLOG.md (coverage>=80%, audit-log,
rate control, perf, DB indexes, report speed, audit accuracy) and the real
src/ layout. Class-A (financial correctness / audit verdicts / accounting
conversion / auth / crypto / security / prisma schema / freee integration) is
NEVER implemented by workers — those become audit-only proposal docs. Everything
else is minimal, additive, verified implementation.

Idempotent (skips existing ids); atomic write. Run from repo root:
    python records/pm/seed_phase1.py
"""
from __future__ import annotations
import json, os, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "records" / "pm" / "task_queue.json"
PROMPTS = ROOT / "records" / "pm" / "prompts"

CLASS_A_BAN = (
    "- DO NOT modify any Class-A path: `prisma/schema.prisma`, `prisma/migrations/**`, "
    "`src/lib/auth*`, `src/lib/crypto.ts`, `src/lib/security/**`, `src/lib/audit/**`, "
    "`src/services/audit/**`, `src/services/conversion/**`, `src/lib/conversion/**`, "
    "`src/services/valuation/**`, `src/services/tax/**`, `src/services/kpi/**`, "
    "`src/services/debt/**`, `src/services/deferred-accrual/**`, "
    "`src/services/journal-proposal/**`, `src/services/freee/**`, "
    "`src/lib/integrations/freee/**`, `src/app/api/{audit,journals,journal-proposal,"
    "valuation,tax,kpi,deferred-accrual,debt,freee,conversion,auth}/**`, "
    "`python-service/**`, `r-service/**`. Read-only reference to these is fine.\n"
)
COMMON = (
    "## Constraints (non-negotiable)\n" + CLASS_A_BAN +
    "- No `any`, `@ts-ignore`, `@ts-expect-error`, `.skip`, lint-disable, or "
    "coverage-threshold lowering. Fake green is forbidden — if something cannot "
    "be done safely, say so in the PR body and leave it.\n"
    "- Additive, minimal diffs; match existing idioms; new helpers return "
    "`Result<T,E>` (`@/types/result`); validate inputs with Zod `safeParse`.\n"
    "- Run ONLY the tests you add/modify (`pnpm exec vitest run <files>` or via "
    "autopm_verify) — never the full suite (known OOM).\n"
    "- No new dependencies.\n\n"
    "## Definition of done\n"
    "- `node scripts/autopm_verify.mjs --changed-only` exits 0.\n"
)
AUDIT_ONLY = (
    "## Constraints (non-negotiable) — AUDIT ONLY\n"
    "- Writes EXACTLY ONE file: the proposal doc named below. Touch NOTHING else "
    "(source is read-only for this task).\n" + CLASS_A_BAN +
    "- Findings per item, concrete proposed change, and every conclusion marked "
    "`PENDING HUMAN DETERMINATION`. NEVER write 'approved', a reviewer name, or a "
    "sign-off. This is analysis for a human, not a decision.\n\n"
    "## Definition of done\n- The single proposal doc exists (well-structured "
    "markdown) and `node scripts/autopm_verify.mjs --changed-only` exits 0.\n"
)

def T(id, title, rc, prio, files, body):
    return {"task": {"id": id, "title": title, "risk_class": rc, "priority": prio,
                     "status": "pending", "files": files,
                     "prompt_file": f"records/pm/prompts/{id}.md", "max_resume": 3},
            "prompt": f"# {id.upper()}: {title}\n\n{body}"}

def cov(id, prio, label, targets, testdir):
    tlist = "\n".join(f"- `{t}`" for t in targets)
    return T(id, f"Unit-test coverage: {label}", "C", prio,
             targets + [testdir],
             f"## Scope (non-Class-A)\nAdd focused unit tests for modules under:\n{tlist}\n\n"
             f"## Goal\nEnumerate exported functions lacking a mirror test under "
             f"`{testdir}`. Add real-assertion tests (happy path + key edge/error "
             f"cases) for up to ~10 modules this task. Prefer pure logic; mock IO/DB "
             f"at the boundary (use existing `tests/factories`, `tests/stubs`, "
             f"`tests/helpers`). For async-rejection paths, pre-attach the rejection "
             f"handler before advancing fake timers (known vitest worker-crash pattern).\n\n"
             + COMMON)

def audit(id, prio, title, scope, doc):
    return T(id, title, "C", prio, [f"docs/proposals/{doc}"],
             f"## Scope (READ-ONLY)\n{scope}\n\n## Output\nWrite `docs/proposals/{doc}` ONLY.\n\n"
             + AUDIT_ONLY)

SEEDS = [
  # ---- Wave A: coverage toward 80% (BACKLOG High) — non-Class-A services ----
  cov("cov-svc-01", 700, "analytics + benchmark + external-info",
      ["src/services/analytics","src/services/benchmark","src/services/external-info"], "tests/unit/services"),
  cov("cov-svc-02", 701, "budget + cashflow + closing",
      ["src/services/budget","src/services/cashflow","src/services/closing"], "tests/unit/services"),
  cov("cov-svc-03", 702, "currency + market-data + peer-companies",
      ["src/services/currency","src/services/market-data","src/services/peer-companies"], "tests/unit/services"),
  cov("cov-svc-04", 703, "fixed-assets + inventory + account-items",
      ["src/services/fixed-assets","src/services/inventory","src/services/account-items"], "tests/unit/services"),
  cov("cov-svc-05", 704, "social-insurance + board + investor",
      ["src/services/social-insurance","src/services/board","src/services/investor"], "tests/unit/services"),
  cov("cov-svc-06", 705, "report + reports + export + import",
      ["src/services/report","src/services/reports","src/services/export","src/services/import"], "tests/unit/services"),
  cov("cov-svc-07", 706, "storage + validation + dd (non-verdict helpers)",
      ["src/services/storage","src/services/validation","src/services/dd"], "tests/unit/services"),
  # ---- coverage: lib (non-Class-A) ----
  cov("cov-lib-01", 710, "lib/utils + lib/mappers",
      ["src/lib/utils","src/lib/utils.ts","src/lib/mappers"], "tests/unit/lib"),
  cov("cov-lib-02", 711, "lib/cache + lib/data + lib/storage",
      ["src/lib/cache","src/lib/data","src/lib/storage"], "tests/unit/lib"),
  cov("cov-lib-03", 712, "lib/api + lib/external + lib/i18n",
      ["src/lib/api","src/lib/external","src/lib/i18n"], "tests/unit/lib"),
  # ---- coverage: components ----
  cov("cov-comp-01", 720, "components/charts + components/currency",
      ["src/components/charts","src/components/currency"], "tests/components"),
  cov("cov-comp-02", 721, "components/reports + components/export",
      ["src/components/reports","src/components/export"], "tests/components"),
  cov("cov-comp-03", 722, "components/budget + components/import",
      ["src/components/budget","src/components/import"], "tests/components"),
  cov("cov-comp-04", 723, "components/settings + components/layout",
      ["src/components/settings","src/components/layout"], "tests/components"),
  cov("cov-comp-05", 724, "components/chat + components/ui (untested primitives)",
      ["src/components/chat","src/components/ui"], "tests/components"),

  # ---- Wave B: error-handling standardization (Result<T,E>) — non-Class-A ----
  T("err-01", "Standardize Result<T,E> in non-Class-A services (analytics/budget/cashflow/currency)",
    "C", 730, ["src/services/analytics","src/services/budget","src/services/cashflow","src/services/currency"],
    "## Goal\nIn the listed non-Class-A services, find functions that `throw` for "
    "expected failure conditions and convert them to return `Result<T,E>` "
    "(`@/types/result`), updating call sites within the same service. Do NOT change "
    "public signatures of anything imported by Class-A code (reference only). Keep "
    "behavior identical; add/extend tests to cover the error branch.\n\n" + COMMON),
  T("err-02", "Standardize Result<T,E> in report/reports/export/import services",
    "C", 731, ["src/services/report","src/services/reports","src/services/export","src/services/import"],
    "## Goal\nSame as err-01 for these services.\n\n" + COMMON),

  # ---- Wave C: rate control (BACKLOG High) — non-Class-A external callers ----
  T("rate-01", "Rate limiting + explicit User-Agent for non-Class-A external API callers",
    "B", 735, ["src/services/market-data","src/services/external-info","src/lib/external","src/lib/api/rate-limiters.ts"],
    "## Goal\nApply the existing rate-limiter utility (`src/lib/api/rate-limiters.ts` — "
    "read its API, do not rewrite it) to outbound calls in market-data / external-info / "
    "lib/external, and ensure a descriptive User-Agent header is set (CrystalBall policy). "
    "freee integration is Class-A — DO NOT touch it (see rate-02 proposal instead).\n\n" + COMMON),
  audit("rate-02", 736, "AUDIT-ONLY: rate-control + audit-log gaps in Class-A external callers (freee)",
        "Read `src/services/freee/**`, `src/lib/integrations/freee/**`, `src/app/api/freee/**`. "
        "Report where outbound calls lack rate limiting / User-Agent / audit logging and "
        "propose exact call sites.", "rate-02.md"),

  # ---- Wave D: audit-log coverage remainder (BACKLOG High) ----
  T("log-03", "Extend audit-logger to remaining non-Class-A mutating API routes",
    "B", 740, ["src/app/api"],
    "## Goal\nEnumerate mutating (POST/PUT/PATCH/DELETE) `route.ts` under `src/app/api/` "
    "OUTSIDE the Class-A list that still lack an `audit-logger` call. Add the existing "
    "logger call (read `src/lib/audit/audit-logger.ts`, do NOT modify it) recording "
    "actor(x-user-id)/action/target/outcome. GET handlers: skip. Class-A routes: skip "
    "(covered by log-002 proposal).\n\n" + COMMON),

  # ---- Wave E: UI robustness — loading/error/empty states + a11y ----
  T("ui-01", "Loading/error/empty states for report & chart components",
    "C", 745, ["src/components/reports","src/components/charts"],
    "## Goal\nEnsure each data-driven component renders explicit loading (skeleton), "
    "error, and empty states (match the existing skeleton pattern, e.g. `.animate-pulse`). "
    "Add tests asserting each state.\n\n" + COMMON),
  T("ui-02", "Accessibility pass on interactive components (budget/settings/export/import)",
    "C", 746, ["src/components/budget","src/components/settings","src/components/export","src/components/import"],
    "## Goal\nAdd missing aria-labels/roles, keyboard focus handling, and label-for "
    "associations on interactive elements. No visual/behavioral change. Add tests where "
    "feasible (role/name queries).\n\n" + COMMON),

  # ---- Wave F: performance (near-DB → audit-only proposals) ----
  audit("perf-01", 750, "AUDIT-ONLY: N+1 query / Prisma include audit for report & analytics reads",
        "Trace read paths in `src/services/report`, `src/services/reports`, "
        "`src/services/analytics` (read-only; do not touch Class-A). Identify N+1 patterns "
        "and missing `include`/`select`, propose concrete query changes and any index needs.",
        "perf-01.md"),
  audit("perf-02", 751, "AUDIT-ONLY: DB index optimization proposals for hot queries",
        "Read `prisma/schema.prisma` (READ-ONLY) and the hottest query sites. Propose "
        "indexes/composite keys for frequent filters/joins. Schema changes are human-only; "
        "this is a proposal.", "perf-02.md"),
  audit("perf-03", 752, "AUDIT-ONLY: large-dataset batch processing plan (journal ingest/audit)",
        "Per BACKLOG 'batch optimization': analyze `src/jobs/**` and audit ingest read "
        "paths (read-only) for 100k+ record handling; propose streaming/pagination/chunking.",
        "perf-03.md"),

  # ---- Wave G: docs (JSDoc / module docs) for non-Class-A ----
  T("doc-01", "JSDoc for exported APIs of non-Class-A services (analytics/budget/currency/report)",
    "C", 760, ["src/services/analytics","src/services/budget","src/services/currency","src/services/report"],
    "## Goal\nAdd concise JSDoc (purpose, params, returns, error/Result semantics) to "
    "EXPORTED functions lacking it. Documentation only — no logic change. (Project rule: "
    "no inline code comments beyond JSDoc on exports.)\n\n" + COMMON),

  # ---- Wave H: Class-A deep reviews — AUDIT ONLY (feed the human) ----
  audit("rev-audit-01", 770, "AUDIT-ONLY: journal-audit determination logic review",
        "Deep read `src/services/audit/**` and `src/app/api/audit/**`. Document the "
        "verdict logic, assumptions, edge cases, and correctness risks affecting audit "
        "accuracy (BACKLOG '監査精度>95%'). Propose test cases.", "rev-audit-01.md"),
  audit("rev-conv-01", 771, "AUDIT-ONLY: JGAAP<->IFRS/USGAAP conversion mapping review",
        "Deep read `src/services/conversion/**`, `src/lib/conversion/**`. Document mapping "
        "coverage, adjustment-entry generation, and correctness gaps. Propose test vectors.",
        "rev-conv-01.md"),
  audit("rev-val-01", 772, "AUDIT-ONLY: valuation numerical-correctness review (DCF/WACC/Monte Carlo)",
        "Deep read `src/services/valuation/**` and `python-service/**` (read-only). Document "
        "formulas vs standards, numerical-stability/edge risks, and propose property/golden tests.",
        "rev-val-01.md"),
  audit("rev-tax-01", 773, "AUDIT-ONLY: tax + deferred-accrual + debt calculation review",
        "Deep read `src/services/{tax,deferred-accrual,debt}/**`. Document calculation "
        "correctness, statutory assumptions, and edge risks; propose tests.", "rev-tax-01.md"),
  audit("rev-sec-01", 774, "AUDIT-ONLY: security review (auth/crypto/RBAC/secrets)",
        "Deep read `src/lib/{auth*,crypto.ts,security}`, `src/services/secrets`, "
        "`src/app/api/auth/**`. Document RBAC enforcement, AES-256-GCM usage, JWT lifecycle, "
        "secret handling, and risks; propose hardening + tests.", "rev-sec-01.md"),
]

def main() -> int:
    data = json.loads(QUEUE.read_text(encoding="utf-8"))
    existing = {t["id"] for t in data.get("tasks", [])}
    PROMPTS.mkdir(parents=True, exist_ok=True)
    added = 0
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
    print(f"\nseeded {added} new task(s); queue total now {len(data['tasks'])}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
