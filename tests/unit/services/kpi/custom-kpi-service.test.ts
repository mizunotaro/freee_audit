import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createCustomKPI,
  getCustomKPIs,
  getCustomKPIById,
  getCustomKPIByCode,
  updateCustomKPI,
  deleteCustomKPI,
  updateKPIVisibility,
  updateKPIOrder,
  initializeDefaultKPIs,
  evaluateCustomFormula,
  validateFormula,
  evaluateKPIStatus,
  evaluateTrend,
  setKPIValue,
  getKPIValue,
  getKPIValues,
  calculateAndSaveKPI,
  calculateAllFormulaKPIs,
  type CustomKPIInput,
  type CustomKPIDetail,
  type KPIEvaluationContext,
} from '@/services/kpi/custom-kpi-service'

vi.mock('@/lib/db', () => {
  const mockPrisma = {
    customKPI: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    customKPIValue: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn((promises) => Promise.all(promises.map((p: any) => p))),
  }

  return {
    prisma: mockPrisma,
    disconnectDatabase: vi.fn(),
    connectDatabase: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue(true),
  }
})

describe('CustomKPIService', () => {
  const mockCompanyId = 'test-company-id'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCustomKPI', () => {
    it('should create custom KPI with formula', async () => {
      const mockKPI = {
        id: 'kpi-1',
        companyId: mockCompanyId,
        name: 'Gross Margin',
        code: 'gross_margin',
        description: null,
        category: '収益性',
        calculationType: 'FORMULA',
        formula: '(revenue - cogs) / revenue * 100',
        dataSource: null,
        unit: '%',
        displayFormat: '0.0%',
        decimalPlaces: 1,
        isVisible: true,
        sortOrder: 1,
        targetValue: 40,
        warningThreshold: 30,
        criticalThreshold: 20,
        comparisonType: 'higher_better',
      }

      vi.mocked(prisma.customKPI.aggregate).mockResolvedValue({
        _max: { sortOrder: null },
      } as any)
      vi.mocked(prisma.customKPI.create).mockResolvedValue({
        ...mockKPI,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const input: CustomKPIInput = {
        name: 'Gross Margin',
        code: 'gross_margin',
        category: '収益性',
        calculationType: 'FORMULA',
        formula: '(revenue - cogs) / revenue * 100',
        unit: '%',
        displayFormat: '0.0%',
        decimalPlaces: 1,
        targetValue: 40,
        warningThreshold: 30,
        criticalThreshold: 20,
        comparisonType: 'higher_better',
      }

      const result = await createCustomKPI(mockCompanyId, input)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Gross Margin')
      expect(result.formula).toBe('(revenue - cogs) / revenue * 100')
      expect(prisma.customKPI.create).toHaveBeenCalled()
    })

    it('should create custom KPI with manual input', async () => {
      const mockKPI = {
        id: 'kpi-2',
        companyId: mockCompanyId,
        name: 'Customer Count',
        code: 'customer_count',
        description: null,
        category: '顧客',
        calculationType: 'MANUAL',
        formula: null,
        dataSource: null,
        unit: '人',
        displayFormat: '#,##0',
        decimalPlaces: 0,
        isVisible: true,
        sortOrder: 2,
        targetValue: 1000,
        warningThreshold: 500,
        criticalThreshold: 100,
        comparisonType: 'higher_better',
      }

      vi.mocked(prisma.customKPI.aggregate).mockResolvedValue({
        _max: { sortOrder: 1 },
      } as any)
      vi.mocked(prisma.customKPI.create).mockResolvedValue({
        ...mockKPI,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      const input: CustomKPIInput = {
        name: 'Customer Count',
        code: 'customer_count',
        category: '顧客',
        calculationType: 'MANUAL',
        unit: '人',
        displayFormat: '#,##0',
        targetValue: 1000,
        warningThreshold: 500,
        criticalThreshold: 100,
      }

      const result = await createCustomKPI(mockCompanyId, input)

      expect(result.calculationType).toBe('MANUAL')
      expect(result.formula).toBeNull()
    })

    it('should auto-increment sortOrder', async () => {
      vi.mocked(prisma.customKPI.aggregate).mockResolvedValue({
        _max: { sortOrder: 5 },
      } as any)
      vi.mocked(prisma.customKPI.create).mockResolvedValue({
        id: 'kpi-3',
        companyId: mockCompanyId,
        name: 'Test KPI',
        code: 'test_kpi',
        description: null,
        category: 'テスト',
        calculationType: 'MANUAL',
        formula: null,
        dataSource: null,
        unit: 'number',
        displayFormat: null,
        decimalPlaces: 0,
        isVisible: true,
        sortOrder: 6,
        targetValue: null,
        warningThreshold: null,
        criticalThreshold: null,
        comparisonType: 'higher_better',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      await createCustomKPI(mockCompanyId, {
        name: 'Test KPI',
        code: 'test_kpi',
        category: 'テスト',
        calculationType: 'MANUAL',
      })

      expect(prisma.customKPI.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sortOrder: 6,
          }),
        })
      )
    })
  })

  describe('getCustomKPIs', () => {
    it('should retrieve all custom KPIs for a company', async () => {
      const mockKPIs = [
        {
          id: 'kpi-1',
          companyId: mockCompanyId,
          name: 'KPI 1',
          code: 'kpi_1',
          description: null,
          category: 'Category A',
          calculationType: 'FORMULA',
          formula: 'a + b',
          dataSource: null,
          unit: 'number',
          displayFormat: null,
          decimalPlaces: 0,
          isVisible: true,
          sortOrder: 1,
          targetValue: null,
          warningThreshold: null,
          criticalThreshold: null,
          comparisonType: 'higher_better',
        },
        {
          id: 'kpi-2',
          companyId: mockCompanyId,
          name: 'KPI 2',
          code: 'kpi_2',
          description: null,
          category: 'Category B',
          calculationType: 'MANUAL',
          formula: null,
          dataSource: null,
          unit: 'number',
          displayFormat: null,
          decimalPlaces: 0,
          isVisible: false,
          sortOrder: 2,
          targetValue: null,
          warningThreshold: null,
          criticalThreshold: null,
          comparisonType: 'higher_better',
        },
      ]

      vi.mocked(prisma.customKPI.findMany).mockResolvedValue(mockKPIs as any)

      const result = await getCustomKPIs(mockCompanyId)

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('KPI 1')
      expect(result[1].name).toBe('KPI 2')
    })
  })

  describe('updateCustomKPI', () => {
    it('should update custom KPI', async () => {
      const updatedKPI = {
        id: 'kpi-1',
        companyId: mockCompanyId,
        name: 'Updated KPI',
        code: 'updated_kpi',
        description: 'Updated description',
        category: '収益性',
        calculationType: 'FORMULA',
        formula: 'a * b',
        dataSource: null,
        unit: 'number',
        displayFormat: null,
        decimalPlaces: 2,
        isVisible: true,
        sortOrder: 1,
        targetValue: 100,
        warningThreshold: 80,
        criticalThreshold: 50,
        comparisonType: 'higher_better',
      }

      vi.mocked(prisma.customKPI.update).mockResolvedValue(updatedKPI as any)

      const result = await updateCustomKPI('kpi-1', {
        name: 'Updated KPI',
        formula: 'a * b',
        decimalPlaces: 2,
      })

      expect(result.name).toBe('Updated KPI')
      expect(result.formula).toBe('a * b')
    })
  })

  describe('deleteCustomKPI', () => {
    it('should delete custom KPI', async () => {
      vi.mocked(prisma.customKPI.delete).mockResolvedValue({} as any)

      await deleteCustomKPI('kpi-1')

      expect(prisma.customKPI.delete).toHaveBeenCalledWith({
        where: { id: 'kpi-1' },
      })
    })
  })

  describe('evaluateCustomFormula', () => {
    it('should evaluate formula with data', () => {
      const context: Partial<KPIEvaluationContext> = {
        revenue: 1000000,
        gross_profit: 400000,
      }

      const result = evaluateCustomFormula('gross_profit / revenue * 100', context)

      expect(result).toBe(40)
    })

    it('should handle division by zero', () => {
      const context: Partial<KPIEvaluationContext> = {
        revenue: 0,
        gross_profit: 100000,
      }

      const result = evaluateCustomFormula('gross_profit / revenue * 100', context)

      expect(result).toBeNull()
    })

    it('should handle complex formulas', () => {
      const context: Partial<KPIEvaluationContext> = {
        current_assets: 500000,
        current_liabilities: 300000,
      }

      const result = evaluateCustomFormula('current_assets / current_liabilities * 100', context)

      expect(result).toBeCloseTo(166.67, 1)
    })

    it('should return null for invalid formulas', () => {
      const result = evaluateCustomFormula('invalid syntax ##', {})

      expect(result).toBeNull()
    })

    it('should use default values for missing variables', () => {
      const result = evaluateCustomFormula('revenue + 100', {})

      expect(result).toBe(100)
    })
  })

  describe('validateFormula', () => {
    it('should validate correct formula', () => {
      const result = validateFormula('revenue / employee_count')

      expect(result.valid).toBe(true)
    })

    it('should reject formula with unknown variables', () => {
      const result = validateFormula('unknown_var + revenue')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('不明な変数')
    })

    it('should reject formula with dangerous patterns', () => {
      const result = validateFormula('eval("code")')

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should allow Math functions', () => {
      const result = validateFormula('Math.sqrt(revenue)')

      expect(result.valid).toBe(false)
    })
  })

  describe('evaluateKPIStatus', () => {
    const createMockKPI = (overrides: Partial<CustomKPIDetail> = {}): CustomKPIDetail => ({
      id: 'kpi-1',
      companyId: 'company-1',
      name: 'Test KPI',
      code: 'test_kpi',
      description: null,
      category: 'Test',
      calculationType: 'FORMULA',
      formula: 'a + b',
      dataSource: null,
      unit: 'number',
      displayFormat: null,
      decimalPlaces: 0,
      isVisible: true,
      sortOrder: 1,
      targetValue: 100,
      warningThreshold: 80,
      criticalThreshold: 50,
      comparisonType: 'higher_better',
      ...overrides,
    })

    it('should return good for higher_better above target', () => {
      const kpi = createMockKPI()
      const status = evaluateKPIStatus(120, kpi)

      expect(status).toBe('good')
    })

    it('should return warning for higher_better below warning', () => {
      const kpi = createMockKPI()
      const status = evaluateKPIStatus(75, kpi)

      expect(status).toBe('warning')
    })

    it('should return critical for higher_better below critical', () => {
      const kpi = createMockKPI()
      const status = evaluateKPIStatus(40, kpi)

      expect(status).toBe('critical')
    })

    it('should handle lower_better correctly', () => {
      const kpi = createMockKPI({
        comparisonType: 'lower_better',
        targetValue: 20,
        warningThreshold: 40,
        criticalThreshold: 60,
      })

      expect(evaluateKPIStatus(15, kpi)).toBe('good')
      expect(evaluateKPIStatus(50, kpi)).toBe('warning')
      expect(evaluateKPIStatus(70, kpi)).toBe('critical')
    })

    it('should return good when no thresholds set', () => {
      const kpi = createMockKPI({
        targetValue: null,
        warningThreshold: null,
        criticalThreshold: null,
      })

      const status = evaluateKPIStatus(1000, kpi)

      expect(status).toBe('good')
    })
  })

  describe('evaluateTrend', () => {
    it('should return up for increase > 5%', () => {
      const trend = evaluateTrend(110, 100)

      expect(trend).toBe('up')
    })

    it('should return down for decrease > 5%', () => {
      const trend = evaluateTrend(90, 100)

      expect(trend).toBe('down')
    })

    it('should return stable for small changes', () => {
      const trend = evaluateTrend(103, 100)

      expect(trend).toBe('stable')
    })

    it('should return stable when no previous value', () => {
      const trend = evaluateTrend(100, null)

      expect(trend).toBe('stable')
    })
  })

  describe('setKPIValue', () => {
    it('should set KPI value for specific month', async () => {
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.upsert).mockResolvedValue({} as any)

      await setKPIValue('kpi-1', 2024, 6, 50000, 'Test note')

      expect(prisma.customKPIValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            customKPIId: 'kpi-1',
            fiscalYear: 2024,
            month: 6,
            value: 50000,
            notes: 'Test note',
          }),
        })
      )
    })

    it('should calculate YoY change when previous value exists', async () => {
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.findFirst).mockResolvedValue({
        id: 'prev-value',
        customKPIId: 'kpi-1',
        fiscalYear: 2024,
        month: 5,
        value: 40000,
        previousValue: null,
        yoyChange: null,
        notes: null,
        isCalculated: false,
      } as any)
      vi.mocked(prisma.customKPIValue.upsert).mockResolvedValue({} as any)

      await setKPIValue('kpi-1', 2024, 6, 50000)

      expect(prisma.customKPIValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            previousValue: 40000,
            yoyChange: 25,
          }),
        })
      )
    })
  })

  describe('getKPIValue', () => {
    it('should retrieve KPI value for specific month', async () => {
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue({
        id: 'value-1',
        customKPIId: 'kpi-1',
        fiscalYear: 2024,
        month: 6,
        value: 50000,
        previousValue: 40000,
        yoyChange: 25,
        notes: null,
        isCalculated: false,
      } as any)

      const result = await getKPIValue('kpi-1', 2024, 6)

      expect(result).not.toBeNull()
      expect(result?.value).toBe(50000)
      expect(result?.previousValue).toBe(40000)
      expect(result?.yoyChange).toBe(25)
    })

    it('should return null when no value found', async () => {
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue(null)

      const result = await getKPIValue('kpi-1', 2024, 6)

      expect(result).toBeNull()
    })
  })

  describe('getKPIValues', () => {
    it('should retrieve all KPI values for fiscal year', async () => {
      const mockValues = [
        { month: 1, value: 10000, previousValue: null, yoyChange: null },
        { month: 2, value: 11000, previousValue: 10000, yoyChange: 10 },
        { month: 3, value: 12000, previousValue: 11000, yoyChange: 9.09 },
      ]

      vi.mocked(prisma.customKPIValue.findMany).mockResolvedValue(mockValues as any)

      const result = await getKPIValues('kpi-1', 2024)

      expect(result).toHaveLength(3)
      expect(result[0].month).toBe(1)
      expect(result[2].value).toBe(12000)
    })
  })

  describe('initializeDefaultKPIs', () => {
    it('should create default KPIs when none exist', async () => {
      vi.mocked(prisma.customKPI.count).mockResolvedValue(0)
      vi.mocked(prisma.customKPI.create).mockResolvedValue({} as any)

      const count = await initializeDefaultKPIs(mockCompanyId)

      expect(count).toBe(6)
      expect(prisma.customKPI.create).toHaveBeenCalledTimes(6)
    })

    it('should skip initialization when KPIs already exist', async () => {
      vi.mocked(prisma.customKPI.count).mockResolvedValue(5)

      const count = await initializeDefaultKPIs(mockCompanyId)

      expect(count).toBe(0)
      expect(prisma.customKPI.create).not.toHaveBeenCalled()
    })
  })

  describe('updateKPIVisibility', () => {
    it('should update KPI visibility', async () => {
      vi.mocked(prisma.customKPI.update).mockResolvedValue({} as any)

      await updateKPIVisibility('kpi-1', false)

      expect(prisma.customKPI.update).toHaveBeenCalledWith({
        where: { id: 'kpi-1' },
        data: { isVisible: false },
      })
    })
  })

  describe('updateKPIOrder', () => {
    it('should update KPI order in transaction', async () => {
      vi.mocked(prisma.customKPI.update).mockResolvedValue({} as any)

      const updates = [
        { id: 'kpi-1', sortOrder: 2 },
        { id: 'kpi-2', sortOrder: 1 },
      ]

      await updateKPIOrder(updates)

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(prisma.customKPI.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('calculateAndSaveKPI', () => {
    it('should calculate and save KPI value', async () => {
      vi.mocked(prisma.customKPI.findUnique).mockResolvedValue({
        id: 'kpi-1',
        companyId: mockCompanyId,
        name: 'Gross Margin',
        code: 'gross_margin',
        description: null,
        category: '収益性',
        calculationType: 'FORMULA',
        formula: 'gross_profit / revenue * 100',
        dataSource: null,
        unit: '%',
        displayFormat: '0.0%',
        decimalPlaces: 1,
        isVisible: true,
        sortOrder: 1,
        targetValue: 40,
        warningThreshold: 30,
        criticalThreshold: 20,
        comparisonType: 'higher_better',
      } as any)
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.upsert).mockResolvedValue({} as any)

      const context: Partial<KPIEvaluationContext> = {
        revenue: 1000000,
        gross_profit: 400000,
      }

      const result = await calculateAndSaveKPI('kpi-1', 2024, 6, context)

      expect(result).toBe(40)
    })

    it('should return null for non-formula KPI', async () => {
      vi.mocked(prisma.customKPI.findUnique).mockResolvedValue({
        id: 'kpi-1',
        calculationType: 'MANUAL',
        formula: null,
      } as any)

      const result = await calculateAndSaveKPI('kpi-1', 2024, 6, {})

      expect(result).toBeNull()
    })
  })

  describe('calculateAllFormulaKPIs', () => {
    it('should calculate all formula KPIs', async () => {
      const mockKPIs = [
        {
          id: 'kpi-1',
          companyId: mockCompanyId,
          name: 'Gross Margin',
          code: 'gross_margin',
          description: null,
          category: '収益性',
          calculationType: 'FORMULA',
          formula: 'gross_profit / revenue * 100',
          dataSource: null,
          unit: '%',
          displayFormat: '0.0%',
          decimalPlaces: 1,
          isVisible: true,
          sortOrder: 1,
          targetValue: 40,
          warningThreshold: 30,
          criticalThreshold: 20,
          comparisonType: 'higher_better',
        },
      ]

      vi.mocked(prisma.customKPI.findMany).mockResolvedValue(mockKPIs as any)
      vi.mocked(prisma.customKPI.findUnique).mockResolvedValue(mockKPIs[0] as any)
      vi.mocked(prisma.customKPIValue.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.customKPIValue.upsert).mockResolvedValue({} as any)

      const context: Partial<KPIEvaluationContext> = {
        revenue: 1000000,
        gross_profit: 400000,
      }

      const results = await calculateAllFormulaKPIs(mockCompanyId, 2024, 6, context)

      expect(results).toHaveLength(1)
      expect(results[0].value).toBe(40)
      expect(results[0].name).toBe('Gross Margin')
    })
  })
})
