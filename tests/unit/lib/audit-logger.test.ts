import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditLogger } from '@/lib/audit/audit-logger'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe('auditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('log', () => {
    it('should create audit log entry', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        userId: 'user-1',
        action: 'CREATE_ITEM',
        resource: 'item',
        resourceId: 'item-1',
        result: 'SUCCESS',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'CREATE_ITEM',
          resource: 'item',
          resourceId: 'item-1',
          ipAddress: undefined,
          userAgent: undefined,
          details: null,
          result: 'SUCCESS',
        },
      })
    })

    it('should handle optional fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'VIEW_DASHBOARD',
        resource: 'dashboard',
        result: 'SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { page: '/dashboard', duration: 5000 },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: undefined,
          action: 'VIEW_DASHBOARD',
          resource: 'dashboard',
          resourceId: undefined,
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          details: JSON.stringify({ page: '/dashboard', duration: 5000 }),
          result: 'SUCCESS',
        },
      })
    })

    it('should handle database errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('Database error'))

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        result: 'SUCCESS',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AuditLogger] Failed to write audit log:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should handle FAILURE result', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'DELETE_ITEM',
        resource: 'item',
        resourceId: 'item-1',
        result: 'FAILURE',
        details: { error: 'Item not found' },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: 'FAILURE',
            details: JSON.stringify({ error: 'Item not found' }),
          }),
        })
      )
    })
  })

  describe('logApiCall', () => {
    it('should log successful API call', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logApiCall({
        provider: 'freee',
        endpoint: '/api/1/journals',
        method: 'GET',
        statusCode: 200,
        durationMs: 150,
        requestData: { limit: 100 },
        userId: 'user-1',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          action: 'API_CALL:freee',
          resource: 'GET /api/1/journals',
          resourceId: undefined,
          details: JSON.stringify({
            provider: 'freee',
            endpoint: '/api/1/journals',
            method: 'GET',
            statusCode: 200,
            durationMs: 150,
            requestData: { limit: 100 },
            error: undefined,
          }),
          result: 'SUCCESS',
        },
      })
    })

    it('should log failed API call', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logApiCall({
        provider: 'openai',
        endpoint: '/v1/chat/completions',
        method: 'POST',
        statusCode: 429,
        durationMs: 50,
        error: 'Rate limit exceeded',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: 'FAILURE',
          }),
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.auditLog.create).mockRejectedValue(new Error('DB error'))

      await auditLogger.logApiCall({
        provider: 'test',
        endpoint: '/test',
        method: 'GET',
        statusCode: 200,
        durationMs: 100,
      })

      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('logUserAction', () => {
    it('should log user action with default SUCCESS result', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logUserAction('user-1', 'UPDATE_SETTINGS', 'settings', 'setting-1', {
        field: 'theme',
        oldValue: 'light',
        newValue: 'dark',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'UPDATE_SETTINGS',
          resource: 'settings',
          resourceId: 'setting-1',
          result: 'SUCCESS',
          details: JSON.stringify({
            field: 'theme',
            oldValue: 'light',
            newValue: 'dark',
          }),
        }),
      })
    })

    it('should handle missing optional parameters', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logUserAction('user-1', 'VIEW_REPORT', 'report')

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'VIEW_REPORT',
          resource: 'report',
          resourceId: undefined,
          details: undefined,
          result: 'SUCCESS',
        }),
      })
    })
  })

  describe('logLogin', () => {
    it('should log user login', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogin('user-1', '192.168.1.1', 'Mozilla/5.0')

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'LOGIN',
          resource: 'session',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          result: 'SUCCESS',
        }),
      })
    })

    it('should handle login without IP/user agent', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogin('user-1')

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'LOGIN',
          ipAddress: undefined,
          userAgent: undefined,
        }),
      })
    })
  })

  describe('logLogout', () => {
    it('should log user logout', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogout('user-1', '192.168.1.1')

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          action: 'LOGOUT',
          resource: 'session',
          ipAddress: '192.168.1.1',
          result: 'SUCCESS',
        }),
      })
    })
  })

  describe('robustness', () => {
    it('should handle null values in details', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        result: 'SUCCESS',
        details: { value: null, nested: { key: null } },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: JSON.stringify({ value: null, nested: { key: null } }),
        }),
      })
    })

    it('should handle undefined values in details', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        result: 'SUCCESS',
        details: { value: undefined },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          details: JSON.stringify({}), // undefined values are omitted in JSON
        }),
      })
    })

    it('should handle very large details object', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      const largeDetails = {
        data: Array(1000).fill({ key: 'value', nested: { a: 1, b: 2 } }),
      }

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        result: 'SUCCESS',
        details: largeDetails,
      })

      expect(prisma.auditLog.create).toHaveBeenCalled()
    })

    it('should handle special characters in fields', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        resourceId: 'id-with-special-chars-<>&"\'',
        result: 'SUCCESS',
        details: { special: 'chars < > & " \'' },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceId: 'id-with-special-chars-<>&"\'',
          }),
        })
      )
    })
  })

  describe('data consistency', () => {
    it('should serialize details consistently', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      const details = { a: 1, b: 2, c: 3 }

      await auditLogger.log({
        action: 'TEST1',
        resource: 'test',
        result: 'SUCCESS',
        details,
      })

      await auditLogger.log({
        action: 'TEST2',
        resource: 'test',
        result: 'SUCCESS',
        details,
      })

      const calls = vi.mocked(prisma.auditLog.create).mock.calls

      expect(calls[0][0].data.details).toBe(calls[1][0].data.details)
    })
  })
})
