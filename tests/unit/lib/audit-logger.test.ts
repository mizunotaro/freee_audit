import { describe, it, expect, vi, beforeEach } from 'vitest'
import { auditLogger, computeEntryHash, VERSION } from '@/lib/audit/audit-logger'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))

const ORIGINAL_AUDIT_HASH_SECRET = process.env.AUDIT_HASH_SECRET

describe('auditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AUDIT_HASH_SECRET = 'test-audit-hash-secret-for-testing-min-32-chars'
  })

  describe('log', () => {
    it('should create audit log entry with content hash and previous hash', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue({
        contentHash: 'previous-hash-value',
      } as any)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        userId: 'user-1',
        action: 'CREATE_ITEM',
        resource: 'item',
        resourceId: 'item-1',
        result: 'SUCCESS',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'CREATE_ITEM',
            resource: 'item',
            resourceId: 'item-1',
            result: 'SUCCESS',
            previousHash: 'previous-hash-value',
            contentHash: expect.any(String),
          }),
        })
      )
    })

    it('should set previousHash to null for first entry', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'FIRST_ENTRY',
        resource: 'system',
        result: 'SUCCESS',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousHash: null,
            contentHash: expect.any(String),
          }),
        })
      )
    })

    it('should handle optional fields with null conversion', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'VIEW_DASHBOARD',
        resource: 'dashboard',
        result: 'SUCCESS',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        details: { page: '/dashboard', duration: 5000 },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: null,
            action: 'VIEW_DASHBOARD',
            resource: 'dashboard',
            resourceId: null,
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            details: JSON.stringify({ page: '/dashboard', duration: 5000 }),
            result: 'SUCCESS',
          }),
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(prisma.auditLog.findFirst).mockRejectedValue(new Error('Database error'))

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
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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
    it('should log successful API call with hash', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'API_CALL:freee',
            resource: 'GET /api/1/journals',
            contentHash: expect.any(String),
          }),
        })
      )
    })

    it('should log failed API call', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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
      vi.mocked(prisma.auditLog.findFirst).mockRejectedValue(new Error('DB error'))

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
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logUserAction('user-1', 'UPDATE_SETTINGS', 'settings', 'setting-1', {
        field: 'theme',
        oldValue: 'light',
        newValue: 'dark',
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'UPDATE_SETTINGS',
            resource: 'settings',
            resourceId: 'setting-1',
            result: 'SUCCESS',
          }),
        })
      )
    })

    it('should handle missing optional parameters', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logUserAction('user-1', 'VIEW_REPORT', 'report')

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'VIEW_REPORT',
            resource: 'report',
            resourceId: null,
            result: 'SUCCESS',
          }),
        })
      )
    })
  })

  describe('logLogin', () => {
    it('should log user login', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogin('user-1', '192.168.1.1', 'Mozilla/5.0')

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'LOGIN',
            resource: 'session',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            result: 'SUCCESS',
          }),
        })
      )
    })

    it('should handle login without IP/user agent', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogin('user-1')

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'LOGIN',
            ipAddress: null,
            userAgent: null,
          }),
        })
      )
    })
  })

  describe('logLogout', () => {
    it('should log user logout', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.logLogout('user-1', '192.168.1.1')

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            action: 'LOGOUT',
            resource: 'session',
            ipAddress: '192.168.1.1',
            result: 'SUCCESS',
          }),
        })
      )
    })
  })

  describe('hash chain integrity', () => {
    it('should compute deterministic hash for same data', () => {
      const entry = {
        id: 'test-id',
        userId: 'user-1',
        action: 'TEST',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
      }

      const hash1 = computeEntryHash(entry, 'test-secret-key-at-least-32-characters-long')
      const hash2 = computeEntryHash(entry, 'test-secret-key-at-least-32-characters-long')

      expect(hash1).toBe(hash2)
      expect(hash1.length).toBe(64)
    })

    it('should produce different hash when data changes', () => {
      const baseEntry = {
        id: 'test-id',
        userId: 'user-1',
        action: 'TEST',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
      }

      const hash1 = computeEntryHash(baseEntry, 'test-secret-key-at-least-32-characters-long')

      const modifiedEntry = { ...baseEntry, action: 'MODIFIED' }
      const hash2 = computeEntryHash(modifiedEntry, 'test-secret-key-at-least-32-characters-long')

      expect(hash1).not.toBe(hash2)
    })

    it('should produce different hash when previousHash changes', () => {
      const entry = {
        id: 'test-id',
        userId: 'user-1',
        action: 'TEST',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
      }

      const hash1 = computeEntryHash(entry, 'test-secret-key-at-least-32-characters-long')

      const chainedEntry = { ...entry, previousHash: 'abc123' }
      const hash2 = computeEntryHash(chainedEntry, 'test-secret-key-at-least-32-characters-long')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('verifyIntegrity', () => {
    it('should return valid for unmodified entries', async () => {
      const secret = 'test-audit-hash-secret-for-testing-min-32-chars'
      process.env.AUDIT_HASH_SECRET = secret

      const entry = {
        id: 'entry-1',
        userId: 'user-1',
        action: 'TEST',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
      }

      const correctHash = computeEntryHash(entry, secret)

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        { ...entry, contentHash: correctHash },
      ] as any)

      const result = await auditLogger.verifyIntegrity()

      expect(result.valid).toBe(true)
      expect(result.totalEntries).toBe(1)
      expect(result.brokenEntries).toHaveLength(0)
    })

    it('should detect tampered entries', async () => {
      const secret = 'test-audit-hash-secret-for-testing-min-32-chars'
      process.env.AUDIT_HASH_SECRET = secret

      const entry = {
        id: 'entry-1',
        userId: 'user-1',
        action: 'TAMPERED_ACTION',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
        contentHash: 'old-hash-from-original-data',
      }

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([entry] as any)

      const result = await auditLogger.verifyIntegrity()

      expect(result.valid).toBe(false)
      expect(result.totalEntries).toBe(1)
      expect(result.brokenEntries).toHaveLength(1)
      expect(result.brokenEntries[0].id).toBe('entry-1')
      expect(result.brokenEntries[0].index).toBe(0)
    })

    it('should return valid for empty log', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([])

      const result = await auditLogger.verifyIntegrity()

      expect(result.valid).toBe(true)
      expect(result.totalEntries).toBe(0)
      expect(result.brokenEntries).toHaveLength(0)
    })

    it('should detect multiple tampered entries', async () => {
      const secret = 'test-audit-hash-secret-for-testing-min-32-chars'
      process.env.AUDIT_HASH_SECRET = secret

      const entry1 = {
        id: 'entry-1',
        userId: null,
        action: 'A',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:00:00Z'),
        previousHash: null,
      }

      const entry2 = {
        id: 'entry-2',
        userId: null,
        action: 'B',
        resource: 'test',
        resourceId: null,
        ipAddress: null,
        userAgent: null,
        details: null,
        result: 'SUCCESS',
        createdAt: new Date('2025-01-01T00:01:00Z'),
        previousHash: null,
      }

      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
        { ...entry1, contentHash: 'tampered-1' },
        { ...entry2, contentHash: 'tampered-2' },
      ] as any)

      const result = await auditLogger.verifyIntegrity()

      expect(result.valid).toBe(false)
      expect(result.brokenEntries).toHaveLength(2)
    })
  })

  describe('robustness', () => {
    it('should handle null values in details', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any)

      await auditLogger.log({
        action: 'TEST',
        resource: 'test',
        result: 'SUCCESS',
        details: { value: null, nested: { key: null } },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: JSON.stringify({ value: null, nested: { key: null } }),
          }),
        })
      )
    })

    it('should handle very large details object', async () => {
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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
      vi.mocked(prisma.auditLog.findFirst).mockResolvedValue(null)
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
