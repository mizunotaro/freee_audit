import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateInvitationToken,
  calculateExpiryDate,
  createInvitation,
  validateInvitationToken,
  acceptInvitation,
  revokeInvitation,
  listPendingInvitations,
  cleanupExpiredInvitations,
  INVITATION_TOKEN_BYTES,
  INVITATION_EXPIRY_DAYS,
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

describe('invitation-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateInvitationToken', () => {
    it('should generate a token with correct length', () => {
      const token = generateInvitationToken()
      expect(token).toHaveLength(INVITATION_TOKEN_BYTES * 2)
    })

    it('should generate unique tokens', () => {
      const tokens = new Set()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInvitationToken())
      }
      expect(tokens.size).toBe(100)
    })

    it('should only contain hex characters', () => {
      const token = generateInvitationToken()
      expect(token).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('calculateExpiryDate', () => {
    it('should calculate correct expiry date', () => {
      const expiryDate = calculateExpiryDate()
      const now = new Date()
      const expectedExpiry = new Date(now)
      expectedExpiry.setDate(expectedExpiry.getDate() + INVITATION_EXPIRY_DAYS)

      const diffMs = Math.abs(expiryDate.getTime() - expectedExpiry.getTime())
      expect(diffMs).toBeLessThan(1000)
    })

    it('should return a date in the future', () => {
      const expiryDate = calculateExpiryDate()
      expect(expiryDate.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('createInvitation', () => {
    it('should create invitation successfully', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.create).mockResolvedValue({
        id: 'invitation-1',
        email: 'investor@example.com',
        token: 'test-token',
        invitedBy: 'admin-1',
        invitedAt: new Date(),
        expiresAt: new Date(),
        status: 'pending',
        userId: null,
        acceptedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const result = await createInvitation({
        email: 'investor@example.com',
        invitedBy: 'admin-1',
      })

      expect(result.success).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.invitationId).toBe('invitation-1')
    })

    it('should fail if user already exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'investor@example.com',
      } as any)

      const result = await createInvitation({
        email: 'investor@example.com',
        invitedBy: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('User with this email already exists')
    })

    it('should fail if pending invitation exists', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.findFirst).mockResolvedValue({
        id: 'existing-invitation',
        status: 'pending',
      } as any)

      const result = await createInvitation({
        email: 'investor@example.com',
        invitedBy: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Pending invitation already exists for this email')
    })

    it('should handle database errors', async () => {
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB error'))

      const result = await createInvitation({
        email: 'investor@example.com',
        invitedBy: 'admin-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create invitation')
    })
  })

  describe('validateInvitationToken', () => {
    it('should validate a valid token', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        email: 'investor@example.com',
        token: 'valid-token',
        status: 'pending',
        expiresAt: futureDate,
      } as any)

      const result = await validateInvitationToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.invitation).toBeDefined()
      expect(result.invitation!.email).toBe('investor@example.com')
    })

    it('should fail for non-existent token', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(null)

      const result = await validateInvitationToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid invitation token')
    })

    it('should fail for already accepted invitation', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        status: 'accepted',
      } as any)

      const result = await validateInvitationToken('accepted-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invitation already accepted')
    })

    it('should fail and mark expired invitation', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 1)

      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        status: 'pending',
        expiresAt: pastDate,
      } as any)
      vi.mocked(prisma.investorInvitation.update).mockResolvedValue({} as any)

      const result = await validateInvitationToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invitation has expired')
      expect(prisma.investorInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'expired' },
        })
      )
    })
  })

  describe('acceptInvitation', () => {
    it('should accept invitation and create user', async () => {
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
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'user-1',
        email: 'investor@example.com',
        name: 'Test Investor',
        role: 'INVESTOR',
      } as any)
      vi.mocked(prisma.investorInvitation.update).mockResolvedValue({} as any)

      const result = await acceptInvitation('valid-token', 'Test Investor', 'password123')

      expect(result.success).toBe(true)
      expect(result.userId).toBe('user-1')
    })

    it('should fail for invalid token', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(null)

      const result = await acceptInvitation('invalid-token', 'Test', 'password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid invitation token')
    })

    it('should fail if user already exists', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        email: 'investor@example.com',
        token: 'valid-token',
        status: 'pending',
        expiresAt: futureDate,
      } as any)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'existing-user',
      } as any)

      const result = await acceptInvitation('valid-token', 'Test', 'password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('User already exists')
    })
  })

  describe('revokeInvitation', () => {
    it('should revoke a pending invitation', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        status: 'pending',
        email: 'investor@example.com',
      } as any)
      vi.mocked(prisma.investorInvitation.update).mockResolvedValue({} as any)

      const result = await revokeInvitation('invitation-1', 'admin-1')

      expect(result).toBe(true)
    })

    it('should return false for non-existent invitation', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue(null)

      const result = await revokeInvitation('non-existent', 'admin-1')

      expect(result).toBe(false)
    })

    it('should return false for non-pending invitation', async () => {
      vi.mocked(prisma.investorInvitation.findUnique).mockResolvedValue({
        id: 'invitation-1',
        status: 'accepted',
      } as any)

      const result = await revokeInvitation('invitation-1', 'admin-1')

      expect(result).toBe(false)
    })
  })

  describe('listPendingInvitations', () => {
    it('should list all pending invitations', async () => {
      vi.mocked(prisma.investorInvitation.findMany).mockResolvedValue([
        { id: 'invitation-1', status: 'pending' },
        { id: 'invitation-2', status: 'pending' },
      ] as any)

      const result = await listPendingInvitations()

      expect(result).toHaveLength(2)
      expect(prisma.investorInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        })
      )
    })
  })

  describe('cleanupExpiredInvitations', () => {
    it('should mark expired invitations', async () => {
      vi.mocked(prisma.investorInvitation.updateMany).mockResolvedValue({ count: 5 })

      const count = await cleanupExpiredInvitations()

      expect(count).toBe(5)
    })

    it('should handle database errors', async () => {
      vi.mocked(prisma.investorInvitation.updateMany).mockRejectedValue(new Error('DB error'))

      const count = await cleanupExpiredInvitations()

      expect(count).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle special characters in email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.create).mockResolvedValue({
        id: 'invitation-1',
        email: 'test+investor@example.com',
      } as any)

      const result = await createInvitation({
        email: 'test+investor@example.com',
        invitedBy: 'admin-1',
      })

      expect(result.success).toBe(true)
    })

    it('should handle concurrent invitation creation', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.investorInvitation.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'existing',
          status: 'pending',
        } as any)

      const [result1, result2] = await Promise.all([
        createInvitation({ email: 'same@example.com', invitedBy: 'admin-1' }),
        createInvitation({ email: 'same@example.com', invitedBy: 'admin-1' }),
      ])

      expect(result1.success || result2.success).toBe(true)
    })
  })
})
