import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditTrailService } from '@/services/conversion/audit-trail-service'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    conversionAuditLog: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    conversionProject: {
      findUnique: vi.fn(),
    },
  },
}))

describe('AuditTrailService', () => {
  let service: AuditTrailService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AuditTrailService()
  })

  describe('log', () => {
    it('should create an audit log entry', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        name: 'Test User',
        role: 'admin',
      } as any)

      vi.mocked(prisma.conversionAuditLog.create).mockResolvedValue({
        id: 'log-1',
        projectId: 'proj-1',
        action: 'mapping_create',
        entityType: 'account_mapping',
        entityId: 'map-1',
        oldValue: null,
        newValue: JSON.stringify({ code: '1001' }),
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        notes: null,
        createdAt: new Date('2024-01-01'),
      })

      const entry = await service.log({
        projectId: 'proj-1',
        action: 'mapping_create',
        entityType: 'account_mapping',
        entityId: 'map-1',
        newValue: { code: '1001' },
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      })

      expect(entry.id).toBe('log-1')
      expect(entry.action).toBe('mapping_create')
      expect(entry.userName).toBe('Test User')
      expect(entry.newValue).toEqual({ code: '1001' })
    })

    it('should handle missing user gracefully', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.conversionAuditLog.create).mockResolvedValue({
        id: 'log-2',
        projectId: 'proj-1',
        action: 'mapping_update',
        entityType: 'account_mapping',
        entityId: null,
        oldValue: null,
        newValue: null,
        userId: null,
        ipAddress: null,
        userAgent: null,
        notes: null,
        createdAt: new Date(),
      })

      const entry = await service.log({
        projectId: 'proj-1',
        action: 'mapping_update',
        entityType: 'account_mapping',
      })

      expect(entry.userName).toBe('Unknown')
    })

    it('should extract changed fields', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.user.findUnique).mockResolvedValue({ name: 'Test', role: 'admin' } as any)
      vi.mocked(prisma.conversionAuditLog.create).mockResolvedValue({
        id: 'log-3',
        projectId: 'proj-1',
        action: 'mapping_update',
        entityType: 'account_mapping',
        entityId: null,
        oldValue: JSON.stringify({ a: 1, b: 2 }),
        newValue: JSON.stringify({ a: 1, b: 3 }),
        userId: 'user-1',
        ipAddress: null,
        userAgent: null,
        notes: null,
        createdAt: new Date(),
      })

      const entry = await service.log({
        projectId: 'proj-1',
        action: 'mapping_update',
        entityType: 'account_mapping',
        previousValue: { a: 1, b: 2 },
        newValue: { a: 1, b: 3 },
        userId: 'user-1',
      })

      expect(entry.changedFields).toContain('b')
      expect(entry.changedFields).not.toContain('a')
    })
  })

  describe('getByProject', () => {
    it('should return paginated results', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.conversionAuditLog.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionAuditLog.findMany).mockResolvedValue([
        {
          id: 'log-1',
          projectId: 'proj-1',
          action: 'project_create',
          entityType: 'project',
          entityId: null,
          oldValue: null,
          newValue: null,
          userId: 'user-1',
          ipAddress: null,
          userAgent: null,
          notes: JSON.stringify({ userName: 'Test', userRole: 'admin' }),
          createdAt: new Date(),
        },
      ])
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', name: 'Test', role: 'admin' } as any,
      ])

      const result = await service.getByProject('proj-1')

      expect(result.data).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('generateReport', () => {
    it('should generate report with summary and timeline', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue({
        name: 'Test Project',
      } as any)
      vi.mocked(prisma.conversionAuditLog.findMany).mockResolvedValue([
        {
          id: 'log-1',
          projectId: 'proj-1',
          action: 'approval_approve',
          entityType: 'mapping',
          entityId: null,
          oldValue: null,
          newValue: null,
          userId: 'user-1',
          ipAddress: null,
          userAgent: null,
          notes: JSON.stringify({ userName: 'Test', userRole: 'admin', stage: 'final_approval' }),
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'log-2',
          projectId: 'proj-1',
          action: 'project_execute',
          entityType: 'project',
          entityId: null,
          oldValue: null,
          newValue: null,
          userId: 'user-1',
          ipAddress: null,
          userAgent: null,
          notes: null,
          createdAt: new Date('2024-01-14'),
        },
      ])
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'user-1', name: 'Test', role: 'admin' } as any,
      ])

      const report = await service.generateReport('proj-1')

      expect(report.projectName).toBe('Test Project')
      expect(report.summary.totalEntries).toBe(2)
      expect(report.summary.byAction['approval_approve']).toBe(1)
      expect(report.significantChanges.length).toBeGreaterThan(0)
    })

    it('should throw if project not found', async function () {
      const { prisma } = await import('@/lib/db')
      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(null)

      await expect(service.generateReport('bad-id')).rejects.toThrow('Project not found')
    })
  })

  describe('export', () => {
    it('should export to CSV format', async function () {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.conversionAuditLog.count).mockResolvedValue(1)
      vi.mocked(prisma.conversionAuditLog.findMany).mockResolvedValue([
        {
          id: 'log-1',
          projectId: 'proj-1',
          action: 'project_create',
          entityType: 'project',
          entityId: null,
          oldValue: null,
          newValue: null,
          userId: 'user-1',
          ipAddress: '127.0.0.1',
          notes: JSON.stringify({ userName: 'Test', userRole: 'admin' }),
          createdAt: new Date('2024-01-01'),
          userAgent: null,
        } as any,
      ])
      vi.mocked(prisma.user.findMany).mockResolvedValue([])

      const buffer = await service.export('proj-1', 'csv')

      expect(buffer).toBeInstanceOf(Buffer)
      const csv = buffer.toString('utf-8')
      expect(csv).toContain('ID')
      expect(csv).toContain('project_create')
    })

    it('should throw for unsupported formats', async function () {
      await expect(service.export('proj-1', 'pdf')).rejects.toThrow('not yet implemented')
    })
  })
})
