import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  acceptInvitation,
  revokeInvitation,
  getInvitationByToken,
  validateInvitationToken,
} from '@/services/investor/invitation-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    investorInvitation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/audit/audit-logger', () => ({
  auditLogger: {
    log: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}))

describe('invitation-service-extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getInvitationByToken', () => {
    it('should return the invitation with the embedded user relation', async () => {
      const invitation = {
        id: 'invitation-1',
        email: 'investor@example.com',
        token: 'tok-1',
        status: 'pending',
        expiresAt: new Date(),
        user: {
          id: 'user-1',
          email: 'investor@example.com',
          name: 'Test Investor',
          role: 'INVESTOR',
        },
      }
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(invitation as any)

      const result = await getInvitationByToken('tok-1')

      expect(prisma.investorInvitation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token: 'tok-1' } })
      )
      expect(result).toEqual(invitation)
    })

    it('should return null when no invitation matches the token', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(null)

      const result = await getInvitationByToken('unknown-token')

      expect(result).toBeNull()
    })

    it('should restrict the embedded user select to safe fields', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(null)

      await getInvitationByToken('tok-1')

      const callArg = vi.mocked(prisma.investorInvitation.findUnique).mock.calls[0][0] as any
      expect(callArg.include.user.select).toEqual({
        id: true,
        email: true,
        name: true,
        role: true,
      })
    })
  })

  describe('acceptInvitation — failure path', () => {
    it('should return a generic failure when user creation throws', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        email: 'investor@example.com',
        token: 'valid-token',
        status: 'pending',
        expiresAt: futureDate,
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.create).mockRejectedValue(new Error('DB write failure'))

      const result = await acceptInvitation('valid-token', 'Test Investor', 'password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to accept invitation')
    })
  })

  describe('revokeInvitation — failure path', () => {
    it('should return false when the status update throws', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        status: 'pending',
        email: 'investor@example.com',
      } as any)
      vi.mocked(prisma.investorInvitation.update).mockRejectedValue(new Error('DB error'))

      const result = await revokeInvitation('invitation-1', 'admin-1')

      expect(result).toBe(false)
    })
  })

  describe('validateInvitationToken — failure path', () => {
    it('should return an invalid result when the lookup throws', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockRejectedValue(new Error('DB error'))

      const result = await validateInvitationToken('any-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Failed to validate token')
    })
  })
})
