import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateSessionPolicy,
  cleanupExpiredSessions,
  getPolicyConfig,
  DEFAULT_POLICY,
} from '@/lib/auth/session-policy'

vi.mock('@/lib/db', () => ({
  prisma: {
    session: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('SessionPolicy', () => {
  describe('validateSessionPolicy', () => {
    it('should pass valid session', () => {
      const session = {
        createdAt: new Date(Date.now() - 1000),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      }
      const result = validateSessionPolicy(session)
      expect(result.valid).toBe(true)
    })

    it('should reject expired session', () => {
      const session = {
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 1),
      }
      const result = validateSessionPolicy(session)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('session_expired')
      expect(result.shouldTerminate).toBe(true)
    })

    it('should detect idle timeout', () => {
      const session = {
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 19 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 5 * 60 * 60 * 1000),
      }
      const result = validateSessionPolicy(session, {
        ...DEFAULT_POLICY,
        idleTimeoutMs: 4 * 60 * 60 * 1000,
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('idle_timeout')
    })

    it('should flag session for refresh near expiry', () => {
      const session = {
        createdAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      }
      const result = validateSessionPolicy(session)
      expect(result.valid).toBe(true)
      expect(result.shouldRefresh).toBe(true)
    })

    it('should reject session exceeding max age', () => {
      const session = {
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      }
      const result = validateSessionPolicy(session, {
        ...DEFAULT_POLICY,
        sessionMaxAgeMs: 24 * 60 * 60 * 1000,
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('max_age_exceeded')
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      const count = await cleanupExpiredSessions()
      expect(count).toBe(2)
    })
  })

  describe('getPolicyConfig', () => {
    it('should return valid config', () => {
      const config = getPolicyConfig()
      expect(config.maxConcurrentSessions).toBeGreaterThan(0)
      expect(config.sessionMaxAgeMs).toBeGreaterThan(0)
      expect(config.idleTimeoutMs).toBeGreaterThan(0)
    })
  })
})
