import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/api/auth-helpers', () => ({
  getAuthUser: vi.fn(),
}))

import { GET } from '@/app/api/reports/cashflow/route'
import type { AuthUser } from '@/lib/auth'

const user: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(query: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost/api/reports/cashflow?${query}`, { headers })
}

describe('GET /api/reports/cashflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildRequest('fiscalYear=2024'))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
  })

  it('returns 400 when fiscalYear is not a valid integer', async () => {
    const { getAuthUser } = await import('@/lib/api/auth-helpers')
    vi.mocked(getAuthUser).mockResolvedValue(user)

    const response = await GET(buildRequest('fiscalYear=abc', 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid query parameters')
  })

  it('returns 400 when fiscalYear is out of range', async () => {
    const { getAuthUser } = await import('@/lib/api/auth-helpers')
    vi.mocked(getAuthUser).mockResolvedValue(user)

    const response = await GET(buildRequest('fiscalYear=1800', 'session=valid-token'))

    expect(response.status).toBe(400)
  })
})
