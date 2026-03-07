import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyzeFinancialData, analyzeJournalEntry } from '@/services/ai/analysis-service'
import type { BalanceSheet, ProfitLoss, CashFlowStatement, FinancialKPIs } from '@/types'

vi.mock('@/integrations/freee/client', () => ({
  freeeClient: {
    getAccountItems: vi.fn(),
  },
}))

const mockBS: BalanceSheet = {
  fiscalYear: 2024,
  month: 12,
  assets: {
    current: [
      { code: '1000', name: '現金', amount: 5000000 },
      { code: '1100', name: '売掛金', amount: 3000000 },
      { code: '1200', name: '棚卸資産', amount: 2000000 },
    ],
    fixed: [{ code: '2000', name: '建物', amount: 10000000 }],
    total: 20000000,
  },
  liabilities: {
    current: [
      { code: '3000', name: '買掛金', amount: 2000000 },
      { code: '3100', name: '未払金', amount: 1000000 },
    ],
    fixed: [{ code: '4000', name: '長期借入金', amount: 5000000 }],
    total: 8000000,
  },
  equity: {
    items: [
      { code: '5000', name: '資本金', amount: 5000000 },
      { code: '5100', name: '利益剰余金', amount: 7000000 },
    ],
    total: 12000000,
  },
  totalAssets: 20000000,
  totalLiabilities: 8000000,
  totalEquity: 12000000,
}

const mockPL: ProfitLoss = {
  fiscalYear: 2024,
  month: 12,
  revenue: [{ code: 'R001', name: '売上高', amount: 10000000 }],
  costOfSales: [{ code: 'C001', name: '売上原価', amount: 6000000 }],
  grossProfit: 4000000,
  grossProfitMargin: 40,
  sgaExpenses: [
    { code: 'E001', name: '給与手当', amount: 1500000 },
    { code: 'E002', name: '広告宣伝費', amount: 500000 },
  ],
  operatingIncome: 2000000,
  operatingMargin: 20,
  nonOperatingIncome: [],
  nonOperatingExpenses: [],
  ordinaryIncome: 2000000,
  extraordinaryIncome: [],
  extraordinaryLoss: [],
  incomeBeforeTax: 2000000,
  incomeTax: 600000,
  netIncome: 1400000,
  depreciation: 300000,
}

const mockCF: CashFlowStatement = {
  fiscalYear: 2024,
  month: 12,
  operating: { items: [], netCashFromOperating: 2000000 },
  investing: { items: [], netCashFromInvesting: -500000 },
  financing: { items: [], netCashFromFinancing: -300000 },
  netChangeInCash: 1200000,
  beginningCash: 3800000,
  endingCash: 5000000,
}

const mockKPIs: FinancialKPIs = {
  fiscalYear: 2024,
  month: 12,
  profitability: {
    roe: 11.67,
    roa: 7,
    grossProfitMargin: 40,
    operatingMargin: 20,
    ros: 14,
    ebitdaMargin: 23,
  },
  efficiency: {
    assetTurnover: 0.5,
    inventoryTurnover: 3,
    receivablesTurnover: 3.33,
    payablesTurnover: 5,
  },
  safety: {
    currentRatio: 166.67,
    quickRatio: 100,
    debtToEquity: 0.67,
    equityRatio: 60,
  },
  growth: {
    revenueGrowth: 10,
    profitGrowth: 15,
  },
  cashFlow: {
    fcf: 1500000,
    fcfMargin: 15,
  },
}

