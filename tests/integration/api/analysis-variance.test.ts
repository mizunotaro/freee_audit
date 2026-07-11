import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn(),
}))

import { POST } from '@/app/api/analysis/variance/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import type { AuthUser } from '@/lib/auth'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/analysis/variance', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/analysis/variance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(
      buildRequest({ fiscalYear: 2025, month: 6, actuals: [], budgets: [] })
    )
    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when actuals fails Zod validation', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest({ fiscalYear: 2025, month: 6, actuals: [] }, 'session=valid-token')
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      cookie: 'session=valid-token',
    }
    const request = new NextRequest('http://localhost/api/analysis/variance', {
      method: 'POST',
      body: '{not json',
      headers,
    })
    const response = await POST(request)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('computes real variance attribution for a valid authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest(
        {
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
        },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.accounts[0].variance).toBe(150000)
    expect(body.data.summary.expenses.variance).toBe(150000)
    expect(body.data.summary.favorable).toBe(false)
    expect(body.metadata.requestId).toBeTruthy()
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'ANALYSIS_VARIANCE',
        resource: 'analysis',
      })
    )
  })
})
