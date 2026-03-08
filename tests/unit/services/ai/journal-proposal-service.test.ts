import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    chartOfAccount: {
      findFirst: vi.fn(),
    },
    journalProposal: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/ai/config/model-config', () => ({
  getModelConfigService: () => ({
    getConfig: vi.fn().mockResolvedValue({
      provider: 'openai',
      model: 'gpt-5-nano',
      temperature: 0.1,
      maxTokens: 1024,
    }),
  }),
}))

vi.mock('@/services/secrets/api-key-service', () => ({
  apiKeyService: {
    getAPIKey: vi.fn().mockResolvedValue({ key: 'test-api-key' }),
  },
}))

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    entries: [
                      {
                        entryDate: '2024-01-15',
                        description: 'テスト取引',
                        debitAccount: '6000',
                        debitAccountName: '旅費交通費',
                        creditAccount: '1000',
                        creditAccountName: '現金',
                        amount: 1000,
                        taxAmount: 100,
                        taxType: 'taxable_10',
                      },
                    ],
                    rationale: 'テスト理由',
                    confidence: 0.95,
                    warnings: [],
                  }),
                },
              },
            ],
          }),
        },
      }
    },
  }
})

import { prisma } from '@/lib/db'
import { JournalProposalService } from '@/services/ai/journal-proposal-service'
import type { JournalProposalInput, JournalProposalOutput } from '@/services/ai/types'
import type { OCRStructuredData } from '@/types/ocr'

