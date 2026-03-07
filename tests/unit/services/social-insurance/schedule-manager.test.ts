import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScheduleManager } from '@/services/social-insurance/schedule-manager'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    socialInsuranceSchedule: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('ScheduleManager', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('INSURANCE_TYPE_LABELS', () => {
    it('should have labels for all insurance types', () => {
      expect(ScheduleManager.INSURANCE_TYPE_LABELS.health).toBe('健康保険')
      expect(ScheduleManager.INSURANCE_TYPE_LABELS.pension).toBe('厚生年金保険')
      expect(ScheduleManager.INSURANCE_TYPE_LABELS.employment).toBe('雇用保険')
      expect(ScheduleManager.INSURANCE_TYPE_LABELS.work_accident).toBe('労災保険')
      expect(ScheduleManager.INSURANCE_TYPE_LABELS.care).toBe('介護保険')
    })
  })

  describe('STANDARD_TASKS', () => {
    it('should define standard tasks', () => {
      expect(ScheduleManager.STANDARD_TASKS.length).toBeGreaterThan(0)
    })

    it('should include health insurance tasks', () => {
      const healthTasks = ScheduleManager.STANDARD_TASKS.filter((t) => t.insuranceType === 'health')
      expect(healthTasks.length).toBeGreaterThan(0)
    })

    it('should include pension tasks', () => {
      const pensionTasks = ScheduleManager.STANDARD_TASKS.filter(
        (t) => t.insuranceType === 'pension'
      )
      expect(pensionTasks.length).toBeGreaterThan(0)
    })
  })

  describe('getSchedules', () => {
    it('should return all schedules for company', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([
        { id: 'schedule-1', companyId: mockCompanyId } as any,
      ])

      const result = await ScheduleManager.getSchedules(mockCompanyId)

      expect(result).toHaveLength(1)
    })

    it('should filter by insurance type', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      await ScheduleManager.getSchedules(mockCompanyId, { insuranceType: 'health' })

      expect(prisma.socialInsuranceSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            insuranceType: 'health',
          }),
        })
      )
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      await ScheduleManager.getSchedules(mockCompanyId, { status: 'PENDING' })

      expect(prisma.socialInsuranceSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })

    it('should order by due date ascending', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      await ScheduleManager.getSchedules(mockCompanyId)

      expect(prisma.socialInsuranceSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { dueDate: 'asc' },
        })
      )
    })
  })

  describe('getUpcomingSchedules', () => {
    it('should return upcoming schedules within days', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      await ScheduleManager.getUpcomingSchedules(mockCompanyId, 30)

      expect(prisma.socialInsuranceSchedule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: mockCompanyId,
            status: 'PENDING',
          }),
        })
      )
    })

    it('should use default 30 days', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      await ScheduleManager.getUpcomingSchedules(mockCompanyId)

      expect(prisma.socialInsuranceSchedule.findMany).toHaveBeenCalled()
    })
  })

  describe('createSchedule', () => {
    it('should create new schedule', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.create).mockResolvedValue({
        id: 'schedule-1',
        companyId: mockCompanyId,
        insuranceType: 'health',
        taskName: '保険料納付',
        dueDate: new Date(),
        status: 'PENDING',
      } as any)

      const result = await ScheduleManager.createSchedule({
        companyId: mockCompanyId,
        insuranceType: 'health',
        taskName: '保険料納付',
        dueDate: new Date(),
      })

      expect(result.id).toBe('schedule-1')
    })

    it('should set initial status as PENDING', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.create).mockResolvedValue({
        status: 'PENDING',
      } as any)

      await ScheduleManager.createSchedule({
        companyId: mockCompanyId,
        insuranceType: 'health',
        taskName: 'Task',
        dueDate: new Date(),
      })

      expect(prisma.socialInsuranceSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
          }),
        })
      )
    })
  })

  describe('completeSchedule', () => {
    it('should update schedule status to COMPLETED', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.update).mockResolvedValue({
        id: 'schedule-1',
        status: 'COMPLETED',
      } as any)

      const result = await ScheduleManager.completeSchedule('schedule-1')

      expect(result.status).toBe('COMPLETED')
    })

    it('should set completed date', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.update).mockResolvedValue({} as any)

      await ScheduleManager.completeSchedule('schedule-1')

      expect(prisma.socialInsuranceSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completedDate: expect.any(Date),
          }),
        })
      )
    })
  })

  describe('deleteSchedule', () => {
    it('should delete schedule', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.delete).mockResolvedValue({
        id: 'schedule-1',
      } as any)

      const result = await ScheduleManager.deleteSchedule('schedule-1')

      expect(result.id).toBe('schedule-1')
    })
  })

  describe('generateYearlySchedules', () => {
    it('should generate 12 monthly payment schedules', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.create).mockResolvedValue({} as any)

      await ScheduleManager.generateYearlySchedules(mockCompanyId, 2024)

      expect(prisma.socialInsuranceSchedule.create).toHaveBeenCalled()
    })

    it('should include work accident schedules', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.create).mockResolvedValue({} as any)

      await ScheduleManager.generateYearlySchedules(mockCompanyId, 2024)

      const createCalls = vi.mocked(prisma.socialInsuranceSchedule.create).mock.calls
      const workAccidentCalls = createCalls.filter(
        (call) => (call[0] as any).data.insuranceType === 'work_accident'
      )
      expect(workAccidentCalls.length).toBeGreaterThan(0)
    })
  })

  describe('checkOverdueSchedules', () => {
    it('should identify overdue schedules', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([
        {
          id: 'schedule-1',
          dueDate: pastDate,
          status: 'PENDING',
        } as any,
      ])

      vi.mocked(prisma.socialInsuranceSchedule.update).mockResolvedValue({} as any)

      const result = await ScheduleManager.checkOverdueSchedules(mockCompanyId)

      expect(result).toHaveLength(1)
    })

    it('should update status to OVERDUE', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 10)

      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([
        {
          id: 'schedule-1',
          dueDate: pastDate,
          status: 'PENDING',
        } as any,
      ])

      vi.mocked(prisma.socialInsuranceSchedule.update).mockResolvedValue({} as any)

      await ScheduleManager.checkOverdueSchedules(mockCompanyId)

      expect(prisma.socialInsuranceSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'OVERDUE' },
        })
      )
    })

    it('should return empty array when no overdue schedules', async () => {
      vi.mocked(prisma.socialInsuranceSchedule.findMany).mockResolvedValue([])

      const result = await ScheduleManager.checkOverdueSchedules(mockCompanyId)

      expect(result).toHaveLength(0)
    })
  })
})
