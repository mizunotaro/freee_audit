import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

const reportMocks = vi.hoisted(() => ({
  generateMonthlyReport: vi.fn(),
  getMonthlyTrend: vi.fn(),
  getMultiMonthReport: vi.fn(),
}))
vi.mock('@/services/report/monthly-report', () => reportMocks)

import { GET } from '@/app/api/reports/monthly/route'
import { validateSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

const monthlyReportData = {
  fiscalYear: 2024,
  month: 3,
  companyName: 'Test Co',
}

const multiMonthReportData = {
  fiscalYear: 2024,
  endMonth: 3,
  monthCount: 3 as const,
  months: [1, 2, 3],
  companyName: 'Test Co',
  sections: [],
}

const trend = [
  {
    month: '2024-01',
    revenue: 1000000,
    grossProfit: 300000,
    operatingIncome: 150000,
    netIncome: 90000,
    cash: 5000000,
  },
]

function buildRequest(query: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost/api/reports/monthly?${query}`, {
    headers,
  })
}

describe('GET /api/reports/monthly', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest('mode=single'))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(reportMocks.generateMonthlyReport).not.toHaveBeenCalled()
  })

  it('returns 401 when the user has no company associated', async () => {
    vi.mocked(validateSession).mockResolvedValue({
      ...authenticatedUser,
      companyId: null,
    })

    const response = await GET(buildRequest('mode=single', 'session=valid-token'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(reportMocks.generateMonthlyReport).not.toHaveBeenCalled()
  })

  it('returns report and trend in single mode for an authenticated user', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    reportMocks.generateMonthlyReport.mockResolvedValue({
      success: true,
      data: monthlyReportData,
    })
    reportMocks.getMonthlyTrend.mockResolvedValue(trend)

    const response = await GET(
      buildRequest('mode=single&fiscalYear=2024&month=3', 'session=valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.report).toEqual(monthlyReportData)
    expect(body.trend).toEqual(trend)
    expect(reportMocks.generateMonthlyReport).toHaveBeenCalledWith({
      companyId: 'company-1',
      fiscalYear: 2024,
      month: 3,
    })
    expect(reportMocks.getMonthlyTrend).toHaveBeenCalledWith('company-1', 2024)
    expect(reportMocks.getMultiMonthReport).not.toHaveBeenCalled()
  })

  it('returns report and trend in table mode (default) for an authenticated user', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    reportMocks.getMultiMonthReport.mockResolvedValue({
      success: true,
      data: multiMonthReportData,
    })
    reportMocks.getMonthlyTrend.mockResolvedValue(trend)

    const response = await GET(
      buildRequest('fiscalYear=2024&endMonth=3&monthCount=3', 'session=valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.report).toEqual(multiMonthReportData)
    expect(body.trend).toEqual(trend)
    expect(reportMocks.getMultiMonthReport).toHaveBeenCalledWith('company-1', 2024, 3, 3)
    expect(reportMocks.generateMonthlyReport).not.toHaveBeenCalled()
  })

  it('returns 404 with the service error when the report cannot be generated', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    reportMocks.generateMonthlyReport.mockResolvedValue({
      success: false,
      error: { message: 'Company not found' },
    })

    const response = await GET(
      buildRequest('mode=single&fiscalYear=2024&month=3', 'session=valid-token')
    )

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ error: 'Company not found' })
    expect(reportMocks.getMonthlyTrend).not.toHaveBeenCalled()
  })
})
