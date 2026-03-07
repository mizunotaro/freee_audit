import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EmployeeInsuranceTracker } from '@/services/social-insurance/employee-insurance-tracker'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
    },
  },
}))

describe('EmployeeInsuranceTracker', () => {
  const mockCompanyId = 'company-1'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ENROLLMENT_DEADLINES', () => {
    it('should have correct deadlines for each insurance type', () => {
      expect(EmployeeInsuranceTracker.ENROLLMENT_DEADLINES.health).toBe(5)
      expect(EmployeeInsuranceTracker.ENROLLMENT_DEADLINES.pension).toBe(5)
      expect(EmployeeInsuranceTracker.ENROLLMENT_DEADLINES.employment).toBe(10)
      expect(EmployeeInsuranceTracker.ENROLLMENT_DEADLINES.work_accident).toBe(0)
      expect(EmployeeInsuranceTracker.ENROLLMENT_DEADLINES.care).toBe(5)
    })
  })

  describe('getEmployeeInsuranceStatus', () => {
    it('should return insurance status for all employees', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(mockCompanyId)

      expect(statuses.length).toBe(4)
      expect(statuses[0].employeeName).toBe('山田太郎')
      expect(statuses.map((s) => s.insuranceType)).toContain('health')
      expect(statuses.map((s) => s.insuranceType)).toContain('pension')
      expect(statuses.map((s) => s.insuranceType)).toContain('employment')
      expect(statuses.map((s) => s.insuranceType)).toContain('care')
    })

    it('should return status for specific employee', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 'journal-2',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：佐藤花子',
          amount: 350000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(
        mockCompanyId,
        'emp-0'
      )

      expect(statuses.length).toBe(4)
      expect(statuses.every((s) => s.employeeId === 'emp-0')).toBe(true)
    })

    it('should return empty array for non-existent employee', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(
        mockCompanyId,
        'emp-999'
      )

      expect(statuses).toEqual([])
    })

    it('should return empty array when no journals found', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(mockCompanyId)

      expect(statuses).toEqual([])
    })

    it('should handle description without colon separator', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(mockCompanyId)

      expect(statuses[0].employeeName).toBe('Unknown')
    })
  })

  describe('checkEnrollmentDeadlines', () => {
    it('should return alerts for pending enrollments near deadline', async () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 3)

      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: recentDate,
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const alerts = await EmployeeInsuranceTracker.checkEnrollmentDeadlines(mockCompanyId)

      expect(alerts.every((a) => a.daysRemaining <= 5)).toBe(true)
    })

    it('should return empty array when no pending enrollments', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const alerts = await EmployeeInsuranceTracker.checkEnrollmentDeadlines(mockCompanyId)

      expect(alerts).toEqual([])
    })
  })

  describe('calculateTotalInsurancePremium', () => {
    it('should calculate insurance premiums based on salary', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 'journal-2',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：佐藤花子',
          amount: 400000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      const totalSalary = 700000
      expect(premiums.health).toBe(totalSalary * 0.1)
      expect(premiums.pension).toBe(totalSalary * 0.183)
      expect(premiums.employment).toBe(totalSalary * 0.0155)
      expect(premiums.work_accident).toBe(totalSalary * 0.003)
      expect(premiums.care).toBe(totalSalary * 0.018)
    })

    it('should return zero premiums when no salary data', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.health).toBe(0)
      expect(premiums.pension).toBe(0)
      expect(premiums.employment).toBe(0)
      expect(premiums.work_accident).toBe(0)
      expect(premiums.care).toBe(0)
    })

    it('should filter journals by month and year', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([])

      await EmployeeInsuranceTracker.calculateTotalInsurancePremium(mockCompanyId, 3, 2024)

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryDate: {
              gte: new Date(2024, 2, 1),
              lt: new Date(2024, 3, 1),
            },
          }),
        })
      )
    })

    it('should calculate health insurance at 10% rate', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 500000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.health).toBe(50000)
    })

    it('should calculate pension at 18.3% rate', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 500000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.pension).toBe(91500)
    })

    it('should calculate employment insurance at 1.55% rate', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 500000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.employment).toBe(7750)
    })

    it('should calculate work accident insurance at 0.3% rate', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 500000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.work_accident).toBe(1500)
    })

    it('should calculate care insurance at 1.8% rate', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 500000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const premiums = await EmployeeInsuranceTracker.calculateTotalInsurancePremium(
        mockCompanyId,
        1,
        2024
      )

      expect(premiums.care).toBe(9000)
    })
  })

  describe('insurance status', () => {
    it('should set enrollment status as enrolled', async () => {
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: new Date('2024-01-15'),
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(mockCompanyId)

      expect(statuses.every((s) => s.enrollmentStatus === 'enrolled')).toBe(true)
    })

    it('should set enrollment date same as hire date', async () => {
      const hireDate = new Date('2024-01-15')
      vi.mocked(prisma.journal.findMany).mockResolvedValue([
        {
          id: 'journal-1',
          companyId: mockCompanyId,
          entryDate: hireDate,
          description: '給与：山田太郎',
          amount: 300000,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ])

      const statuses = await EmployeeInsuranceTracker.getEmployeeInsuranceStatus(mockCompanyId)

      expect(statuses[0].enrollmentDate).toEqual(hireDate)
      expect(statuses[0].hireDate).toEqual(hireDate)
    })
  })
})
