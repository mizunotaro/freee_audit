import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

import { validateSessionEdge, extractUserFromToken } from '@/lib/auth-edge'

describe('Auth Edge', () => {
  beforeEach(function () {
    process.env.JWT_SECRET = 'test-jwt-secret-for-edge'
  })

  function createTestToken(payload: Record<string, unknown>): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const body = btoa(
      JSON.stringify({
        ...payload,
        iss: 'freee_audit',
        aud: 'freee_audit_users',
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
    const signature = btoa('fake-signature')
    return `${header}.${body}.${signature}`
  }

  describe('validateSessionEdge', function () {
    it('should return null for malformed token', async function () {
      const result = await validateSessionEdge('not-a-jwt')
      expect(result).toBeNull()
    })

    it('should return null for token with wrong number of parts', async function () {
      const result = await validateSessionEdge('part1.part2')
      expect(result).toBeNull()
    })

    it('should return null for expired token', async function () {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const body = btoa(
        JSON.stringify({
          userId: 'user-1',
          sessionId: 'sess-1',
          role: 'ADMIN',
          companyId: null,
          iss: 'freee_audit',
          aud: 'freee_audit_users',
          exp: Math.floor(Date.now() / 1000) - 3600,
        })
      )
      const signature = btoa('fake')
      const token = `${header}.${body}.${signature}`
      const result = await validateSessionEdge(token)
      expect(result).toBeNull()
    })

    it('should return null for wrong issuer', async function () {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const body = btoa(
        JSON.stringify({
          userId: 'user-1',
          sessionId: 'sess-1',
          iss: 'wrong-issuer',
          aud: 'freee_audit_users',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      )
      const signature = btoa('fake')
      const token = `${header}.${body}.${signature}`
      const result = await validateSessionEdge(token)
      expect(result).toBeNull()
    })

    it('should return null for wrong audience', async function () {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      const body = btoa(
        JSON.stringify({
          userId: 'user-1',
          sessionId: 'sess-1',
          iss: 'freee_audit',
          aud: 'wrong-audience',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      )
      const signature = btoa('fake')
      const token = `${header}.${body}.${signature}`
      const result = await validateSessionEdge(token)
      expect(result).toBeNull()
    })
  })

  describe('extractUserFromToken', function () {
    it('should delegate to validateSessionEdge', async function () {
      const result = await extractUserFromToken('bad-token')
      expect(result).toBeNull()
    })
  })
})
