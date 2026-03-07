import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    investorInvitation: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    session: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  login: vi.fn(),
}))

vi.mock('@/services/investor/invitation-service', () => ({
  acceptInvitation: vi.fn(),
  validateInvitationToken: vi.fn(),
}))

const mockAcceptInvitation = vi.mocked(
  await import('@/services/investor/invitation-service')
).acceptInvitation
const mockValidateInvitationToken = vi.mocked(
  await import('@/services/investor/invitation-service')
).validateInvitationToken
const mockLogin = vi.mocked(await import('@/lib/auth')).login

describe('Investor Accept API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/investor/accept', () => {
    it('should set secure cookie with sameSite=strict', async () => {
      mockAcceptInvitation.mockResolvedValueOnce({
        success: true,
        userId: 'user-1',
      })
      mockValidateInvitationToken.mockResolvedValueOnce({
        valid: true,
        invitation: {
          id: 'inv-1',
          email: 'investor@example.com',
          token: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000),
          status: 'PENDING',
        },
      })
      mockLogin.mockResolvedValueOnce({
        success: true,
        token: 'session-token-123',
        user: {
          id: 'user-1',
          email: 'investor@example.com',
          name: 'Test Investor',
          role: 'VIEWER',
          companyId: 'company-1',
        },
      })

      const { POST } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-token',
          name: 'Test Investor',
          password: 'securePassword123',
        }),
      })

      const response = await POST(request)
      const setCookie = response.headers.get('set-cookie')

      expect(setCookie).not.toBeNull()
      expect(setCookie).toContain('HttpOnly')
      expect(setCookie).toContain('Secure')
      expect(setCookie!.toLowerCase()).toContain('samesite=strict')
    })

    it('should return 400 for invalid input', async () => {
      const { POST } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: '',
          name: '',
          password: 'short',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid input')
    })

    it('should return 400 for failed acceptance', async () => {
      mockAcceptInvitation.mockResolvedValueOnce({
        success: false,
        error: 'Invalid or expired invitation token',
      })

      const { POST } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'invalid-token',
          name: 'Test Investor',
          password: 'securePassword123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid or expired invitation token')
    })

    it('should return 201 when login fails after acceptance', async () => {
      mockAcceptInvitation.mockResolvedValueOnce({
        success: true,
        userId: 'user-1',
      })
      mockValidateInvitationToken.mockResolvedValueOnce({
        valid: true,
        invitation: {
          id: 'inv-1',
          email: 'investor@example.com',
          token: 'valid-token',
          expiresAt: new Date(Date.now() + 86400000),
          status: 'PENDING',
        },
      })
      mockLogin.mockResolvedValueOnce({
        success: false,
        error: 'Invalid credentials',
      })

      const { POST } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'valid-token',
          name: 'Test Investor',
          password: 'securePassword123',
        }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.userId).toBe('user-1')
    })
  })

  describe('GET /api/investor/accept', () => {
    it('should validate token and return invitation details', async () => {
      mockValidateInvitationToken.mockResolvedValueOnce({
        valid: true,
        invitation: {
          id: 'inv-1',
          email: 'investor@example.com',
          token: 'valid-token',
          expiresAt: new Date('2024-12-31'),
          status: 'PENDING',
        },
      })

      const { GET } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept?token=valid-token')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.invitation.email).toBe('investor@example.com')
    })

    it('should return 400 for missing token', async () => {
      const { GET } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Token is required')
    })

    it('should return 400 for invalid token', async () => {
      mockValidateInvitationToken.mockResolvedValueOnce({
        valid: false,
        error: 'Invalid or expired token',
      })

      const { GET } = await import('@/app/api/investor/accept/route')
      const request = new NextRequest('http://localhost/api/investor/accept?token=invalid-token')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid or expired token')
    })
  })
})
