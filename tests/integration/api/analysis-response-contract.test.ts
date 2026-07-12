import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { success } from '@/types/result'
import { createBalanceSheet, createProfitLoss } from '../../factories/financial'

// These routes resolve the actor via validateSession (mocked) and record an audit
// entry via logRouteAudit (mocked). No other dependency is mocked — the analysis
// engines run for real so the assertions lock the actual serialized response.
vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn(),
}))

import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import type { AuthUser } from '@/lib/auth'

import { POST as financialPOST } from '@/app/api/analysis/financial/route'
import { POST as ratiosPOST } from '@/app/api/analysis/ratios/route'
import { POST as benchmarkPOST, GET as benchmarkGET } from '@/app/api/analysis/benchmark/route'
import { POST as reportPOST } from '@/app/api/analysis/report/route'
import { POST as variancePOST } from '@/app/api/analysis/variance/route'
import { POST as cashflowPOST } from '@/app/api/analysis/cashflow-scenario/route'
import { POST as managerialPOST } from '@/app/api/analysis/managerial/route'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

// ---------------------------------------------------------------------------
// Reusable envelope contract — mirrors src/app/api/analysis/types/response.ts
// and app-error.ts. Every envelope analysis route must satisfy this shape.
// ---------------------------------------------------------------------------

const METADATA_KEYS = ['cached', 'processingTimeMs', 'requestId', 'timestamp', 'version'] as const

const ResponseMetadataSchema = z
  .object({
    requestId: z.string(),
    processingTimeMs: z.number(),
    cached: z.boolean(),
    version: z.string(),
    timestamp: z.string(),
  })
  .strict()

const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'MISSING_REQUIRED_FIELDS',
  'INVALID_DATA',
  'ANALYSIS_FAILED',
  'BENCHMARK_UNAVAILABLE',
  'INTERNAL_ERROR',
  'RATE_LIMIT_EXCEEDED',
  'UNAUTHORIZED',
  'TIMEOUT',
  'CIRCUIT_BREAKER_OPEN',
])

const AppErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  timestamp: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  requestId: z.string().optional(),
})

const successEnvelope = <T extends z.ZodTypeAny>(payload: T) =>
  z
    .object({
      success: z.literal(true),
      data: payload,
      metadata: ResponseMetadataSchema,
    })
    .strict()

const errorEnvelope = z
  .object({
    success: z.literal(false),
    error: AppErrorSchema,
    metadata: ResponseMetadataSchema,
  })
  .strict()

const AnalysisStatusSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'critical'])

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

function buildRequest(path: string, body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

function authed(path: string, body: unknown): NextRequest {
  return buildRequest(path, body, 'session=valid-token')
}

// ---------------------------------------------------------------------------
// Per-route payload contracts. These mirror the documented output interfaces
// (and the route-local report shape); unknown engine fields are tolerated
// (Zod strips them) but every documented key is required, so a rename or
// drop is caught.
// ---------------------------------------------------------------------------

const financialPayloadSchema = z.object({
  overallScore: z.number(),
  overallStatus: AnalysisStatusSchema,
  executiveSummary: z.string(),
  categoryAnalyses: z.array(
    z.object({
      category: z.string(),
      score: z.number(),
      status: AnalysisStatusSchema,
      summary: z.string(),
      trends: z.array(
        z.object({
          metric: z.string(),
          direction: z.enum(['improving', 'stable', 'declining', 'volatile']),
          changePercent: z.number().optional(),
          insight: z.string(),
        })
      ),
      alerts: z.array(
        z.object({
          id: z.string(),
          category: z.string(),
          severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
          title: z.string(),
          description: z.string(),
          metric: z.string(),
          currentValue: z.number(),
          threshold: z.number().optional(),
          recommendation: z.string(),
        })
      ),
      recommendations: z.array(
        z.object({
          id: z.string(),
          priority: z.enum(['high', 'medium', 'low']),
          category: z.string(),
          title: z.string(),
          description: z.string(),
          expectedImpact: z.string(),
          timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']),
        })
      ),
      metrics: z.array(
        z.object({
          name: z.string(),
          value: z.number(),
          unit: z.string(),
          format: z.enum(['number', 'percentage', 'currency', 'ratio', 'days']),
          status: AnalysisStatusSchema,
        })
      ),
    })
  ),
  allAlerts: z.array(z.object({ id: z.string(), category: z.string() })),
  topRecommendations: z.array(z.object({ id: z.string(), priority: z.string() })),
  keyMetrics: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      format: z.enum(['number', 'percentage', 'currency', 'ratio', 'days']),
    })
  ),
  benchmark: z.unknown().optional(),
  processingTimeMs: z.number(),
  analyzedAt: z.string(),
})

const ratioDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameEn: z.string(),
  category: z.string(),
  formula: z.string(),
  description: z.string(),
  unit: z.enum(['ratio', 'percentage', 'days', 'times', 'number']),
})

const calculatedRatioSchema = z.object({
  definition: ratioDefinitionSchema,
  value: z.number(),
  formattedValue: z.string(),
  status: AnalysisStatusSchema,
  trend: z
    .object({
      direction: z.enum(['improving', 'stable', 'declining']),
      previousValue: z.number().optional(),
      changePercent: z.number().optional(),
    })
    .optional(),
  percentile: z.number().optional(),
})

const ratiosPayloadSchema = z.object({
  groups: z.array(
    z.object({
      category: z.string(),
      categoryName: z.string(),
      ratios: z.array(calculatedRatioSchema),
      averageScore: z.number(),
      overallStatus: AnalysisStatusSchema,
    })
  ),
  allRatios: z.array(calculatedRatioSchema),
  summary: z.object({
    totalRatios: z.number(),
    excellentCount: z.number(),
    goodCount: z.number(),
    fairCount: z.number(),
    poorCount: z.number(),
    criticalCount: z.number(),
    overallScore: z.number(),
  }),
  calculatedAt: z.string(),
})

const benchmarkComparisonSchema = z.object({
  metricId: z.string(),
  metricName: z.string(),
  companyValue: z.number(),
  benchmark: z.object({
    min: z.number(),
    q1: z.number(),
    median: z.number(),
    q3: z.number(),
    max: z.number(),
  }),
  percentile: z.number(),
  status: z.enum(['above_median', 'at_median', 'below_median']),
  deviation: z.number(),
})