describe('AIAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('analyzeFinancialData', () => {
    it('should analyze financial data with mock mode', async () => {
      const originalMockMode = process.env.AI_MOCK_MODE
      process.env.AI_MOCK_MODE = 'true'

      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
      expect(result.anomalies).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(result.insights).toBeDefined()

      process.env.AI_MOCK_MODE = originalMockMode
    })

    it('should analyze financial data with no API key', async () => {
      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
      expect(result.summary).toBeDefined()
    })

    it('should detect low current ratio as anomaly', async () => {
      const lowRatioKPIs = {
        ...mockKPIs,
        safety: { ...mockKPIs.safety, currentRatio: 80 },
      }

      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, lowRatioKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      const ratioAnomaly = result.anomalies.find((a) => a.itemName === '流動比率')
      expect(ratioAnomaly).toBeDefined()
      expect(ratioAnomaly?.severity).toBe('high')
    })

    it('should detect low operating margin as anomaly', async () => {
      const lowMarginPL = { ...mockPL, operatingMargin: 3 }

      const result = await analyzeFinancialData(mockBS, lowMarginPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      const marginAnomaly = result.anomalies.find((a) => a.itemName === '営業利益率')
      expect(marginAnomaly).toBeDefined()
      expect(marginAnomaly?.severity).toBe('medium')
    })

    it('should detect negative operating CF with positive net income', async () => {
      const negativeCF: CashFlowStatement = {
        ...mockCF,
        operating: { items: [], netCashFromOperating: -500000 },
      }

      const result = await analyzeFinancialData(mockBS, mockPL, negativeCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      const cfAnomaly = result.anomalies.find((a) => a.itemName === '営業キャッシュフロー')
      expect(cfAnomaly).toBeDefined()
      expect(cfAnomaly?.severity).toBe('high')
    })

    it('should generate recommendations for low ROE', async () => {
      const lowROEKPIs = {
        ...mockKPIs,
        profitability: { ...mockKPIs.profitability, roe: 5 },
      }

      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, lowROEKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      const roeRec = result.recommendations.find((r) => r.category === '収益性改善')
      expect(roeRec).toBeDefined()
      expect(roeRec?.priority).toBe('high')
    })

    it('should generate recommendations for low growth', async () => {
      const lowGrowthKPIs = {
        ...mockKPIs,
        growth: { ...mockKPIs.growth, revenueGrowth: 5 },
      }

      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, lowGrowthKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      const growthRec = result.recommendations.find((r) => r.category === '成長戦略')
      expect(growthRec).toBeDefined()
      expect(growthRec?.priority).toBe('medium')
    })

    it('should use custom prompt when provided', async () => {
      const customPrompt = 'カスタム分析プロンプト'

      const result = await analyzeFinancialData(
        mockBS,
        mockPL,
        mockCF,
        mockKPIs,
        { provider: 'openai', apiKey: '' },
        customPrompt
      )

      expect(result).toBeDefined()
    })

    it('should handle different providers', async () => {
      const providers = ['openai', 'gemini', 'claude'] as const

      for (const provider of providers) {
        const result = await analyzeFinancialData(mockBS, mockPL, mockCF, mockKPIs, {
          provider,
          apiKey: '',
        })
        expect(result).toBeDefined()
      }
    })

    it('should handle empty financial data', async () => {
      const emptyBS: BalanceSheet = {
        fiscalYear: 2024,
        month: 12,
        assets: { current: [], fixed: [], total: 0 },
        liabilities: { current: [], fixed: [], total: 0 },
        equity: { items: [], total: 0 },
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      }

      const result = await analyzeFinancialData(emptyBS, mockPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })
  })

  describe('analyzeJournalEntry', () => {
    const mockEntry = {
      id: 'entry-1',
      entryDate: new Date('2024-01-15'),
      description: 'テスト仕訳',
      debitAccount: '現金',
      creditAccount: '売上',
      amount: 10000,
      taxType: '課税',
    }

    it('should analyze valid journal entry', async () => {
      const result = await analyzeJournalEntry(mockEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
      expect(result.isValid).toBeDefined()
      expect(result.issues).toBeDefined()
    })

    it('should detect negative amount as error', async () => {
      const negativeEntry = { ...mockEntry, amount: -1000 }

      const result = await analyzeJournalEntry(negativeEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.isValid).toBe(false)
      expect(result.issues.some((i) => i.field === 'amount')).toBe(true)
    })

    it('should detect missing description as warning', async () => {
      const noDescEntry = { ...mockEntry, description: '' }

      const result = await analyzeJournalEntry(noDescEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.issues.some((i) => i.field === 'description')).toBe(true)
    })

    it('should detect short description as warning', async () => {
      const shortDescEntry = { ...mockEntry, description: 'a' }

      const result = await analyzeJournalEntry(shortDescEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.issues.some((i) => i.field === 'description')).toBe(true)
    })

    it('should detect missing tax type as warning', async () => {
      const noTaxEntry = { ...mockEntry, taxType: undefined }

      const result = await analyzeJournalEntry(noTaxEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.issues.some((i) => i.field === 'taxType')).toBe(true)
    })

    it('should detect future date as error', async () => {
      const futureEntry = { ...mockEntry, entryDate: new Date('2099-01-01') }

      const result = await analyzeJournalEntry(futureEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.isValid).toBe(false)
      expect(result.issues.some((i) => i.field === 'entryDate')).toBe(true)
    })

    it('should handle entry without config', async () => {
      const result = await analyzeJournalEntry(mockEntry)

      expect(result).toBeDefined()
      expect(result.isValid).toBeDefined()
    })

    it('should handle entry with receipt data', async () => {
      const receiptData = '証憑内容: テスト領収書'

      const result = await analyzeJournalEntry(mockEntry, receiptData, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })

    it('should generate suggestion when issues found', async () => {
      const invalidEntry = { ...mockEntry, amount: -1000 }

      const result = await analyzeJournalEntry(invalidEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.suggestion).toBeDefined()
    })

    it('should not generate suggestion for valid entry', async () => {
      const result = await analyzeJournalEntry(mockEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.suggestion).toBeUndefined()
    })

    it('should handle zero amount', async () => {
      const zeroEntry = { ...mockEntry, amount: 0 }

      const result = await analyzeJournalEntry(zeroEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })

    it('should handle very large amount', async () => {
      const largeEntry = { ...mockEntry, amount: 999999999999 }

      const result = await analyzeJournalEntry(largeEntry, undefined, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })
  })

  describe('edge cases', () => {
    it('should handle red figure financial data', async () => {
      const redPL: ProfitLoss = {
        ...mockPL,
        netIncome: -5000000,
        operatingIncome: -3000000,
      }

      const result = await analyzeFinancialData(mockBS, redPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result.summary).toContain('赤字')
    })

    it('should handle zero total assets', async () => {
      const zeroBS: BalanceSheet = {
        ...mockBS,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      }

      const result = await analyzeFinancialData(zeroBS, mockPL, mockCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })

    it('should handle empty KPIs', async () => {
      const emptyKPIs: FinancialKPIs = {
        fiscalYear: 2024,
        month: 12,
        profitability: {
          roe: 0,
          roa: 0,
          grossProfitMargin: 0,
          operatingMargin: 0,
          ros: 0,
          ebitdaMargin: 0,
        },
        efficiency: {
          assetTurnover: 0,
          inventoryTurnover: 0,
          receivablesTurnover: 0,
          payablesTurnover: 0,
        },
        safety: { currentRatio: 0, quickRatio: 0, debtToEquity: 0, equityRatio: 0 },
        growth: { revenueGrowth: 0, profitGrowth: 0 },
        cashFlow: { fcf: 0, fcfMargin: 0 },
      }

      const result = await analyzeFinancialData(mockBS, mockPL, mockCF, emptyKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })

    it('should handle cashflow with alternative property names', async () => {
      const altCF: CashFlowStatement = {
        ...mockCF,
        operatingActivities: { netCashFromOperating: 1000000 },
        investingActivities: { netCashFromInvesting: -500000 },
        financingActivities: { netCashFromFinancing: 0 },
      } as any

      const result = await analyzeFinancialData(mockBS, mockPL, altCF, mockKPIs, {
        provider: 'openai',
        apiKey: '',
      })

      expect(result).toBeDefined()
    })
  })
})
