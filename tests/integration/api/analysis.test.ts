import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'
import {
  createBalanceSheet,
  createProfitLoss,
  createCashFlowStatement,
} from '../../factories/financial'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn(),
}))

vi.mock('@/services/ai/analysis-service', () => ({
  analyzeFinancialData: vi.fn(),
}))

const kpiMocks = vi.hoisted(() => ({
  calculateFinancialKPIs: vi.fn(),
}))
vi.mock('@/services/analytics/financial-kpi', () => kpiMocks)

import { POST } from '@/app/api/analysis/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import { analyzeFinancialData } from '@/services/ai/analysis-service'
import type { AuthUser } from '@/lib/auth'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

const analysisResult = {
  summary: 'Overall financial position is stable with adequate liquidity.',
  anomalies: [],
  recommendations: [],
  insights: ['Cash runway exceeds 18 months at current burn rate.'],
}

function buildRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/analysis', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
    vi.mocked(analyzeFinancialData).mockResolvedValue(analysisResult)
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildRequest({ bs: {}, pl: {}, cf: {} }))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(analyzeFinancialData).not.toHaveBeenCalled()
  })

  it('returns 400 when required financial data is missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(buildRequest({ provider: 'openai' }, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ error: 'Missing financial data' })
    expect(analyzeFinancialData).not.toHaveBeenCalled()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns the analysis result for a valid authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const payload = {
      bs: createBalanceSheet(),
      pl: createProfitLoss(),
      cf: createCashFlowStatement(),
      kpis: { standard: 'JGAAP' },
      provider: 'openai',
    }

    const response = await POST(buildRequest(payload, 'session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(analysisResult)
    expect(analyzeFinancialData).toHaveBeenCalledTimes(1)
    expect(kpiMocks.calculateFinancialKPIs).not.toHaveBeenCalled()
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'ANALYSIS_RUN',
        resource: 'analysis',
      })
    )
  })

  it('computes KPIs server-side when the client omits them', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const computedKpis = { standard: 'JGAAP', computed: true }
    kpiMocks.calculateFinancialKPIs.mockReturnValue(computedKpis)

    const bs = createBalanceSheet()
    const pl = createProfitLoss()
    const cf = createCashFlowStatement()

    const response = await POST(buildRequest({ bs, pl, cf }, 'session=valid-token'))

    expect(response.status).toBe(200)
    expect(kpiMocks.calculateFinancialKPIs).toHaveBeenCalledTimes(1)
    expect(kpiMocks.calculateFinancialKPIs).toHaveBeenCalledWith(bs, pl, cf)
    expect(analyzeFinancialData).toHaveBeenCalledWith(
      bs,
      pl,
      cf,
      computedKpis,
      { provider: 'openai' },
      undefined
    )
  })
})
