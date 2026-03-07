import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  AIConversionAdvisor,
  aiConversionAdvisor,
} from '@/services/conversion/ai-conversion-advisor'
import { aiResponseParser } from '@/lib/conversion/ai-response-parser'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    conversionProject: {
      findUnique: vi.fn(),
    },
    conversionResult: {
      findFirst: vi.fn(),
    },
    chartOfAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/integrations/ai', () => ({
  createAIProviderFromEnv: vi.fn(() => null),
}))

const mockSourceAccounts = [
  {
    id: 'source-1',
    code: '1000',
    name: '現金',
    nameEn: 'Cash',
    standard: 'JGAAP' as const,
    category: 'current_asset' as const,
    normalBalance: 'debit' as const,
    level: 0,
    isConvertible: true,
  },
  {
    id: 'source-2',
    code: '1100',
    name: '普通預金',
    nameEn: 'Ordinary Deposits',
    standard: 'JGAAP' as const,
    category: 'current_asset' as const,
    normalBalance: 'debit' as const,
    level: 0,
    isConvertible: true,
  },
]

const mockTargetCoa = {
  id: 'target-coa-1',
  companyId: 'company-1',
  standard: 'USGAAP' as const,
  name: 'USGAAP COA',
  items: [
    {
      id: 'target-1',
      code: '1100',
      name: 'Cash and Cash Equivalents',
      nameEn: 'Cash and Cash Equivalents',
      standard: 'USGAAP' as const,
      category: 'current_asset' as const,
      normalBalance: 'debit' as const,
      level: 0,
      isConvertible: true,
    },
    {
      id: 'target-2',
      code: '1200',
      name: 'Accounts Receivable',
      nameEn: 'Accounts Receivable',
      standard: 'USGAAP' as const,
      category: 'current_asset' as const,
      normalBalance: 'debit' as const,
      level: 0,
      isConvertible: true,
    },
  ],
  version: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockProject = {
  id: 'project-1',
  companyId: 'company-1',
  name: 'Test Project',
  sourceStandard: 'JGAAP',
  targetStandard: 'USGAAP',
  targetCoaId: 'target-coa-1',
  periodStart: new Date('2024-01-01'),
  periodEnd: new Date('2024-12-31'),
  status: 'mapping',
  progress: 50,
  settings: {},
  statistics: {
    totalAccounts: 100,
    mappedAccounts: 80,
    reviewRequiredCount: 5,
    totalJournals: 1000,
    convertedJournals: 800,
    adjustingEntryCount: 10,
    averageConfidence: 0.85,
  },
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockConversionResult = {
  id: 'result-1',
  projectId: 'project-1',
  conversionDate: new Date(),
  conversionDurationMs: 5000,
  warnings: [],
  errors: [],
  balanceSheet: {
    asOfDate: new Date('2024-12-31'),
    assets: [{ code: '1100', name: 'Cash', nameEn: 'Cash', amount: 1000000 }],
    liabilities: [],
    equity: [
      { code: '3000', name: 'Retained Earnings', nameEn: 'Retained Earnings', amount: 1000000 },
    ],
    totalAssets: 1000000,
    totalLiabilities: 0,
    totalEquity: 1000000,
  },
  profitLoss: {
    periodStart: new Date('2024-01-01'),
    periodEnd: new Date('2024-12-31'),
    revenue: [{ code: '4000', name: 'Sales', nameEn: 'Sales', amount: 5000000 }],
    costOfSales: [],
    sgaExpenses: [],
    nonOperatingIncome: [],
    nonOperatingExpenses: [],
    grossProfit: 5000000,
    operatingIncome: 3000000,
    ordinaryIncome: 3000000,
    incomeBeforeTax: 2500000,
    netIncome: 2000000,
  },
}

describe('AIConversionAdvisor', () => {
  let advisor: AIConversionAdvisor

  beforeEach(() => {
    vi.clearAllMocks()
    advisor = new AIConversionAdvisor()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('suggestMappings', () => {
    it('should return mapping suggestions in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      const suggestions = await mockAdvisor.suggestMappings(
        mockSourceAccounts,
        mockTargetCoa as any,
        'USGAAP'
      )

      expect(suggestions).toBeDefined()
      expect(Array.isArray(suggestions)).toBe(true)
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0]).toHaveProperty('sourceAccountCode')
      expect(suggestions[0]).toHaveProperty('suggestedTargetCode')
      expect(suggestions[0]).toHaveProperty('confidence')
      expect(suggestions[0]).toHaveProperty('reasoning')

      process.env.AI_MOCK_MODE = originalEnv
    })

    it('should handle empty source accounts', async () => {
      const suggestions = await advisor.suggestMappings([], mockTargetCoa as any, 'USGAAP')
      expect(suggestions).toEqual([])
    })

    it('should chunk large account lists', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      const largeSourceAccounts = Array.from({ length: 100 }, (_, i) => ({
        id: `source-${i}`,
        code: `${1000 + i}`,
        name: `Account ${i}`,
        nameEn: `Account ${i}`,
        standard: 'JGAAP' as const,
        category: 'current_asset' as const,
        normalBalance: 'debit' as const,
        level: 0,
        isConvertible: true,
      }))

      const suggestions = await mockAdvisor.suggestMappings(
        largeSourceAccounts,
        mockTargetCoa as any,
        'USGAAP'
      )

      expect(suggestions).toBeDefined()
      expect(Array.isArray(suggestions)).toBe(true)

      process.env.AI_MOCK_MODE = originalEnv
    })
  })

  describe('suggestAdjustments', () => {
    it('should return adjustment recommendations in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      const sourceData = {
        balanceSheet: mockConversionResult.balanceSheet!,
        profitLoss: mockConversionResult.profitLoss!,
      }

      const recommendations = await mockAdvisor.suggestAdjustments(sourceData, 'USGAAP')

      expect(recommendations).toBeDefined()
      expect(Array.isArray(recommendations)).toBe(true)
      expect(recommendations.length).toBeGreaterThan(0)
      expect(recommendations[0]).toHaveProperty('type')
      expect(recommendations[0]).toHaveProperty('priority')
      expect(recommendations[0]).toHaveProperty('title')
      expect(recommendations[0]).toHaveProperty('estimatedImpact')

      process.env.AI_MOCK_MODE = originalEnv
    })

    it('should identify major GAAP differences', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      const sourceData = {
        balanceSheet: mockConversionResult.balanceSheet!,
        profitLoss: mockConversionResult.profitLoss!,
      }

      const recommendations = await mockAdvisor.suggestAdjustments(sourceData, 'IFRS')

      expect(recommendations.some((r) => r.type === 'lease_classification')).toBe(true)

      process.env.AI_MOCK_MODE = originalEnv
    })
  })

  describe('assessRisks', () => {
    it('should return risk assessments in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      const risks = await mockAdvisor.assessRisks(mockProject as any, mockConversionResult as any)

      expect(risks).toBeDefined()
      expect(Array.isArray(risks)).toBe(true)
      expect(risks.length).toBeGreaterThan(0)
      expect(risks[0]).toHaveProperty('category')
      expect(risks[0]).toHaveProperty('riskLevel')
      expect(risks[0]).toHaveProperty('description')
      expect(risks[0]).toHaveProperty('mitigationSuggestion')

      process.env.AI_MOCK_MODE = originalEnv
    })
  })

  describe('reviewQuality', () => {
    it('should calculate quality scores in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)

      const review = await mockAdvisor.reviewQuality(mockConversionResult as any)

      expect(review).toBeDefined()
      expect(review.overallScore).toBeGreaterThanOrEqual(0)
      expect(review.overallScore).toBeLessThanOrEqual(100)
      expect(review.categories).toHaveProperty('completeness')
      expect(review.categories).toHaveProperty('accuracy')
      expect(review.categories).toHaveProperty('compliance')
      expect(review.categories).toHaveProperty('documentation')

      process.env.AI_MOCK_MODE = originalEnv
    })

    it('should identify issues by severity', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)

      const review = await mockAdvisor.reviewQuality(mockConversionResult as any)

      expect(review.issues).toBeDefined()
      expect(Array.isArray(review.issues)).toBe(true)

      if (review.issues.length > 0) {
        expect(['critical', 'high', 'medium', 'low']).toContain(review.issues[0].severity)
      }

      process.env.AI_MOCK_MODE = originalEnv
    })
  })

  describe('generateDisclosures', () => {
    it('should generate disclosure notes in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      vi.mocked(prisma.conversionResult.findFirst).mockResolvedValue(mockConversionResult as any)

      const disclosures = await mockAdvisor.generateDisclosures('project-1', 'USGAAP')

      expect(disclosures).toBeDefined()
      expect(Array.isArray(disclosures)).toBe(true)
      expect(disclosures.length).toBeGreaterThan(0)
      expect(disclosures[0]).toHaveProperty('id')
      expect(disclosures[0]).toHaveProperty('category')
      expect(disclosures[0]).toHaveProperty('title')
      expect(disclosures[0]).toHaveProperty('content')
      expect(disclosures[0]).toHaveProperty('standardReference')
      expect(disclosures[0]).toHaveProperty('isGenerated', true)

      process.env.AI_MOCK_MODE = originalEnv
    })
  })

  describe('analyzeConversion', () => {
    it('should return comprehensive analysis in mock mode', async () => {
      const originalEnv = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const mockAdvisor = new AIConversionAdvisor()

      vi.mocked(prisma.conversionProject.findUnique).mockResolvedValue(mockProject as any)
      vi.mocked(prisma.conversionResult.findFirst).mockResolvedValue(mockConversionResult as any)
      vi.mocked(prisma.chartOfAccount.findFirst).mockResolvedValue({
        id: 'source-coa-1',
        items: mockSourceAccounts,
      } as any)
      vi.mocked(prisma.chartOfAccount.findUnique).mockResolvedValue(mockTargetCoa as any)

      const analysis = await mockAdvisor.analyzeConversion('project-1')

      expect(analysis).toBeDefined()
      expect(analysis.projectId).toBe('project-1')
      expect(analysis).toHaveProperty('mappingSuggestions')
      expect(analysis).toHaveProperty('adjustmentRecommendations')
      expect(analysis).toHaveProperty('riskAssessments')
      expect(analysis).toHaveProperty('qualityScore')
      expect(analysis).toHaveProperty('generatedAt')
      expect(analysis).toHaveProperty('modelUsed')

      process.env.AI_MOCK_MODE = originalEnv
    })
  })
})