const mockChartOfAccountItems = [
  {
    id: 'item-1',
    code: '1000',
    name: '現金',
    nameEn: 'Cash',
    category: 'current_asset',
    subcategory: null,
    normalBalance: 'debit' as const,
    coaId: 'coa-1',
    level: 0,
    sortOrder: 0,
    isConvertible: true,
    metadata: null,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'item-2',
    code: '6000',
    name: '旅費交通費',
    nameEn: 'Travel Expenses',
    category: 'sga_expense',
    subcategory: null,
    normalBalance: 'debit' as const,
    coaId: 'coa-1',
    level: 0,
    sortOrder: 1,
    isConvertible: true,
    metadata: null,
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const createMockOCRResult = (data: Partial<OCRStructuredData> = {}) => ({
  success: true as const,
  data: {
    rawText: 'テスト領収書',
    date: '2024-01-15',
    totalAmount: 1100,
    taxAmount: 100,
    taxRate: 0.1,
    vendor: 'テスト株式会社',
    items: [{ name: 'テスト商品', quantity: 1, amount: 1000 }],
    confidence: 0.9,
    ...data,
  },
  confidence: 0.9,
  engine: 'ndlocr' as const,
})

const createMockInput = (overrides: Partial<JournalProposalInput> = {}): JournalProposalInput => ({
  receiptId: 'receipt-1',
  companyId: 'company-1',
  userId: 'user-1',
  ocrResult: createMockOCRResult(),
  ...overrides,
})

describe('JournalProposalService', () => {
  let service: JournalProposalService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new JournalProposalService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('propose', () => {
    it('should return error for invalid input', async () => {
      const input = createMockInput({ receiptId: '' })
      const result = await service.propose(input)

      expect(result.success).toBe(false)
    })

    it('should return error when OCR result is failed', async () => {
      const input = createMockInput({
        ocrResult: {
          success: false,
          error: { code: 'OCR_FAILED', message: 'OCR processing failed' },
        },
      })
      const result = await service.propose(input)

      expect(result.success).toBe(false)
    })

    it('should generate journal proposal from OCR result', async () => {
      vi.mocked(prisma.chartOfAccount.findFirst).mockResolvedValue({
        id: 'coa-1',
        companyId: 'company-1',
        standardId: 'standard-1',
        name: '標準勘定科目表',
        description: null,
        version: 1,
        isActive: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: mockChartOfAccountItems,
      } as never)

      const input = createMockInput()
      const result = await service.propose(input)

      expect(result.success).toBe(true)
    })
  })

  describe('storeProposal', () => {
    it('should return error for invalid proposal', async () => {
      const proposal: JournalProposalOutput = {
        entries: [],
        rationale: '',
        confidence: 0.5,
        warnings: [],
        aiProvider: 'openai',
        aiModel: 'gpt-5-nano',
      }

      const result = await service.storeProposal(proposal, {
        receiptId: 'receipt-1',
        companyId: 'company-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
    })

    it('should return error when proposal already exists', async () => {
      vi.mocked(prisma.journalProposal.findUnique).mockResolvedValue({
        id: 'existing-1',
        companyId: 'company-1',
        documentId: 'receipt-1',
        userContext: '',
        proposals: '{}',
        aiProvider: 'openai',
        aiModel: 'gpt-5-nano',
        status: 'pending',
        createdBy: 'user-1',
        createdAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
      } as never)

      const proposal: JournalProposalOutput = {
        entries: [
          {
            entryDate: new Date('2024-01-15'),
            description: 'テスト',
            debitAccount: '6000',
            debitAccountName: '旅費交通費',
            creditAccount: '1000',
            creditAccountName: '現金',
            amount: 1000,
            taxAmount: 100,
          },
        ],
        rationale: 'テスト理由',
        confidence: 0.95,
        warnings: [],
        aiProvider: 'openai',
        aiModel: 'gpt-5-nano',
      }

      const result = await service.storeProposal(proposal, {
        receiptId: 'receipt-1',
        companyId: 'company-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(false)
    })

    it('should store proposal successfully', async () => {
      vi.mocked(prisma.journalProposal.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.journalProposal.create).mockResolvedValue({ id: 'proposal-1' } as never)

      const proposal: JournalProposalOutput = {
        entries: [
          {
            entryDate: new Date('2024-01-15'),
            description: 'テスト',
            debitAccount: '6000',
            debitAccountName: '旅費交通費',
            creditAccount: '1000',
            creditAccountName: '現金',
            amount: 1000,
            taxAmount: 100,
          },
        ],
        rationale: 'テスト理由',
        confidence: 0.95,
        warnings: [],
        aiProvider: 'openai',
        aiModel: 'gpt-5-nano',
      }

      const result = await service.storeProposal(proposal, {
        receiptId: 'receipt-1',
        companyId: 'company-1',
        userId: 'user-1',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('getProposals', () => {
    it('should return proposals for company', async () => {
      vi.mocked(prisma.journalProposal.findMany).mockResolvedValue([
        {
          id: 'proposal-1',
          documentId: 'receipt-1',
          proposals: JSON.stringify({
            entries: [],
            rationale: 'テスト',
            confidence: 0.9,
            warnings: [],
            aiProvider: 'openai',
            aiModel: 'gpt-5-nano',
          }),
          status: 'pending',
          createdAt: new Date(),
        },
      ] as never)

      const result = await service.getProposals('company-1')

      expect(result.success).toBe(true)
    })

    it('should apply filters correctly', async () => {
      vi.mocked(prisma.journalProposal.findMany).mockResolvedValue([])

      await service.getProposals('company-1', {
        status: 'approved',
        limit: 10,
        offset: 5,
      })

      expect(prisma.journalProposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'approved' }),
          take: 10,
          skip: 5,
        })
      )
    })
  })

  describe('updateStatus', () => {
    it('should return error when proposal not found', async () => {
      vi.mocked(prisma.journalProposal.findUnique).mockResolvedValue(null)

      const result = await service.updateStatus('proposal-1', 'approved', 'user-1')

      expect(result.success).toBe(false)
    })

    it('should update status successfully', async () => {
      vi.mocked(prisma.journalProposal.findUnique).mockResolvedValue({
        id: 'proposal-1',
        companyId: 'company-1',
        documentId: 'receipt-1',
        userContext: '',
        proposals: '{}',
        aiProvider: 'openai',
        aiModel: 'gpt-5-nano',
        status: 'pending',
        createdBy: 'user-1',
        createdAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
      } as never)
      vi.mocked(prisma.journalProposal.update).mockResolvedValue({} as never)

      const result = await service.updateStatus('proposal-1', 'approved', 'user-1')

      expect(result.success).toBe(true)
      expect(prisma.journalProposal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'proposal-1' },
          data: expect.objectContaining({
            status: 'approved',
            reviewedBy: 'user-1',
          }),
        })
      )
    })
  })
})
