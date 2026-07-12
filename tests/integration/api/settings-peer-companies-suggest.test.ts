import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { success } from '@/types/result'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue(success(undefined)),
}))

const aiMocks = vi.hoisted(() => ({
  getProvider: vi.fn(),
}))
vi.mock('@/lib/integrations/ai', () => ({
  getAIService: vi.fn(() => ({ getProvider: aiMocks.getProvider })),
}))

const selectorMocks = vi.hoisted(() => ({
  suggestPeers: vi.fn(),
}))
vi.mock('@/services/peer-companies', () => ({
  createPeerSelectorAI: vi.fn(() => ({ suggestPeers: selectorMocks.suggestPeers })),
}))

import { POST } from '@/app/api/settings/peer-companies/suggest/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import { createPeerSelectorAI } from '@/services/peer-companies'
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
  return new NextRequest('http://localhost/api/settings/peer-companies/suggest', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

const suggestedPeers = [
  {
    ticker: '7203',
    name: 'Toyota',
    industry: '製造業',
    similarityScore: 0.9,
    keyMetrics: {},
    matchReasons: [],
  },
]

describe('POST /api/settings/peer-companies/suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(logRouteAudit).mockResolvedValue(success(undefined))
    aiMocks.getProvider.mockResolvedValue(null)
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildRequest({ industry: 'manufacturing' }))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    expect(selectorMocks.suggestPeers).not.toHaveBeenCalled()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await POST(buildRequest({}, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.details).toBeDefined()
    expect(selectorMocks.suggestPeers).not.toHaveBeenCalled()
  })

  it('returns 400 when the selector reports a failure', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    selectorMocks.suggestPeers.mockResolvedValue({
      success: false,
      error: { code: 'suggestion_failed', message: 'No matching peers found' },
    })

    const response = await POST(buildRequest({ industry: 'manufacturing' }, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('No matching peers found')
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('returns suggested peers and audits the action for a valid request', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    selectorMocks.suggestPeers.mockResolvedValue(success(suggestedPeers))

    const response = await POST(
      buildRequest(
        { industry: 'manufacturing', revenue: 1000, minPeers: 3, maxPeers: 5 },
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data).toEqual(suggestedPeers)

    expect(aiMocks.getProvider).toHaveBeenCalledWith(undefined, {
      userId: 'user-1',
      companyId: 'company-1',
    })
    expect(vi.mocked(createPeerSelectorAI)).toHaveBeenCalledTimes(1)
    expect(selectorMocks.suggestPeers).toHaveBeenCalledTimes(1)
    const [profile] = selectorMocks.suggestPeers.mock.calls[0]
    expect(profile).toEqual(expect.objectContaining({ industry: 'manufacturing', revenue: 1000 }))

    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'PEER_COMPANY_SUGGEST',
        resource: 'peer_company',
      })
    )
  })
})
