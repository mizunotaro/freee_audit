import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  createSession,
  validateSession,
  login,
  logout,
  hasPermission,
} from '@/lib/auth'

const mockSessionCreate = vi.fn()
const mockSessionFindUnique = vi.fn()
const mockSessionDeleteMany = vi.fn()
const mockUserFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: () => mockUserFindUnique(),
    },
    session: {
      create: (args: unknown) => mockSessionCreate(args),
      findUnique: (args: unknown) => mockSessionFindUnique(args),
      deleteMany: (args: unknown) => mockSessionDeleteMany(args),
    },
  },
}))

describe('Auth Module', () => {
  const originalJwtSecret = process.env.JWT_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing'
    process.env.BCRYPT_ROUNDS = '4'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.JWT_SECRET = originalJwtSecret
  })

  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty password', async () => {
      const hash = await hashPassword('')
      expect(hash).toBeDefined()
    })

    it('should handle long password', async () => {
      const longPassword = 'a'.repeat(1000)
      const hash = await hashPassword(longPassword)
      expect(hash).toBeDefined()
    })

    it('should handle special characters', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      const hash = await hashPassword(specialPassword)
      expect(hash).toBeDefined()
    })

    it('should handle unicode characters', async () => {
      const unicodePassword = 'パスワード123🔐'
      const hash = await hashPassword(unicodePassword)
      expect(hash).toBeDefined()
    })
  })

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)
      const result = await verifyPassword(password, hash)

      expect(result).toBe(true)
    })

    it('should return false for incorrect password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)
      const result = await verifyPassword('wrongPassword', hash)

      expect(result).toBe(false)
    })

    it('should return false for empty password', async () => {
      const hash = await hashPassword('password')
      const result = await verifyPassword('', hash)

      expect(result).toBe(false)
    })

    it('should handle case sensitivity', async () => {
      const password = 'TestPassword'
      const hash = await hashPassword(password)
      const result = await verifyPassword('testpassword', hash)

      expect(result).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      const userId = 'user-123'
      const sessionId = 'session-123'
      const token = await generateToken(userId, sessionId)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    it('should generate different tokens for same userId', async () => {
      const userId = 'user-123'
      const sessionId1 = 'session-1'
      const sessionId2 = 'session-2'
      const token1 = await generateToken(userId, sessionId1)
      const token2 = await generateToken(userId, sessionId2)

      expect(token1).not.toBe(token2)
    })

    it('should include userId in token payload', async () => {
      const userId = 'user-456'
      const sessionId = 'session-456'
      const token = await generateToken(userId, sessionId)
      const decoded = verifyToken(token)

      expect(decoded).not.toBeNull()
      expect(decoded?.userId).toBe(userId)
      expect(decoded?.sessionId).toBe(sessionId)
    })
  })

  describe('verifyToken', () => {
    it('should return decoded token for valid token', async () => {
      const userId = 'user-789'
      const sessionId = 'session-789'
      const token = await generateToken(userId, sessionId)
      const decoded = verifyToken(token)

      expect(decoded).not.toBeNull()
      expect(decoded?.userId).toBe(userId)
      expect(decoded?.sessionId).toBe(sessionId)
    })

    it('should return null for invalid token', () => {
      const result = verifyToken('invalid-token')

      expect(result).toBeNull()
    })

    it('should return null for empty token', () => {
      const result = verifyToken('')

      expect(result).toBeNull()
    })

    it('should return null for malformed JWT', () => {
      const result = verifyToken('not.a.valid.jwt')

      expect(result).toBeNull()
    })

    it('should return null for token with wrong secret', async () => {
      const jwt = await import('jsonwebtoken')
      const token = jwt.default.sign({ userId: 'user-123' }, 'wrong-secret')
      const result = verifyToken(token)

      expect(result).toBeNull()
    })
  })

  describe('createSession', () => {
    it('should create a session in database', async () => {
      const userId = 'user-123'
      const mockSession = {
        id: 'session-1',
        userId,
        token: 'generated-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdAt: new Date(),
      }

      mockSessionCreate.mockResolvedValueOnce(mockSession)

      const result = await createSession(userId)

      expect(mockSessionCreate).toHaveBeenCalledWith({
        data: {
          userId,
          token: expect.any(String),
          expiresAt: expect.any(Date),
        },
      })
      expect(result.userId).toBe(userId)
    })

    it('should set correct expiration time', async () => {
      const userId = 'user-123'
      const beforeCreate = Date.now()

      mockSessionCreate.mockResolvedValueOnce({
        id: 'session-1',
        userId,
        token: 'token',
        expiresAt: new Date(),
        createdAt: new Date(),
      })

      await createSession(userId)

      const callArgs = mockSessionCreate.mock.calls[0][0]
      const expiresAt = callArgs.data.expiresAt as Date
      const expectedExpiry = beforeCreate + 24 * 60 * 60 * 1000

      expect(expiresAt.getTime()).toBeGreaterThan(beforeCreate)
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000)
    })
  })

  describe('validateSession', () => {
    it('should return user for valid session', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        companyId: 'company-1',
      }
      const mockSession = {
        id: 'session-1',
        userId: 'user-123',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user: mockUser,
      }

      mockSessionFindUnique.mockResolvedValueOnce(mockSession)

      const userId = 'user-123'
      const token = await generateToken(userId, 'session-123')
      const result = await validateSession(token)

      expect(result).not.toBeNull()
      expect(result?.id).toBe('user-123')
      expect(result?.email).toBe('test@example.com')
      expect(result?.role).toBe('admin')
    })

    it('should return null for invalid token', async () => {
      const result = await validateSession('invalid-token')

      expect(result).toBeNull()
      expect(mockSessionFindUnique).not.toHaveBeenCalled()
    })

    it('should return null for expired session', async () => {
      const mockSession = {
        id: 'session-1',
        userId: 'user-123',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'admin',
          companyId: null,
        },
      }

      mockSessionFindUnique.mockResolvedValueOnce(mockSession)

      const userId = 'user-123'
      const token = await generateToken(userId, 'session-expired')
      const result = await validateSession(token)

      expect(result).toBeNull()
    })

    it('should return null for non-existent session', async () => {
      mockSessionFindUnique.mockResolvedValueOnce(null)

      const userId = 'user-123'
      const token = await generateToken(userId, 'session-nonexistent')
      const result = await validateSession(token)

      expect(result).toBeNull()
    })
  })

  describe('login', () => {
    it('should return success for valid credentials', async () => {
      const password = 'correctPassword'
      const hash = await hashPassword(password)
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        companyId: 'company-1',
        passwordHash: hash,
      }

      mockUserFindUnique.mockResolvedValueOnce(mockUser)
      mockSessionCreate.mockResolvedValueOnce({
        id: 'session-1',
        userId: 'user-123',
        token: 'token',
        expiresAt: new Date(),
      })

      const result = await login('test@example.com', password)

      expect(result.success).toBe(true)
      expect(result.user).toBeDefined()
      expect(result.user?.email).toBe('test@example.com')
      expect(result.token).toBeDefined()
    })

    it('should return error for non-existent user', async () => {
      mockUserFindUnique.mockResolvedValueOnce(null)

      const result = await login('nonexistent@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
      expect(result.user).toBeUndefined()
      expect(result.token).toBeUndefined()
    })

    it('should return error for wrong password', async () => {
      const hash = await hashPassword('correctPassword')
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        companyId: null,
        passwordHash: hash,
      }

      mockUserFindUnique.mockResolvedValueOnce(mockUser)

      const result = await login('test@example.com', 'wrongPassword')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
    })

    it('should return error for user without password hash', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        companyId: null,
        passwordHash: null,
      }

      mockUserFindUnique.mockResolvedValueOnce(mockUser)

      const result = await login('test@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
    })
  })

  describe('logout', () => {
    it('should delete session by token', async () => {
      const token = 'token-to-delete'

      await logout(token)

      expect(mockSessionDeleteMany).toHaveBeenCalledWith({
        where: { token },
      })
    })

    it('should handle empty token', async () => {
      await logout('')

      expect(mockSessionDeleteMany).toHaveBeenCalledWith({
        where: { token: '' },
      })
    })
  })

  describe('hasPermission', () => {
    it('should return true when role is in required roles', () => {
      const result = hasPermission('admin', ['admin', 'manager'])

      expect(result).toBe(true)
    })

    it('should return false when role is not in required roles', () => {
      const result = hasPermission('user', ['admin', 'manager'])

      expect(result).toBe(false)
    })

    it('should return true for exact match', () => {
      const result = hasPermission('admin', ['admin'])

      expect(result).toBe(true)
    })

    it('should return false for empty required roles', () => {
      const result = hasPermission('admin', [])

      expect(result).toBe(false)
    })

    it('should be case-sensitive', () => {
      const result = hasPermission('Admin', ['admin'])

      expect(result).toBe(false)
    })

    it('should handle multiple role checks', () => {
      expect(hasPermission('viewer', ['viewer', 'editor', 'admin'])).toBe(true)
      expect(hasPermission('editor', ['viewer', 'editor', 'admin'])).toBe(true)
      expect(hasPermission('guest', ['viewer', 'editor', 'admin'])).toBe(false)
    })
  })
})

describe('Auth Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
  })

  describe('Token expiration', () => {
    it('should include expiration in token', async () => {
      const jwt = await import('jsonwebtoken')
      const token = await generateToken('user-1', 'session-1')
      const decoded = jwt.default.decode(token) as { exp?: number; iat?: number }

      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
    })
  })
})
