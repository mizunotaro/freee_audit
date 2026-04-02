import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: vi.fn().mockResolvedValue(true),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn().mockReturnValue('mock-jwt-token'),
    verify: vi.fn().mockReturnValue({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'ADMIN',
      companyId: 'company-1',
    }),
  },
}))

import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  constantTimeCompare,
  createSession,
  validateSession,
  login,
  logout,
  hasPermission,
} from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

describe('Auth', () => {
  beforeEach(function () {
    process.env.JWT_SECRET = 'test-jwt-secret-for-testing'
    vi.clearAllMocks()
  })

  describe('hashPassword', function () {
    it('should hash password', async function () {
      vi.mocked(bcrypt.hash).mockResolvedValue('$2a$12$hashed' as never)
      const result = await hashPassword('password123')
      expect(result).toBe('$2a$12$hashed')
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', expect.any(Number))
    })
  })

  describe('verifyPassword', function () {
    it('should verify correct password', async function () {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      const result = await verifyPassword('password123', 'hash')
      expect(result).toBe(true)
    })

    it('should reject wrong password', async function () {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
      const result = await verifyPassword('wrong', 'hash')
      expect(result).toBe(false)
    })
  })

  describe('generateToken', function () {
    it('should generate JWT token', async function () {
      vi.mocked(jwt.sign).mockReturnValue('token-123' as never)
      const token = await generateToken('user-1', 'sess-1', 'ADMIN', 'co-1')
      expect(token).toBe('token-123')
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'sess-1',
          role: 'ADMIN',
          companyId: 'co-1',
        }),
        process.env.JWT_SECRET,
        expect.objectContaining({
          expiresIn: '24h',
          issuer: 'freee_audit',
        })
      )
    })
  })

  describe('verifyToken', function () {
    it('should return decoded token for valid token', function () {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 'user-1',
        sessionId: 'sess-1',
        role: 'ADMIN',
        companyId: 'co-1',
      } as never)
      const result = verifyToken('valid-token')
      expect(result).not.toBeNull()
      expect(result!.userId).toBe('user-1')
    })

    it('should return null for invalid token', function () {
      vi.mocked(jwt.verify).mockImplementation(function () {
        throw new Error('invalid')
      })
      const result = verifyToken('invalid-token')
      expect(result).toBeNull()
    })
  })

  describe('constantTimeCompare', function () {
    it('should return true for equal strings', function () {
      expect(constantTimeCompare('abc', 'abc')).toBe(true)
    })

    it('should return false for different strings', function () {
      expect(constantTimeCompare('abc', 'def')).toBe(false)
    })

    it('should return false for different lengths', function () {
      expect(constantTimeCompare('abc', 'abcd')).toBe(false)
    })
  })

  describe('createSession', function () {
    it('should create session in database', async function () {
      vi.mocked(jwt.sign).mockReturnValue('token-123' as never)
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(),
      } as never)

      const result = await createSession('user-1', 'ADMIN', 'co-1')
      expect(result.token).toBe('token-123')
      expect(prisma.session.create).toHaveBeenCalled()
    })
  })

  describe('validateSession', function () {
    it('should return user for valid session', async function () {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 'user-1',
        sessionId: 'sess-1',
        role: 'ADMIN',
        companyId: 'co-1',
      } as never)
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        token: 'hashed',
        expiresAt: new Date(Date.now() + 86400000),
        user: {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test User',
          role: 'ADMIN',
          companyId: 'co-1',
        },
      } as never)

      const user = await validateSession('valid-token')
      expect(user).not.toBeNull()
      expect(user!.email).toBe('test@test.com')
    })

    it('should return null for expired session', async function () {
      vi.mocked(jwt.verify).mockReturnValue({
        userId: 'user-1',
        sessionId: 'sess-1',
        role: 'ADMIN',
        companyId: 'co-1',
      } as never)
      vi.mocked(prisma.session.findUnique).mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        token: 'hashed',
        expiresAt: new Date(Date.now() - 86400000),
        user: { id: 'user-1', email: 'e', name: 'n', role: 'R', companyId: null },
      } as never)

      const user = await validateSession('expired-token')
      expect(user).toBeNull()
    })

    it('should return null for invalid token', function () {
      vi.mocked(jwt.verify).mockImplementation(function () {
        throw new Error('invalid')
      })
      return expect(validateSession('bad')).resolves.toBeNull()
    })
  })

  describe('login', function () {
    it('should login successfully', async function () {
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        role: 'ADMIN',
        companyId: 'co-1',
        passwordHash: 'hash',
      } as never)
      vi.mocked(prisma.session.create).mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        token: 'hashed',
        expiresAt: new Date(),
      } as never)
      vi.mocked(jwt.sign).mockReturnValue('token' as never)

      const result = await login('test@test.com', 'password')
      expect(result.success).toBe(true)
      expect(result.user!.email).toBe('test@test.com')
      expect(result.token).toBe('token')
    })

    it('should fail for nonexistent user', async function () {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      const result = await login('no@user.com', 'password')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid credentials')
    })

    it('should fail for wrong password', async function () {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test',
        role: 'USER',
        companyId: null,
        passwordHash: 'hash',
      } as never)

      const result = await login('test@test.com', 'wrong')
      expect(result.success).toBe(false)
    })
  })

  describe('logout', function () {
    it('should delete sessions', async function () {
      vi.mocked(prisma.session.deleteMany).mockResolvedValue({ count: 1 } as never)
      await logout('some-token')
      expect(prisma.session.deleteMany).toHaveBeenCalled()
    })
  })

  describe('hasPermission', function () {
    it('should return true when role is in list', function () {
      expect(hasPermission('ADMIN', ['ADMIN', 'SUPER_ADMIN'])).toBe(true)
    })

    it('should return false when role is not in list', function () {
      expect(hasPermission('USER', ['ADMIN', 'SUPER_ADMIN'])).toBe(false)
    })
  })
})
