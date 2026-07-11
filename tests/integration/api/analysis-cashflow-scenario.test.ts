import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn(),
}))

import { POST } from '@/app/api/analysis/cashflow-scenario/route'
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
  return new NextRequest('http://localhost/api/analysis/cashflow-scenario', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/analysis/cashflow-scenario', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildRequest({ currentCash: 1000, monthlyNetCashFlows: [-100] }))
    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when monthlyNetCashFlows is empty', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest({ currentCash: 1000, monthlyNetCashFlows: [] }, 'session=valid-token')
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for incoherent adjustment ordering', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest(
        {
          currentCash: 1000,
          monthlyNetCashFlows: [-100],
          adjustments: { optimistic: 2, realistic: 1, pessimistic: 0.5 },
        },
        'session=valid-token'
      )
    )
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.message).toContain('optimistic <= realistic <= pessimistic')
  })

  it('projects scenarios for a valid authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    const response = await POST(
      buildRequest(
        {
          currentCash: 5000000,
          monthlyNetCashFlows: [-1000000, -1000000, -1000000],
          horizonMonths: 12,
        },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.baseBurnRate).toBe(1000000)
    const realistic = body.data.scenarios.find((s: { name: string }) => s.name === 'realistic')
    expect(realistic.runwayMonths).toBe(5)
    expect(realistic.projection.length).toBe(12)
    expect(body.data.alert.level).toBe('critical')
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'ANALYSIS_CASHFLOW_SCENARIO',
        resource: 'analysis',
      })
    )
  })
})
