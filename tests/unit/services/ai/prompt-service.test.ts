import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getPrompt,
  getPromptsByType,
  setPrompt,
  resetToDefault,
  renderPrompt,
  initializeDefaultPrompts,
  getAnalysisTypes,
  DEFAULT_PROMPTS,
} from '@/services/ai/prompt-service'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    analysisPrompt: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

describe('PromptService', () => {
  const mockPrompt = {
    id: 'prompt-1',
    companyId: 'company-1',
    analysisType: 'FINANCIAL_ANALYSIS',
    name: '財務分析',
    description: 'カスタム財務分析プロンプト',
    systemPrompt: 'カスタムシステムプロンプト',
    userPromptTemplate: 'カスタムユーザープロンプト {{variable}}',
    variables: JSON.stringify([{ name: 'variable', description: '変数', required: true }]),
    isActive: true,
    isDefault: false,
    version: 1,
    parentPromptId: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DEFAULT_PROMPTS', () => {
    it('should have all required analysis types', () => {
      const expectedTypes = [
        'FINANCIAL_ANALYSIS',
        'JOURNAL_AUDIT',
        'BUDGET_VARIANCE',
        'CASH_FLOW_FORECAST',
        'KPI_ANALYSIS',
        'BOARD_REPORT',
      ]

      expectedTypes.forEach((type) => {
        expect(DEFAULT_PROMPTS[type as keyof typeof DEFAULT_PROMPTS]).toBeDefined()
      })
    })

    it('should have required properties in each prompt', () => {
      Object.entries(DEFAULT_PROMPTS).forEach(([type, prompt]) => {
        expect(prompt.analysisType).toBe(type)
        expect(prompt.name).toBeDefined()
        expect(prompt.description).toBeDefined()
        expect(prompt.systemPrompt).toBeDefined()
        expect(prompt.userPromptTemplate).toBeDefined()
        expect(prompt.variables).toBeDefined()
        expect(Array.isArray(prompt.variables)).toBe(true)
      })
    })

    it('should have required variables for FINANCIAL_ANALYSIS', () => {
      const financialPrompt = DEFAULT_PROMPTS.FINANCIAL_ANALYSIS
      const varNames = financialPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('fiscalYear')
      expect(varNames).toContain('month')
      expect(varNames).toContain('financialData')
      expect(varNames).toContain('kpiData')
    })

    it('should have required variables for JOURNAL_AUDIT', () => {
      const journalPrompt = DEFAULT_PROMPTS.JOURNAL_AUDIT
      const varNames = journalPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('entryDate')
      expect(varNames).toContain('debitAccount')
      expect(varNames).toContain('creditAccount')
      expect(varNames).toContain('amount')
    })

    it('should have required variables for BUDGET_VARIANCE', () => {
      const budgetPrompt = DEFAULT_PROMPTS.BUDGET_VARIANCE
      const varNames = budgetPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('fiscalYear')
      expect(varNames).toContain('month')
      expect(varNames).toContain('budgetData')
      expect(varNames).toContain('significantVariances')
    })

    it('should have required variables for CASH_FLOW_FORECAST', () => {
      const cfPrompt = DEFAULT_PROMPTS.CASH_FLOW_FORECAST
      const varNames = cfPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('currentCashPosition')
      expect(varNames).toContain('historicalCashFlow')
    })

    it('should have required variables for KPI_ANALYSIS', () => {
      const kpiPrompt = DEFAULT_PROMPTS.KPI_ANALYSIS
      const varNames = kpiPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('fiscalYear')
      expect(varNames).toContain('month')
      expect(varNames).toContain('kpiData')
    })

    it('should have required variables for BOARD_REPORT', () => {
      const boardPrompt = DEFAULT_PROMPTS.BOARD_REPORT
      const varNames = boardPrompt.variables.map((v) => v.name)

      expect(varNames).toContain('fiscalYear')
      expect(varNames).toContain('month')
      expect(varNames).toContain('financialSummary')
      expect(varNames).toContain('cashPosition')
      expect(varNames).toContain('keyMetrics')
    })

    it('should mark required variables correctly', () => {
      Object.values(DEFAULT_PROMPTS).forEach((prompt) => {
        prompt.variables.forEach((v) => {
          expect(typeof v.required).toBe('boolean')
          expect(typeof v.name).toBe('string')
          expect(typeof v.description).toBe('string')
        })
      })
    })
  })

  describe('getPrompt', () => {
    it('should return custom prompt when company has one', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue(mockPrompt as any)

      const result = await getPrompt('FINANCIAL_ANALYSIS', 'company-1')

      expect(result.id).toBe('prompt-1')
      expect(result.companyId).toBe('company-1')
      expect(result.name).toBe('財務分析')
    })

    it('should return default prompt when no custom prompt exists', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue(null)

      const result = await getPrompt('FINANCIAL_ANALYSIS', 'company-1')

      expect(result.id).toBe('default')
      expect(result.companyId).toBeNull()
      expect(result.name).toBe('財務分析')
    })

    it('should return default prompt when no company specified', async () => {
      const result = await getPrompt('FINANCIAL_ANALYSIS')

      expect(result.id).toBe('default')
      expect(result.companyId).toBeNull()
    })

    it('should throw error for unknown analysis type', async () => {
      await expect(getPrompt('UNKNOWN_TYPE' as any)).rejects.toThrow('Unknown analysis type')
    })

    it('should parse variables JSON correctly', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue(mockPrompt as any)

      const result = await getPrompt('FINANCIAL_ANALYSIS', 'company-1')

      expect(Array.isArray(result.variables)).toBe(true)
      expect(result.variables[0].name).toBe('variable')
    })
  })

  describe('getPromptsByType', () => {
    it('should return prompts for company', async () => {
      vi.mocked(prisma.analysisPrompt.findMany).mockResolvedValue([mockPrompt] as any)

      const results = await getPromptsByType('FINANCIAL_ANALYSIS', 'company-1')

      expect(results).toHaveLength(1)
      expect(results[0].companyId).toBe('company-1')
    })

    it('should return empty array when no prompts found', async () => {
      vi.mocked(prisma.analysisPrompt.findMany).mockResolvedValue([])

      const results = await getPromptsByType('FINANCIAL_ANALYSIS', 'company-1')

      expect(results).toEqual([])
    })

    it('should filter by active status', async () => {
      vi.mocked(prisma.analysisPrompt.findMany).mockResolvedValue([])

      await getPromptsByType('FINANCIAL_ANALYSIS', 'company-1')

      expect(prisma.analysisPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        })
      )
    })

    it('should order by version descending', async () => {
      vi.mocked(prisma.analysisPrompt.findMany).mockResolvedValue([])

      await getPromptsByType('FINANCIAL_ANALYSIS', 'company-1')

      expect(prisma.analysisPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { version: 'desc' },
        })
      )
    })

    it('should handle null company ID', async () => {
      vi.mocked(prisma.analysisPrompt.findMany).mockResolvedValue([])

      await getPromptsByType('FINANCIAL_ANALYSIS')

      expect(prisma.analysisPrompt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: null,
          }),
        })
      )
    })
  })

  describe('setPrompt', () => {
    it('should deactivate existing prompts and create new one', async () => {
      vi.mocked(prisma.analysisPrompt.updateMany).mockResolvedValue({ count: 1 })
      vi.mocked(prisma.analysisPrompt.create).mockResolvedValue(mockPrompt as any)

      const result = await setPrompt('FINANCIAL_ANALYSIS', 'company-1', {
        name: '財務分析',
        description: 'テスト',
        systemPrompt: 'システム',
        userPromptTemplate: 'テンプレート',
        variables: [{ name: 'var1', description: '変数1', required: true }],
      })

      expect(prisma.analysisPrompt.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', analysisType: 'FINANCIAL_ANALYSIS', isActive: true },
        data: { isActive: false },
      })
      expect(prisma.analysisPrompt.create).toHaveBeenCalled()
      expect(result.name).toBe('財務分析')
    })

    it('should handle optional description', async () => {
      vi.mocked(prisma.analysisPrompt.updateMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.analysisPrompt.create).mockResolvedValue({
        ...mockPrompt,
        description: null,
      } as any)

      const result = await setPrompt('FINANCIAL_ANALYSIS', 'company-1', {
        name: '財務分析',
        systemPrompt: 'システム',
        userPromptTemplate: 'テンプレート',
        variables: [],
      })

      expect(result.description).toBeNull()
    })

    it('should set isDefault to false', async () => {
      vi.mocked(prisma.analysisPrompt.updateMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.analysisPrompt.create).mockResolvedValue(mockPrompt as any)

      await setPrompt('FINANCIAL_ANALYSIS', 'company-1', {
        name: '財務分析',
        systemPrompt: 'システム',
        userPromptTemplate: 'テンプレート',
        variables: [],
      })

      expect(prisma.analysisPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: false,
          }),
        })
      )
    })
  })

  describe('resetToDefault', () => {
    it('should deactivate all custom prompts', async () => {
      vi.mocked(prisma.analysisPrompt.updateMany).mockResolvedValue({ count: 2 })

      await resetToDefault('FINANCIAL_ANALYSIS', 'company-1')

      expect(prisma.analysisPrompt.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1', analysisType: 'FINANCIAL_ANALYSIS' },
        data: { isActive: false },
      })
    })
  })

  describe('renderPrompt', () => {
    it('should replace variables in user prompt', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: 'システムプロンプト',
        userPromptTemplate: '年度: {{fiscalYear}}, 月: {{month}}',
        variables: [
          { name: 'fiscalYear', description: '', required: true },
          { name: 'month', description: '', required: true },
        ],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, {
        fiscalYear: '2024',
        month: '12',
      })

      expect(result.userPrompt).toBe('年度: 2024, 月: 12')
      expect(result.systemPrompt).toBe('システムプロンプト')
    })

    it('should handle multiple occurrences of same variable', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: '{{year}}年{{year}}月',
        variables: [{ name: 'year', description: '', required: true }],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, { year: '2024' })

      expect(result.userPrompt).toBe('2024年2024月')
    })

    it('should handle missing variables', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: '{{fiscalYear}}年{{month}}月{{missing}}',
        variables: [
          { name: 'fiscalYear', description: '', required: true },
          { name: 'month', description: '', required: true },
        ],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, {
        fiscalYear: '2024',
        month: '12',
      })

      expect(result.userPrompt).toBe('2024年12月{{missing}}')
    })

    it('should handle special characters in variable values', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: 'データ: {{data}}',
        variables: [{ name: 'data', description: '', required: true }],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, {
        data: '<script>alert("xss")</script>',
      })

      expect(result.userPrompt).toContain('<script>alert("xss")</script>')
    })

    it('should handle multiline variable values', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: 'データ:\n{{data}}',
        variables: [{ name: 'data', description: '', required: true }],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, {
        data: '行1\n行2\n行3',
      })

      expect(result.userPrompt).toContain('行1\n行2\n行3')
    })
  })

  describe('initializeDefaultPrompts', () => {
    it('should create prompts that do not exist', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.analysisPrompt.create).mockResolvedValue({} as any)

      const count = await initializeDefaultPrompts()

      expect(count).toBe(6)
      expect(prisma.analysisPrompt.create).toHaveBeenCalledTimes(6)
    })

    it('should skip prompts that already exist', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue({} as any)

      const count = await initializeDefaultPrompts()

      expect(count).toBe(0)
      expect(prisma.analysisPrompt.create).not.toHaveBeenCalled()
    })

    it('should create prompts with isDefault true', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.analysisPrompt.create).mockResolvedValue({} as any)

      await initializeDefaultPrompts()

      expect(prisma.analysisPrompt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isDefault: true,
          }),
        })
      )
    })
  })

  describe('getAnalysisTypes', () => {
    it('should return all analysis types', () => {
      const types = getAnalysisTypes()

      expect(types).toHaveLength(6)
      expect(types.map((t) => t.type)).toContain('FINANCIAL_ANALYSIS')
      expect(types.map((t) => t.type)).toContain('JOURNAL_AUDIT')
      expect(types.map((t) => t.type)).toContain('BUDGET_VARIANCE')
      expect(types.map((t) => t.type)).toContain('CASH_FLOW_FORECAST')
      expect(types.map((t) => t.type)).toContain('KPI_ANALYSIS')
      expect(types.map((t) => t.type)).toContain('BOARD_REPORT')
    })

    it('should include name and description for each type', () => {
      const types = getAnalysisTypes()

      types.forEach((t) => {
        expect(t.name).toBeDefined()
        expect(t.description).toBeDefined()
        expect(typeof t.type).toBe('string')
        expect(typeof t.name).toBe('string')
        expect(typeof t.description).toBe('string')
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty variables array', async () => {
      vi.mocked(prisma.analysisPrompt.findFirst).mockResolvedValue({
        ...mockPrompt,
        variables: '[]',
      } as any)

      const result = await getPrompt('FINANCIAL_ANALYSIS', 'company-1')

      expect(result.variables).toEqual([])
    })

    it('should handle complex variable values', () => {
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: '{{data}}',
        variables: [{ name: 'data', description: '', required: true }],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const complexData = JSON.stringify({
        nested: { object: { with: ['array'] } },
        unicode: '日本語',
        special: '<>&"\'',
      })

      const result = renderPrompt(prompt, { data: complexData })

      expect(result.userPrompt).toContain('日本語')
    })

    it('should handle very long prompt templates', () => {
      const longTemplate = 'データ: {{data}}\n' + '行\n'.repeat(1000)
      const prompt = {
        id: 'test',
        companyId: null,
        analysisType: 'FINANCIAL_ANALYSIS' as const,
        name: 'テスト',
        description: null,
        systemPrompt: '',
        userPromptTemplate: longTemplate,
        variables: [{ name: 'data', description: '', required: true }],
        isActive: true,
        isDefault: true,
        version: 1,
        parentPromptId: null,
      }

      const result = renderPrompt(prompt, { data: 'test' })

      expect(result.userPrompt).toContain('データ: test')
    })
  })
})
