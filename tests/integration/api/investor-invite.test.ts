import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const invitationMocks = vi.hoisted(() => ({
  createInvitation: vi.fn(),
}))

vi.mock('@/services/investor/invitation-service', () => ({
  createInvitation: invitationMocks.createInvitation,
}))

import { POST } from '@/app/api/investor/invite/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import type { AuthUser } from '@/lib/auth'

const adminUser: AuthUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'ADMIN',
  companyId: 'company-1',
}

function buildRequest(body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  const init: { method: string; headers: Record<string, string>; body: string } = {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }
  return new NextRequest('http://localhost/api/investor/invite', init)
}

describe('POST /api/investor/invite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await POST(buildRequest({ email: 'investor@example.com' }))

    expect(response).toBeInstanceOf(NextResponse)
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Not authenticated' })
    expect(invitationMocks.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 401 when the session is invalid', async () => {
    vi.mocked(validateSession).mockResolvedValue(null)

    const response = await POST(buildRequest({ email: 'investor@example.com' }, 'session=expired'))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Invalid session' })
    expect(invitationMocks.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 403 when the user is not an admin', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...adminUser, role: 'ACCOUNTANT' })

    const response = await POST(
      buildRequest({ email: 'investor@example.com' }, 'session=valid-token')
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Insufficient permissions' })
    expect(invitationMocks.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 400 when the email is missing or invalid', async () => {
    vi.mocked(validateSession).mockResolvedValue(adminUser)

    const response = await POST(buildRequest({ email: 'not-an-email' }, 'session=valid-token'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
    expect(invitationMocks.createInvitation).not.toHaveBeenCalled()
  })

  it('returns 400 when the invitation service reports a failure', async () => {
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    invitationMocks.createInvitation.mockResolvedValue({
      success: false,
      error: 'User with this email already exists',
    })

    const response = await POST(
      buildRequest({ email: 'existing@example.com' }, 'session=valid-token')
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({
      success: false,
      error: 'User with this email already exists',
    })
    expect(logRouteAudit).not.toHaveBeenCalled()
  })

  it('creates an invitation, builds the accept URL, and audits the request', async () => {
    vi.mocked(validateSession).mockResolvedValue(adminUser)
    invitationMocks.createInvitation.mockResolvedValue({
      success: true,
      token: 'inv-token-123',
      invitationId: 'inv-1',
    })

    const response = await POST(
      buildRequest({ email: 'investor@example.com' }, 'session=valid-token')
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      success: true,
      invitationId: 'inv-1',
      inviteUrl: 'http://localhost:3000/investor/accept?token=inv-token-123',
    })
    expect(invitationMocks.createInvitation).toHaveBeenCalledWith({
      email: 'investor@example.com',
      invitedBy: 'admin-1',
    })
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        action: 'INVESTOR_INVITE_CREATE',
        resource: 'investor_invitation',
        resourceId: 'inv-1',
        details: { email: 'investor@example.com' },
      })
    )
  })

  it('allows a SUPER_ADMIN to invite', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...adminUser, role: 'SUPER_ADMIN' })
    invitationMocks.createInvitation.mockResolvedValue({
      success: true,
      token: 'inv-token-456',
      invitationId: 'inv-2',
    })

    const response = await POST(
      buildRequest({ email: 'investor@example.com' }, 'session=valid-token')
    )

    expect(response.status).toBe(200)
    expect(invitationMocks.createInvitation).toHaveBeenCalledWith({
      email: 'investor@example.com',
      invitedBy: 'admin-1',
    })
  })
})