describe('AIResponseParser', () => {
  describe('parseMappingSuggestions', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        suggestions: [
          {
            sourceCode: '1000',
            sourceName: '現金',
            targetCode: '1100',
            targetName: 'Cash',
            confidence: 0.95,
            reasoning: 'Direct mapping',
            alternatives: [],
          },
        ],
      })

      const result = aiResponseParser.parseMappingSuggestions(response)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0].sourceAccountCode).toBe('1000')
        expect(result.value[0].suggestedTargetCode).toBe('1100')
        expect(result.value[0].confidence).toBe(0.95)
      }
    })

    it('should handle invalid JSON', () => {
      const result = aiResponseParser.parseMappingSuggestions('not json')

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.message).toContain('No JSON object found')
      }
    })

    it('should handle missing fields', () => {
      const response = JSON.stringify({
        suggestions: [
          {
            sourceCode: '1000',
          },
        ],
      })

      const result = aiResponseParser.parseMappingSuggestions(response)

      expect(result.ok).toBe(false)
    })
  })

  describe('parseAdjustmentRecommendations', () => {
    it('should parse valid adjustment response', () => {
      const response = JSON.stringify({
        adjustments: [
          {
            type: 'lease_classification',
            priority: 'high',
            title: 'Lease Adjustment',
            description: 'Description',
            estimatedImpact: {
              assetChange: 1000,
              liabilityChange: 500,
            },
            reasoning: 'Reason',
            references: ['ASC 842'],
          },
        ],
      })

      const result = aiResponseParser.parseAdjustmentRecommendations(response)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0].type).toBe('lease_classification')
        expect(result.value[0].priority).toBe('high')
      }
    })
  })

  describe('parseRiskAssessments', () => {
    it('should parse valid risk assessment response', () => {
      const response = JSON.stringify({
        risks: [
          {
            category: 'Mapping',
            riskLevel: 'medium',
            description: 'Risk description',
            mitigationSuggestion: 'Mitigation',
          },
        ],
      })

      const result = aiResponseParser.parseRiskAssessments(response)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0].riskLevel).toBe('medium')
      }
    })
  })

  describe('parseQualityReview', () => {
    it('should parse valid quality review response', () => {
      const response = JSON.stringify({
        overallScore: 85,
        categories: {
          completeness: 90,
          accuracy: 85,
          compliance: 80,
          documentation: 85,
        },
        issues: [
          {
            severity: 'medium',
            category: 'Mapping',
            description: 'Issue',
            affectedItems: ['Item1'],
            suggestedAction: 'Action',
          },
        ],
        recommendations: ['Rec1'],
      })

      const result = aiResponseParser.parseQualityReview(response)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.overallScore).toBe(85)
        expect(result.value.categories.completeness).toBe(90)
        expect(result.value.issues).toHaveLength(1)
      }
    })
  })
})

describe('aiConversionAdvisor singleton', () => {
  it('should be an instance of AIConversionAdvisor', () => {
    expect(aiConversionAdvisor).toBeInstanceOf(AIConversionAdvisor)
  })
})
