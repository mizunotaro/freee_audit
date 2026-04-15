/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    journal: { findMany: vi.fn().mockResolvedValue([]) },
    monthlyBalance: { findMany: vi.fn().mockResolvedValue([]) },
    taxSchedule: { findMany: vi.fn().mockResolvedValue([]) },
    subsidyProject: { findMany: vi.fn().mockResolvedValue([]) },
    procurementCase: { findMany: vi.fn().mockResolvedValue([]) },
    shareholderRecord: { findMany: vi.fn().mockResolvedValue([]) },
    budgetPlan: { findMany: vi.fn().mockResolvedValue([]) },
    backupRecord: {
      create: vi.fn().mockResolvedValue({ id: 'bk-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn().mockReturnValue({ size: 1024 }),
  }
})

import { createDatabaseBackup, getBackupHistory, exportData } from '@/services/backup'

describe('Backup Service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createDatabaseBackup', () => {
    it('should create a full backup', async () => {
      const result = await createDatabaseBackup({
        backupType: 'full',
        destination: 'local',
        outputDir: '/tmp/test-backups',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.fileName).toContain('backup_full_')
        expect(result.data.destination).toBe('local')
      }
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should create a company-scoped backup', async () => {
      const result = await createDatabaseBackup({
        companyId: 'comp-1',
        backupType: 'database',
        destination: 'local',
        outputDir: '/tmp/test-backups',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getBackupHistory', () => {
    it('should return history', async () => {
      const result = await getBackupHistory()
      expect(result.success).toBe(true)
    })
  })

  describe('exportData', () => {
    it('should export tables as JSON', async () => {
      const result = await exportData({
        companyId: 'comp-1',
        format: 'json',
        tables: ['journals', 'monthlyBalances'],
        outputDir: '/tmp/test-exports',
      })

      expect(result.success).toBe(true)
    })

    it('should reject missing companyId', async () => {
      const result = await exportData({
        companyId: '',
        format: 'json',
        tables: ['journals'],
      })
      expect(result.success).toBe(false)
    })
  })
})
