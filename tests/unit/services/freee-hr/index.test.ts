import { describe, it, expect } from 'vitest'
import { computeEmployeeSummary, type FreeeEmployee } from '@/services/freee-hr'

const mockEmployees: FreeeEmployee[] = [
  {
    id: 1,
    num: '001',
    displayName: '田中太郎',
    entryDate: '2020-04-01',
    retireDate: null,
    birthDate: '1990-06-15',
    gender: 'male',
    email: 'tanaka@example.com',
    department: '研究開発部',
    position: '研究員',
  },
  {
    id: 2,
    num: '002',
    displayName: '鈴木花子',
    entryDate: '2022-10-01',
    retireDate: null,
    birthDate: '1995-03-20',
    gender: 'female',
    email: 'suzuki@example.com',
    department: '管理部',
    position: '経理担当',
  },
  {
    id: 3,
    num: '003',
    displayName: '佐藤一郎',
    entryDate: '2019-01-15',
    retireDate: '2025-12-31',
    birthDate: '1985-11-05',
    gender: 'male',
    email: 'sato@example.com',
    department: '研究開発部',
    position: null,
  },
]

describe('freee HR Service', () => {
  describe('computeEmployeeSummary', () => {
    const refDate = new Date('2026-04-15')

    it('should compute correct total and active counts', () => {
      const result = computeEmployeeSummary(mockEmployees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.totalCount).toBe(3)
        expect(result.data.activeCount).toBe(2)
      }
    })

    it('should compute average age correctly', () => {
      const result = computeEmployeeSummary(mockEmployees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.averageAge).toBeGreaterThan(25)
        expect(result.data.averageAge).toBeLessThan(40)
      }
    })

    it('should compute average tenure correctly', () => {
      const result = computeEmployeeSummary(mockEmployees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.averageTenureMonths).toBeGreaterThan(30)
        expect(result.data.averageTenureMonths).toBeLessThan(80)
      }
    })

    it('should compute gender distribution', () => {
      const result = computeEmployeeSummary(mockEmployees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.genderDistribution.male).toBe(1)
        expect(result.data.genderDistribution.female).toBe(1)
      }
    })

    it('should compute department distribution', () => {
      const result = computeEmployeeSummary(mockEmployees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.departmentDistribution['研究開発部']).toBe(1)
        expect(result.data.departmentDistribution['管理部']).toBe(1)
      }
    })

    it('should fail on empty array', () => {
      const result = computeEmployeeSummary([], refDate)
      expect(result.success).toBe(false)
    })

    it('should handle employees with no birth date', () => {
      const employees: FreeeEmployee[] = [{ ...mockEmployees[0], birthDate: null }]
      const result = computeEmployeeSummary(employees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.averageAge).toBeNull()
      }
    })

    it('should handle employees with no entry date', () => {
      const employees: FreeeEmployee[] = [{ ...mockEmployees[0], entryDate: null }]
      const result = computeEmployeeSummary(employees, refDate)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.averageTenureMonths).toBeNull()
      }
    })
  })
})
