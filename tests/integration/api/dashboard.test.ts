import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

import { GET } from '@/app/api/dashboard/route'
import { validateSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/dashboard', { headers })
}

describe('GET /api/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest())

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Unauthorized' })
    expect(validateSession).not.toHaveBeenCalled()
  })

  it('returns 401 when the session is invalid or expired', async () => {
    vi.mocked(validateSession).mockResolvedValue(null)

    const response = await GET(buildRequest('session=expired-token'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Unauthorized' })
    expect(validateSession).toHaveBeenCalledWith('expired-token')
  })

  it('returns dashboard data with the expected shape for an authenticated user', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await GET(buildRequest('session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)

    const data = body.data
    expect(typeof data.company.name).toBe('string')
    expect(data.company).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        stage: expect.any(String),
        leadCompound: expect.any(String),
        developmentPhase: expect.any(String),
      })
    )
    expect(data.kpis).toEqual(
      expect.objectContaining({
        runway: expect.any(Number),
        monthlyBurnRate: expect.any(Number),
        cashBalance: expect.any(Number),
        rdSpendYtd: expect.any(Number),
        externalRdRatio: expect.any(Number),
      })
    )
    expect(Array.isArray(data.milestones)).toBe(true)
    expect(data.milestones.length).toBeLessThanOrEqual(5)
  })
})
