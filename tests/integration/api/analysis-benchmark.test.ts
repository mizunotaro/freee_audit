import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue(success(undefined)),
}))

vi.mock('@/app/api/analysis/middleware/rate-limit', () => ({
  withRateLimit: () => (handler: unknown) => handler,
}))

vi.mock('@/app/api/analysis/middleware/timeout', () => ({
  withTimeout: () => (handler: unknown) => handler,
}))

vi.mock('@/app/api/analysis/middleware/security-headers', () => ({
  addSecurityHeaders: (response: unknown) => response,
}))

import { GET, POST } from '@/app/api/analysis/benchmark/route'
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

function buildGetRequest(cookie?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/analysis/benchmark', { headers })
}

function buildPostRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/analysis/benchmark', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  })
}

describe('GET /api/analysis/benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await GET(buildGetRequest())

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(validateSession).not.toHaveBeenCalled()
  })

  it('returns the available sectors and metrics for an authenticated user', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await GET(buildGetRequest('session=valid-token'))

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data.availableSectors)).toBe(true)
    expect(body.data.availableSectors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sector: 'manufacturing' }),
        expect.objectContaining({ sector: 'technology' }),
      ])
    )
    expect(Array.isArray(body.data.availableMetrics)).toBe(true)
    expect(body.data.availableMetrics.length).toBeGreaterThan(0)
    expect(body.metadata.requestId).toEqual(expect.any(String))
  })
})

describe('POST /api/analysis/benchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildPostRequest({ ratios: { current_ratio: 150 } }))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ error: 'Unauthorized' })
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when the request body is not valid JSON', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(buildPostRequest('{not valid json', 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when the sector is not a recognized enum value', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(
      buildPostRequest(
        { ratios: { current_ratio: 150.5 }, sector: 'not-a-real-sector' },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns the benchmark comparison shape for a valid authenticated request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(
      buildPostRequest(
        { ratios: { current_ratio: 150.5, roe: 12 }, sector: 'manufacturing' },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(
      expect.objectContaining({
        industryComparisons: expect.any(Array),
        sizeComparisons: expect.any(Array),
        overallPercentile: expect.any(Number),
        strengths: expect.any(Array),
        weaknesses: expect.any(Array),
      })
    )
    expect(body.data.overallPercentile).toBeGreaterThanOrEqual(0)
    expect(body.data.overallPercentile).toBeLessThanOrEqual(100)
    expect(body.metadata.cached).toBe(false)

    expect(logRouteAudit).toHaveBeenCalledTimes(1)
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'ANALYSIS_BENCHMARK',
        resource: 'analysis',
      })
    )
  })
})
