import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

const auditMocks = vi.hoisted(() => ({
  log: vi.fn(),
}))

vi.mock('@/lib/audit/audit-logger', () => ({
  auditLogger: { log: auditMocks.log },
}))

import { POST } from '@/app/api/investor/access-log/route'
import { validateSession } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

const investorUser: AuthUser = {
  id: 'investor-1',
  email: 'investor@example.com',
  name: 'Investor',
  role: 'INVESTOR',
  companyId: 'company-1',
}

function buildRequest(body: unknown, cookie?: string, extra?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  if (extra) Object.assign(headers, extra)
  const init: { method: string; headers: Record<string, string>; body: string } = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }
  return new NextRequest('http://localhost/api/investor/access-log', init)
}

describe('POST /api/investor/access-log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditMocks.log.mockResolvedValue({ success: true })
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildRequest({ action: 'report_view' }))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Not authenticated' })
    expect(auditMocks.log).not.toHaveBeenCalled()
  })

  it('returns 401 when the session is invalid', async () => {
    vi.mocked(validateSession).mockResolvedValue(null)

    const response = await POST(buildRequest({ action: 'report_view' }, 'session=expired'))

    expect(response.status).toBe(401)
    expect(auditMocks.log).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not an investor', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...investorUser, role: 'ADMIN' })

    const response = await POST(buildRequest({ action: 'report_view' }, 'session=valid-token'))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Access denied' })
    expect(auditMocks.log).not.toHaveBeenCalled()
  })

  it('returns 400 when the action is missing', async () => {
    vi.mocked(validateSession).mockResolvedValue(investorUser)

    const response = await POST(buildRequest({ resourceId: 'r-1' }, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
    expect(auditMocks.log).not.toHaveBeenCalled()
  })

  it('logs the access event and returns success', async () => {
    vi.mocked(validateSession).mockResolvedValue(investorUser)

    const response = await POST(
      buildRequest(
        { action: 'report_view', resourceId: 'report-9', details: { page: 'summary' } },
        'session=valid-token',
        { 'x-forwarded-for': '203.0.113.7', 'user-agent': 'InvestorBrowser/1.0' }
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true })
    expect(auditMocks.log).toHaveBeenCalledTimes(1)
    expect(auditMocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'investor-1',
        action: 'INVESTOR_REPORT_VIEW',
        resource: 'investor_portal',
        resourceId: 'report-9',
        ipAddress: '203.0.113.7',
        userAgent: 'InvestorBrowser/1.0',
        result: 'SUCCESS',
      })
    )
    const loggedDetails = auditMocks.log.mock.calls[0][0].details as Record<string, unknown>
    expect(loggedDetails).toMatchObject({
      page: 'summary',
      investorEmail: 'investor@example.com',
    })
  })

  it('uppercases the action and defaults ip/user-agent when headers are absent', async () => {
    vi.mocked(validateSession).mockResolvedValue(investorUser)

    const response = await POST(buildRequest({ action: 'download' }, 'session=valid-token'))

    expect(response.status).toBe(200)
    expect(auditMocks.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INVESTOR_DOWNLOAD',
        ipAddress: 'unknown',
        userAgent: 'unknown',
      })
    )
  })
})
