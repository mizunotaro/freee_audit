# gap-untested-module-87911009a3 — Unit tests for `src/types/reports/business.ts`

**Risk class:** C · **Target:** `src/types/reports/business.ts` (839 lines) · **Date:** 2026-07-12

## What was delivered

New test file: `tests/unit/types/reports/business.test.ts` — **93 passing tests**.

The target module is a **pure-types module** (2 type aliases + 91 interfaces) with exactly two
runtime exports (`SIMPLE_REPORT_SECTIONS`, `KEIDANREN_REPORT_SECTIONS`). It mirrors
`src/types/reports/business.ts` under the `tests/unit/types/` tree per CLAUDE.md §3 and the repo
convention for type modules (siblings: `tests/unit/types/accounting-standard.test.ts`,
`result.test.ts`). `vitest.config.ts` excludes `src/types/**` from coverage, so the metric is
green tests + clean `tsc`, not coverage %.

## Coverage rationale — the 3-layer pattern (avoids fake-green)

`vitest` strips TypeScript, so a type-only `expectTypeOf` runs as a no-op test. Every interface is
therefore covered by **three independent layers**, each catching a different regression:

1. **Runtime `expect()` (vitest)** — at least one real assertion per `it`. A deleted/renamed
   runtime field on a constant, or a wrong literal value, fails here.
2. **Typed assignment `const x: InterfaceName = {...}` / factory return type (tsc)** — the
   representative object literal is checked against the interface. A removed or renamed *required*
   field fails `tsc --noEmit`.
3. **`expectTypeOf` (tsc)** — union membership, optional-vs-required, and `readonly`/`as const`
   guarantees.

Every one of the 93 exported constructs (2 aliases + 91 interfaces) has at least one dedicated
runtime assertion; the two runtime constants are exhaustively exercised.

## Assertion inventory (by group)

**Module resolution (1)**
- `await import('@/types/reports/business')` resolves and exposes both runtime constants.

**Exported unions (2)**
- `ReportTemplateType` — exactly 2 literals (`simple`, `keidanren`), unique, member type-checked.
- `BusinessReportStatus` — exactly 4 literals, ordered list equality, uniqueness.

**`SIMPLE_REPORT_SECTIONS` runtime constant (6)**
- length 7; assignable to `BusinessReportSection[]`; keys unique and exactly the 7
  `Omit<BusinessReportData,'fiscalYear'|'companyName'>` fields; excludes `fiscalYear`/`companyName`;
  every key is a valid `Omit` key; every section has non-empty title + description.

**`KEIDANREN_REPORT_SECTIONS` runtime constant (8)**
- length 10; `as const` → `readonly` tuple; unique ids; first=`companyStatus`, last=`importantMatters`;
  every section non-empty title + non-empty `subSections`; every subSection non-empty id+title;
  subSection ids unique per section; id order matches the `KeidanrenBusinessReport` section keys.

**Core report interfaces (3)** — `BusinessReportData` (full key set), `BusinessReportSection`
(`key` typed to the `Omit` keys), `KeidanlenBusinessReport` (composes all required sections +
header metadata; optionals `approvedBy`/`approvedAt`/`supplementarySchedules` truly optional).

**Company-status group (10)** — `CompanyStatusSection`, `BusinessSegment`, `FinancialFigure`
(4-field key set), `YearOverYearComparison`, `BusinessPerformance`, `ProductionOrders`/`ProductionData`
(`capacityUtilization` optional), `FinancialSummary`, `FinancialRatio.unit` union (4),
`RiskItem.probability/impact` union (3), `RiskManagement`, ESG trio (`ESGSection`/`ESGItem`/`ESGMetric`).

**Shares group (7)** — `SharesSection` (optionals `stockPrice`/`treasuryShares`),
`TotalShares` (authorized≥issued; issued−treasury=outstanding), `ShareholdingStructure`
(`byRegion` optional) + `RegionalBreakdown`, `ShareholderTypeBreakdown.type` union (6),
`MajorShareholder.type` union (5), `StockPriceInfo`+`DividendInfo` (`tradingVolume` optional),
`TreasuryShares`+`TreasuryShareTransaction` (`pricePerShare` optional).

