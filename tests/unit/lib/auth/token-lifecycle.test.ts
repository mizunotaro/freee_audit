import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  validateRefreshToken,
} from '@/lib/auth/token-lifecycle'

import { prisma } from '@/lib/db'

const mockRevoke = vi.fn().mockResolvedValue({ count: 0 })

vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      create: vi.fn().mockResolvedValue({ id: 'session-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({ id: 'session-1' }),
      delete: vi.fn().mockResolvedValue({ id: 'session-1' }),
      deleteMany: vi.fn((opts: any) => {
        if (opts && opts.where && opts.where.token) {
          return mockRevoke(opts)
        }
        return { count: 1 }
      }),
    },
  },
}))

describe('TokenLifecycle', () => {
  describe('createTokenPair', () => {
    it('should create access and refresh tokens', () => {
      const pair = createTokenPair()
      expect(pair.accessToken).toBeDefined()
      expect(pair.refreshToken).toBeDefined()
      expect(pair.accessExpiresAt).toBeInstanceOf(Date)
      expect(pair.refreshExpiresAt).toBeInstanceOf(Date)
      expect(pair.accessToken).not.toBe(pair.refreshToken)
    })

    it('should set access token expiry shorter than refresh', () => {
      const pair = createTokenPair()
      expect(pair.accessExpiresAt.getTime()).toBeLessThan(pair.refreshExpiresAt.getTime())
    })

    it('should generate unique tokens', () => {
      const pair1 = createTokenPair()
      const pair2 = createTokenPair()
      expect(pair1.accessToken).not.toBe(pair2.accessToken)
      expect(pair1.refreshToken).not.toBe(pair2.refreshToken)
    })
  })

  describe('rotateRefreshToken', () => {
    it('should fail for invalid token', async () => {
      const result = await rotateRefreshToken('invalid-token')
      expect(result.rotated).toBe(false)
      expect(result.reason).toBe('Invalid refresh token')
    })
  })

  describe('revokeRefreshToken', () => {
    it('should return false when no session found', async () => {
      const result = await revokeRefreshToken('nonexistent-token')
      expect(result).toBe(false)
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for user', async () => {
      const count = await revokeAllUserTokens('user-1')
      expect(count).toBe(1)
    })
  })

  describe('validateRefreshToken', () => {
    it('should return invalid for nonexistent token', async () => {
      const result = await validateRefreshToken('nonexistent-token')
      expect(result.valid).toBe(false)
    })
  })
})
