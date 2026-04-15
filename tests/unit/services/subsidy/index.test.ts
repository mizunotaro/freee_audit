import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    subsidyProject: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    subsidyJournal: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    subsidyExpenditure: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'
import {
  createSubsidyProject,
  getSubsidyProjects,
  createSubsidyJournal,
  getSubsidyJournals,
} from '@/services/subsidy'

describe('Subsidy Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSubsidyProject', () => {
    it('should create a project with valid input', async () => {
      vi.mocked(prisma.subsidyProject.create).mockResolvedValue({ id: 'proj-1' } as never)

      const result = await createSubsidyProject({
        companyId: 'comp-1',
        subsidyType: 'AMED_VECO',
        projectCode: 'JP12345678',
        projectName: 'Test Project',
        programName: 'V-ECO',
        institution: 'EpiFrontier',
        piName: 'Dr. Test',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2027-03-31'),
        totalBudget: 50000000,
        subsidyRate: 2 / 3,
      })

      expect(result.success).toBe(true)
      if (result.success) expect(result.data.id).toBe('proj-1')
    })

    it('should reject missing companyId', async () => {
      const result = await createSubsidyProject({
        companyId: '',
        subsidyType: 'AMED_VECO',
        projectCode: 'JP12345678',
        projectName: 'Test',
        programName: 'V-ECO',
        institution: 'Test',
        piName: 'Dr. Test',
        startDate: new Date(),
        endDate: new Date(),
        totalBudget: 50000000,
        subsidyRate: 2 / 3,
      })

      expect(result.success).toBe(false)
    })

    it('should reject invalid subsidy rate', async () => {
      const result = await createSubsidyProject({
        companyId: 'comp-1',
        subsidyType: 'AMED_VECO',
        projectCode: 'JP12345678',
        projectName: 'Test',
        programName: 'V-ECO',
        institution: 'Test',
        piName: 'Dr. Test',
        startDate: new Date(),
        endDate: new Date(),
        totalBudget: 50000000,
        subsidyRate: 1.5,
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getSubsidyProjects', () => {
    it('should return projects', async () => {
      vi.mocked(prisma.subsidyProject.findMany).mockResolvedValue([
        { id: 'p1', projectCode: 'JP1', projectName: 'P1', subsidyType: 'AMED', status: 'active' },
      ] as never)

      const result = await getSubsidyProjects('comp-1')
      expect(result.success).toBe(true)
    })

    it('should reject empty companyId', async () => {
      const result = await getSubsidyProjects('')
      expect(result.success).toBe(false)
    })
  })

  describe('createSubsidyJournal', () => {
    it('should create a journal entry', async () => {
      vi.mocked(prisma.subsidyJournal.create).mockResolvedValue({ id: 'j-1' } as never)

      const result = await createSubsidyJournal({
        projectId: 'proj-1',
        date: new Date('2026-04-10'),
        workerName: '田中太郎',
        startTime: '09:00',
        endTime: '18:00',
        amedHours: 7,
        totalHours: 8,
        activityText: '実験データ解析作業および論文レビューを実施した',
      })

      expect(result.success).toBe(true)
    })

    it('should reject abstract activity text', async () => {
      const result = await createSubsidyJournal({
        projectId: 'proj-1',
        date: new Date(),
        workerName: '田中太郎',
        amedHours: 7,
        totalHours: 8,
        activityText: '作業',
      })

      expect(result.success).toBe(false)
    })

    it('should reject too short activity text', async () => {
      const result = await createSubsidyJournal({
        projectId: 'proj-1',
        date: new Date(),
        workerName: '田中太郎',
        amedHours: 7,
        totalHours: 8,
        activityText: 'データ整理',
      })

      expect(result.success).toBe(false)
    })

    it('should reject amedHours exceeding totalHours', async () => {
      const result = await createSubsidyJournal({
        projectId: 'proj-1',
        date: new Date(),
        workerName: '田中太郎',
        amedHours: 10,
        totalHours: 8,
        activityText: '実験データの解析と結果のまとめ作業を実施',
      })

      expect(result.success).toBe(false)
    })
  })

  describe('getSubsidyJournals', () => {
    it('should return journals for a month', async () => {
      vi.mocked(prisma.subsidyJournal.findMany).mockResolvedValue([
        {
          id: 'j-1',
          date: new Date('2026-04-10'),
          workerName: '田中太郎',
          startTime: '09:00',
          endTime: '18:00',
          excludedHours: 1,
          amedHours: 7,
          totalHours: 8,
          activityText: 'テスト作業内容の記述がここに入ります',
          confidence: 1.0,
          reviewFlags: '[]',
          status: 'draft',
        },
      ] as never)

      const result = await getSubsidyJournals({ projectId: 'proj-1', year: 2026, month: 4 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].reviewFlags).toEqual([])
      }
    })
  })
})