**Stock-options group (4)** — `StockOptionsSection` (`equityCompensation` optional),
`StockAcquisitionRight` (date fields + `vestingSchedule` optional), `EquityCompensationPlan.planType`
union (4) + factory, `ExerciseStatus`.

**Officers group (7)** — `OfficersSection` (`executiveOfficers` optional), `Director.position`
union (6) + optionals, `Auditor.position` union (3), `ExecutiveOfficer`,
`OfficersCompensation`+`CompensationBreakdown` (`executiveOfficers` optional),
`BoardMeetingsInfo`+`AttendanceRecord`.

**Auditor group (5)** — `AuditorSection` (`changes` optional), `DateRange`, `AuditOpinion.type`
union (4) + `emphasisOfMatter` optional, `AuditFees` (sum invariant + `nonAuditServices` optional),
`AuditorChange`.

**Internal-control group (4)** — `InternalControlSection` (`internalControlReport` optional),
`OrganizationalStructure` (committee optionals), `InternalControlReport.conclusion` union (2) +
`remediation` optional, `ComplianceInfo`+`ComplianceViolation` (`violations` optional).

**Control-policy / subsidiary / related-party (3)** — optionals across `ControlPolicySection`,
`TakeoverDefenseInfo`, `SubsidiarySection`, `ParentCompanyInfo`, `RelatedPartyTransactionsSection`,
`RelatedPartyTransaction`.

**Important-matters group (5)** — `ImportantMattersSection` (all-optional → `{}`),
`SubsequentEvent.impact` union (2), `LitigationMatter` (`claimedAmount` optional),
`IncidentReport.type` union (4) + `financialImpact` optional, `SupplementarySchedules` (all-optional → `{}`).

**Aggregated-data group (8)** — `AggregatedReportData` (composes all sources),
`CompanyInfo`, `FinancialData` (`Record<string,number>` totals), `MonthlyBalanceData`,
`BusinessReportShareholderData`+`ShareholderCompositionData`, `OfficerData`+`DirectorData`+`AuditorData`,
`BoardMeetingData`+`JournalData`+`JournalEntryData`+`FixedAssetData`+`RelatedPartyData`,
`CalculatedMetrics` (7-key set).

**Generation / validation group (5)** — `GenerationContext` (optionals), `GeneratedSection`,
`ValidationResult`, `ValidationError`+`ValidationWarning` (`suggestion` optional).

**Workflow / export / compliance group (5)** — `ApprovalStep.action` union (4) + optionals,
`WorkflowResult` (optionals), `ExportOptions` unions (format×4, language×2, pageSize×2,
orientation×2), `ComplianceCheckItem.status` union (3) + `details` optional, `ComplianceResult`.

**Edge cases / boundaries (4)** — `FinancialFigure` at 0 / negative / `MAX_SAFE_INTEGER`;
collection-shaped arrays empty (`[]`); `CalculatedMetrics` all-zero; `GeneratedSection`
low-confidence warning state.

**Fail-safe behavior (5)** — `ValidationResult` invalid + enumerated errors (warnings stay array);
`ComplianceResult` non-compliant + missing requirements; `WorkflowResult` failure without advancing
optional step/approver; `ImportantMattersSection`/`SupplementarySchedules` degrade to `{}`;
`RelatedPartyTransactionsSection` reports no-transactions safely.

> **Note on the task spec's "error paths / timeouts":** these do not apply to a type-only module
> (no functions throw, no I/O, no clock). Per the established repo pattern they are substituted with
> **fail-safe shape tests** (minimal-constructible objects, optional fields truly optional,
> invalid/warning states degrade safely) — see the dedicated `fail-safe behavior` block above.

## Verification (all green)

```
corepack pnpm exec vitest run tests/unit/types/reports/business.test.ts
  Test Files  1 passed (1)
  Tests       93 passed (93)

corepack pnpm exec eslint tests/unit/types/reports/business.test.ts --max-warnings=0
  0 errors, 0 warnings

corepack pnpm exec tsc --noEmit   (whole project; 0 errors in business.test.ts)
```

Prereq: `corepack pnpm db:generate` was run first to clear the ~298 phantom TS7006 errors
(see verify-gate-needs-prisma-generate memory).