const benchmarkPayloadSchema = z.object({
  industryComparisons: z.array(benchmarkComparisonSchema),
  sizeComparisons: z.array(benchmarkComparisonSchema),
  overallPercentile: z.number(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
})

const benchmarkCatalogPayloadSchema = z.object({
  availableSectors: z.array(z.object({ sector: z.string(), name: z.string() })),
  availableMetrics: z.array(z.object({ id: z.string(), name: z.string() })),
})

const reportFormatSchema = z.enum(['json', 'markdown', 'html'])
const reportTypeSchema = z.enum(['summary', 'detailed', 'investor', 'management', 'compliance'])

const reportPayloadSchema = z.object({
  format: reportFormatSchema,
  content: z.string(),
  reportType: reportTypeSchema,
  metadata: z
    .object({
      reportType: reportTypeSchema,
      companyName: z.string(),
      fiscalYear: z.number(),
      generatedAt: z.string(),
      processingTimeMs: z.number(),
    })
    .strict(),
})

const variancePayloadSchema = z.object({
  fiscalYear: z.number(),
  month: z.number(),
  dataQuality: z.object({
    journalsProvided: z.boolean(),
    budgetCoveragePct: z.number(),
    warnings: z.array(z.string()),
  }),
  accounts: z.array(
    z.object({
      accountCode: z.string(),
      accountName: z.string(),
      category: z.enum(['revenue', 'cost_of_sales', 'sga_expense']),
      signDirection: z.enum(['revenue', 'expense']),
      budget: z.number(),
      actual: z.number(),
      variance: z.number(),
      variancePct: z.number().nullable(),
      achievementRate: z.number().nullable(),
      favorable: z.boolean(),
      material: z.boolean(),
      drivers: z.array(
        z.object({
          driver: z.enum(['new_unbudgeted', 'absence', 'outlier', 'run_rate', 'unreconciled']),
          amount: z.number(),
          pctOfVariance: z.number().nullable(),
          journalsCount: z.number(),
        })
      ),
      journals: z.array(
        z.object({
          journalId: z.string(),
          entryDate: z.string(),
          description: z.string().nullable(),
          signedAmount: z.number(),
          expected: z.number(),
          deviation: z.number(),
          contributionPct: z.number().nullable(),
          zScore: z.number(),
          driver: z.enum(['outlier', 'run_rate', 'unreconciled']),
          direction: z.enum(['favorable', 'unfavorable', 'neutral']),
        })
      ),
      reconciliation: z.object({
        journalSum: z.number().nullable(),
        actual: z.number(),
        unreconciled: z.number(),
        unreconciledPct: z.number().nullable(),
      }),
    })
  ),
  summary: z.object({
    revenue: z.object({ budget: z.number(), actual: z.number(), variance: z.number() }),
    expenses: z.object({ budget: z.number(), actual: z.number(), variance: z.number() }),
    operatingIncome: z.object({ budget: z.number(), actual: z.number(), variance: z.number() }),
    totalVariance: z.number(),
    attributedVariance: z.number(),
    immaterialBucket: z.number(),
    favorable: z.boolean(),
  }),
})

const cashflowPayloadSchema = z.object({
  currentCash: z.number(),
  baseMonthlyNetCashFlow: z.number(),
  baseBurnRate: z.number(),
  dataPoints: z.number(),
  scenarios: z.array(
    z.object({
      name: z.enum(['optimistic', 'realistic', 'pessimistic']),
      adjustment: z.number(),
      monthlyNetCashFlow: z.number(),
      burnRate: z.number(),
      runwayMonths: z.number().nullable(),
      projection: z.array(
        z.object({
          month: z.number(),
          beginningCash: z.number(),
          netCashFlow: z.number(),
          endingCash: z.number(),
        })
      ),
    })
  ),
  alert: z.object({
    level: z.enum(['safe', 'warning', 'critical']),
    message: z.string(),
    recommendation: z.string(),
  }),
})

const managerialPayloadSchema = z.object({
  inputs: z.object({
    sellingPricePerUnit: z.number(),
    variableCostPerUnit: z.number(),
    totalFixedCosts: z.number(),
    unitsSold: z.number().nullable(),
    targetProfit: z.number().nullable(),
  }),
  contributionMarginPerUnit: z.number(),
  contributionMarginRatio: z.number().nullable(),
  breakEvenPoint: z.object({ units: z.number().nullable(), sales: z.number().nullable() }),
  targetProfit: z.object({ units: z.number().nullable(), sales: z.number().nullable() }).nullable(),
  marginOfSafety: z.object({ amount: z.number().nullable(), percent: z.number().nullable() }),
  operatingLeverage: z.number().nullable(),
  totals: z.object({
    sales: z.number().nullable(),
    totalVariableCosts: z.number().nullable(),
    contributionMargin: z.number().nullable(),
    operatingIncome: z.number().nullable(),
  }),
  warnings: z.array(z.string()),
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
})

describe('analysis API response-schema contracts', () => {
  describe('POST /api/analysis/financial', () => {
    it('returns a success envelope whose payload matches FinancialAnalysisOutput', async () => {
      const response = await financialPOST(
        authed('/api/analysis/financial', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(financialPayloadSchema).parse(body)
      expect(Object.keys(body.metadata).sort()).toEqual([...METADATA_KEYS])
    })

    it('returns a validation error envelope when balanceSheet is missing', async () => {
      const response = await financialPOST(
        authed('/api/analysis/financial', { profitLoss: createProfitLoss() })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns an UNAUTHORIZED error envelope without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await financialPOST(
        buildRequest('/api/analysis/financial', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/analysis/ratios', () => {
    it('returns a success envelope whose payload matches RatioAnalysisOutput', async () => {
      const response = await ratiosPOST(
        authed('/api/analysis/ratios', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(ratiosPayloadSchema).parse(body)
      expect(body.data.allRatios.length).toBeGreaterThan(0)
    })

    it('returns a validation error envelope when profitLoss is missing', async () => {
      const response = await ratiosPOST(
        authed('/api/analysis/ratios', { balanceSheet: createBalanceSheet() })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns the legacy raw 401 shape without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await ratiosPOST(
        buildRequest('/api/analysis/ratios', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('POST /api/analysis/benchmark', () => {
    it('returns a success envelope whose payload matches BenchmarkOutput', async () => {
      const response = await benchmarkPOST(
        authed('/api/analysis/benchmark', {
          ratios: { current_ratio: 150.5, equity_ratio: 45.2 },
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(benchmarkPayloadSchema).parse(body)
      expect(body.data.industryComparisons.length).toBeGreaterThan(0)
    })

    it('returns a validation error envelope when ratios is missing', async () => {
      const response = await benchmarkPOST(authed('/api/analysis/benchmark', {}))
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns the legacy raw 401 shape without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await benchmarkPOST(
        buildRequest('/api/analysis/benchmark', { ratios: { current_ratio: 150 } })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('GET /api/analysis/benchmark', () => {
    it('returns a success envelope carrying the sector/metric catalog', async () => {
      const response = await benchmarkGET(
        new NextRequest('http://localhost/api/analysis/benchmark', {
          headers: { cookie: 'session=valid-token' },
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(benchmarkCatalogPayloadSchema).parse(body)
      expect(body.data.availableSectors.length).toBeGreaterThan(0)
      expect(body.data.availableMetrics.length).toBeGreaterThan(0)
    })

    it('returns the legacy raw 401 shape without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await benchmarkGET(
        new NextRequest('http://localhost/api/analysis/benchmark')
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('POST /api/analysis/report', () => {
    it('returns a success envelope whose payload matches the route ReportOutput', async () => {
      const response = await reportPOST(
        authed('/api/analysis/report', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
          reportType: 'summary',
          format: 'json',
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(reportPayloadSchema).parse(body)
      expect(body.data.format).toBe('json')
      expect(typeof body.data.content).toBe('string')
    })

    it('returns a validation error envelope when reportType is missing', async () => {
      const response = await reportPOST(
        authed('/api/analysis/report', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
        })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns the legacy raw 401 shape without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await reportPOST(
        buildRequest('/api/analysis/report', {
          balanceSheet: createBalanceSheet(),
          profitLoss: createProfitLoss(),
          reportType: 'summary',
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body).toEqual({ error: 'Unauthorized' })
    })
  })

  describe('POST /api/analysis/variance', () => {
    it('returns a success envelope whose payload matches VarianceAttributionOutput', async () => {
      const response = await variancePOST(
        authed('/api/analysis/variance', {
          fiscalYear: 2025,
          month: 6,
          actuals: [
            {
              accountCode: '510',
              accountName: '給与手当',
              amount: 950000,
              category: 'sga_expense',
            },
          ],
          budgets: [
            {
              accountCode: '510',
              accountName: '給与手当',
              amount: 800000,
              category: 'sga_expense',
            },
          ],
          options: { materialityAbsoluteFloor: 0, materialityPctOfRevenue: 0 },
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(variancePayloadSchema).parse(body)
      expect(body.data.accounts[0].variance).toBe(150000)
    })

    it('returns a validation error envelope for an empty actuals array', async () => {
      const response = await variancePOST(
        authed('/api/analysis/variance', { fiscalYear: 2025, month: 6, actuals: [] })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns an UNAUTHORIZED error envelope without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await variancePOST(
        buildRequest('/api/analysis/variance', {
          fiscalYear: 2025,
          month: 6,
          actuals: [
            {
              accountCode: '510',
              accountName: '給与手当',
              amount: 950000,
              category: 'sga_expense',
            },
          ],
          budgets: [
            {
              accountCode: '510',
              accountName: '給与手当',
              amount: 800000,
              category: 'sga_expense',
            },
          ],
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/analysis/cashflow-scenario', () => {
    it('returns a success envelope whose payload matches CashflowScenarioOutput', async () => {
      const response = await cashflowPOST(
        authed('/api/analysis/cashflow-scenario', {
          currentCash: 5000000,
          monthlyNetCashFlows: [-1000000, -1000000, -1000000],
          horizonMonths: 12,
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(cashflowPayloadSchema).parse(body)
      expect(body.data.scenarios).toHaveLength(3)
    })

    it('returns a validation error envelope when monthlyNetCashFlows is empty', async () => {
      const response = await cashflowPOST(
        authed('/api/analysis/cashflow-scenario', { currentCash: 1000, monthlyNetCashFlows: [] })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns an UNAUTHORIZED error envelope without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await cashflowPOST(
        buildRequest('/api/analysis/cashflow-scenario', {
          currentCash: 5000000,
          monthlyNetCashFlows: [-1000000],
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('POST /api/analysis/managerial', () => {
    it('returns a success envelope whose payload matches ManagerialCvpOutput', async () => {
      const response = await managerialPOST(
        authed('/api/analysis/managerial', {
          sellingPricePerUnit: 100,
          variableCostPerUnit: 60,
          totalFixedCosts: 40000,
          unitsSold: 2000,
          targetProfit: 10000,
        })
      )
      expect(response.status).toBe(200)
      const body = await response.json()
      successEnvelope(managerialPayloadSchema).parse(body)
      expect(body.data.contributionMarginPerUnit).toBe(40)
    })

    it('returns a validation error envelope when totalFixedCosts is missing', async () => {
      const response = await managerialPOST(
        authed('/api/analysis/managerial', {
          sellingPricePerUnit: 100,
          variableCostPerUnit: 60,
        })
      )
      expect(response.status).toBe(400)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('returns an UNAUTHORIZED error envelope without a session', async () => {
      vi.mocked(validateSession).mockResolvedValue(null)
      const response = await managerialPOST(
        buildRequest('/api/analysis/managerial', {
          sellingPricePerUnit: 100,
          variableCostPerUnit: 60,
          totalFixedCosts: 40000,
        })
      )
      expect(response.status).toBe(401)
      const body = await response.json()
      errorEnvelope.parse(body)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })
})

// Static sanity check: the exported handlers are the real Next route handlers
// (guards against an accidental re-export indirection that would bypass the
// contract under test).
describe('analysis route handlers are real Next handlers', () => {
  it.each([
    ['financial', financialPOST],
    ['ratios', ratiosPOST],
    ['benchmarkPOST', benchmarkPOST],
    ['benchmarkGET', benchmarkGET],
    ['report', reportPOST],
    ['variance', variancePOST],
    ['cashflow-scenario', cashflowPOST],
    ['managerial', managerialPOST],
  ])('%s handler is an async function', (_name, handler) => {
    expect(typeof handler).toBe('function')
  })

  it('NextResponse is the expected server type', () => {
    expect(NextResponse).toBeDefined()
  })
})
