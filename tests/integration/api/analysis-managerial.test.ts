import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn(),
}))

import { POST } from '@/app/api/analysis/managerial/route'
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
  return new NextRequest('http://localhost/api/analysis/managerial', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/analysis/managerial', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(
      buildRequest({ sellingPricePerUnit: 100, variableCostPerUnit: 60, totalFixedCosts: 1000 })
    )
    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when a required field is missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest({ sellingPricePerUnit: 100, variableCostPerUnit: 60 }, 'session=valid-token')
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when selling price is negative', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest(
        { sellingPricePerUnit: -1, variableCostPerUnit: 0, totalFixedCosts: 0 },
        'session=valid-token'
      )
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('computes real CVP results for a valid authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest(
        {
          sellingPricePerUnit: 1000,
          variableCostPerUnit: 600,
          totalFixedCosts: 200000,
          unitsSold: 1000,
          targetProfit: 100000,
        },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.contributionMarginPerUnit).toBe(400)
    expect(body.data.contributionMarginRatio).toBe(0.4)
    expect(body.data.breakEvenPoint).toEqual({ units: 500, sales: 500000 })
    expect(body.data.targetProfit).toEqual({ units: 750, sales: 750000 })
    expect(body.data.operatingLeverage).toBe(2)
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'ANALYSIS_MANAGERIAL',
        resource: 'analysis',
      })
    )
  })
})
