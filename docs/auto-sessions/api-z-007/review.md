# API-Z-007 — Session review (audit-only)

> Authoritative output for this task: **`docs/proposals/api-z-007.md`**.
> This file is framework session bookkeeping only; it summarizes the audit and is
> **PENDING HUMAN DETERMINATION** throughout. No source was changed.

## Task shape
READ-ONLY audit of Zod input validation across 5 API domains. Writes exactly one proposal
document; touches no source. All conclusions are proposals, not approvals.

## Scope read
10 route modules: `valuation/qa`, `tax/generate`, `tax/schedules`,
`tax/schedules/[id]`, `tax/schedules/[id]/payments`, `tax/settings`, `kpi/custom`,
`deferred-accrual/accrual`, `deferred-accrual/prepaid`, `debt/forecast`.

## Headline finding
**0 of 10 modules use Zod.** Handlers validate via ad-hoc truthiness checks or not at all.
Three POST handlers pass request bodies straight to services with zero validation
(`tax/schedules/[id]` PUT, `deferred-accrual/accrual` POST, `deferred-accrual/prepaid` POST).

## Per-route status (PENDING HUMAN DETERMINATION)
| Route | Status |
|-------|--------|
| valuation/qa POST | Partial |
| tax/generate POST | Partial |
| tax/schedules GET/POST | Partial |
| tax/schedules/[id]/payments GET/POST | Partial |
| tax/schedules/[id] PUT | Missing |
| tax/settings PUT | Missing |
| kpi/custom GET/POST/PUT/DELETE | Partial (highest complexity) |
| deferred-accrual/accrual POST | Missing |
| deferred-accrual/prepaid POST | Missing |
| debt/forecast GET/POST | Partial |

## Notable issues flagged for humans
- `new Date(x)` silent-`Invalid Date` pattern in 3 routes.
- Truthiness checks reject legitimate `0` amounts.
- `debt/forecast`: GET sync arm `parseInt`s `freeeCompanyId`, POST sync arm does not —
  type inconsistency to resolve before schema design.
- Free-string DB columns (`taxType`, `status`, `paymentMethod`, `taxFilingMethod`) read as
  if enum-constrained; enum vs bounded-string is a domain decision.
- `kpi/custom` multi-action dispatch needs "peek-then-parse" rather than a single union.

## Verification expectation
Docs-only diff (proposal + this file). `node scripts/autopm_verify.mjs --changed-only`
expected to exit 0. See full schemas, behavior-change notes, and the route-by-route detail in
`docs/proposals/api-z-007.md`.
