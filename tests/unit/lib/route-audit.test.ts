import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { logRouteAudit } from '@/lib/route-audit'
import { auditLogger } from '@/lib/audit/audit-logger'
import { ERROR_CODES } from '@/types/result'

vi.mock('@/lib/audit/audit-logger', () => ({
  auditLogger: { log: vi.fn() },
}))

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers })
}

describe('logRouteAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auditLogger.log).mockResolvedValue(undefined)
  })

  describe('happy path', () => {
    it('logs with explicit userId and defaults result to SUCCESS', async () => {
      const request = makeRequest()

      const result = await logRouteAudit({
        request,
        userId: 'user-123',
        action: 'CREATE_ITEM',
        resource: 'item',
      })

      expect(result.success).toBe(true)
      expect(auditLogger.log).toHaveBeenCalledTimes(1)
      expect(auditLogger.log).toHaveBeenCalledWith({
        userId: 'user-123',
        action: 'CREATE_ITEM',
        resource: 'item',
        resourceId: undefined,
        ipAddress: undefined,
        userAgent: undefined,
        details: undefined,
        result: 'SUCCESS',
      })
    })

    it('forwards resourceId and details when provided', async () => {
      const request = makeRequest()

      const result = await logRouteAudit({
        request,
        userId: 'user-1',
        action: 'UPDATE_ITEM',
        resource: 'item',
        resourceId: 'item-9',
        details: { before: 1, after: 2 },
      })

      expect(result.success).toBe(true)
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 'item-9',
          details: { before: 1, after: 2 },
        })
      )
    })

    it('passes an explicit FAILURE result through to the logger', async () => {
      const request = makeRequest()

      const result = await logRouteAudit({
        request,
        userId: 'user-1',
        action: 'DELETE_ITEM',
        resource: 'item',
        result: 'FAILURE',
      })

      expect(result.success).toBe(true)
      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ result: 'FAILURE' }))
    })

    it('reads ipAddress and userAgent from request headers', async () => {
      const request = makeRequest({
        'x-forwarded-for': '203.0.113.7',
        'user-agent': 'Mozilla/5.0 (audit-client)',
      })

      const result = await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
      })

      expect(result.success).toBe(true)
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '203.0.113.7',
          userAgent: 'Mozilla/5.0 (audit-client)',
        })
      )
    })
  })

  describe('userId resolution precedence', () => {
    it('falls back to the x-user-id header when userId is omitted', async () => {
      const request = makeRequest({ 'x-user-id': 'header-user' })

      await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
      })

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'header-user' })
      )
    })

    it('prefers an explicit userId over the x-user-id header', async () => {
      const request = makeRequest({ 'x-user-id': 'header-user' })

      await logRouteAudit({
        request,
        userId: 'explicit-user',
        action: 'VIEW',
        resource: 'report',
      })

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'explicit-user' })
      )
    })

    it('resolves to undefined when neither userId nor the header is present', async () => {
      const request = makeRequest()

      await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
      })

      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }))
    })
  })

  describe('edge cases / boundaries', () => {
    it('accepts the minimal input of request, action and resource', async () => {
      const request = makeRequest()

      const result = await logRouteAudit({
        request,
        action: 'PING',
        resource: 'system',
      })

      expect(result.success).toBe(true)
      expect(auditLogger.log).toHaveBeenCalledWith({
        userId: undefined,
        action: 'PING',
        resource: 'system',
        resourceId: undefined,
        ipAddress: undefined,
        userAgent: undefined,
        details: undefined,
        result: 'SUCCESS',
      })
    })

    it('passes a comma-separated x-forwarded-for value through untouched', async () => {
      const request = makeRequest({ 'x-forwarded-for': '203.0.113.7, 198.51.100.4' })

      await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
      })

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '203.0.113.7, 198.51.100.4' })
      )
    })

    it('forwards an empty details object', async () => {
      const request = makeRequest()

      await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
        details: {},
      })

      expect(auditLogger.log).toHaveBeenCalledWith(expect.objectContaining({ details: {} }))
    })

    it('treats absent x-forwarded-for and user-agent headers as undefined', async () => {
      const request = makeRequest()

      await logRouteAudit({
        request,
        action: 'VIEW',
        resource: 'report',
      })

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: undefined, userAgent: undefined })
      )
    })
  })

  describe('fail-safe error handling', () => {
    it('returns a DATABASE_ERROR failure preserving the thrown Error message and cause', async () => {
      const dbError = new Error('connection refused')
      vi.mocked(auditLogger.log).mockRejectedValue(dbError)

      const result = await logRouteAudit({
        request: makeRequest(),
        userId: 'user-1',
        action: 'CREATE',
        resource: 'item',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.DATABASE_ERROR)
        expect(result.error.message).toBe('connection refused')
        expect(result.error.cause).toBe(dbError)
        expect(result.error.timestamp).toBeInstanceOf(Date)
      }
    })

    it('wraps a non-Error throw into an Error via String()', async () => {
      vi.mocked(auditLogger.log).mockRejectedValue('boom string')

      const result = await logRouteAudit({
        request: makeRequest(),
        action: 'CREATE',
        resource: 'item',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe(ERROR_CODES.DATABASE_ERROR)
        expect(result.error.message).toBe('boom string')
        expect(result.error.cause).toBeInstanceOf(Error)
        expect(result.error.cause?.message).toBe('boom string')
      }
    })

    it('degrades to a failure Result instead of throwing out of the caller', async () => {
      vi.mocked(auditLogger.log).mockRejectedValue(new Error('logger down'))

      await expect(
        logRouteAudit({
          request: makeRequest(),
          action: 'CREATE',
          resource: 'item',
        })
      ).resolves.toMatchObject({ success: false })
    })
  })
})
