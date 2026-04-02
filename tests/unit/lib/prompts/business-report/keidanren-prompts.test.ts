import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  KEIDANREN_PROMPT_TEMPLATES,
  buildSectionPrompt,
  getSectionTitle,
  type BusinessReportSectionType,
} from '@/lib/prompts/business-report/keidanren-prompts'
import type { GenerationContext } from '@/types/reports/business'

describe('Keidanren Prompts', () => {
  const allSectionTypes: BusinessReportSectionType[] = [
    'companyStatus.businessDescription',
    'companyStatus.businessPerformance',
    'companyStatus.productionOrders',
    'companyStatus.financialSummary',
    'companyStatus.riskManagement',
    'shares.totalShares',
    'shares.shareholdingStructure',
    'shares.majorShareholders',
    'stockOptions.stockAcquisitionRights',
    'officers.directors',
    'officers.auditors',
    'officers.compensation',
    'officers.boardMeetings',
    'auditor.info',
    'auditor.opinion',
    'internalControl.basicPolicy',
    'internalControl.organizationalStructure',
    'internalControl.compliance',
    'controlPolicy.policy',
    'subsidiary.info',
    'relatedPartyTransactions.info',
    'importantMatters.subsequentEvents',
    'importantMatters.litigation',
  ]

  describe('KEIDANREN_PROMPT_TEMPLATES', function () {
    it('should have templates for all section types', function () {
      for (const type of allSectionTypes) {
        expect(KEIDANREN_PROMPT_TEMPLATES[type]).toBeDefined()
        expect(KEIDANREN_PROMPT_TEMPLATES[type].systemPrompt).toBeDefined()
        expect(KEIDANREN_PROMPT_TEMPLATES[type].userPromptTemplate).toBeDefined()
        expect(KEIDANREN_PROMPT_TEMPLATES[type].requiredFields).toBeDefined()
      }
    })

    it('should require companyName and fiscalYear for all sections', function () {
      for (const type of allSectionTypes) {
        expect(KEIDANREN_PROMPT_TEMPLATES[type].requiredFields).toContain('companyName')
        expect(KEIDANREN_PROMPT_TEMPLATES[type].requiredFields).toContain('fiscalYear')
      }
    })

    it('should have Japanese system prompt', function () {
      expect(
        KEIDANREN_PROMPT_TEMPLATES['companyStatus.businessDescription'].systemPrompt
      ).toContain('公認会計士')
    })
  })

  describe('buildSectionPrompt', function () {
    it('should build prompt with company name and fiscal year', function () {
      const context: GenerationContext = {
        sectionType: 'companyStatus.businessDescription',
        companyName: 'テスト株式会社',
        fiscalYear: 2025,
      }
      const result = buildSectionPrompt('companyStatus.businessDescription', context)
      expect(result.systemPrompt).toBeDefined()
      expect(result.userPrompt).toContain('テスト株式会社')
      expect(result.userPrompt).toContain('2025')
    })

    it('should include financial data summary when provided', function () {
      const context: GenerationContext = {
        sectionType: 'companyStatus.financialSummary',
        companyName: 'テスト株式会社',
        fiscalYear: 2025,
        financialData: {
          currentYearTotals: { 売上高: 1000000000 },
          previousYearTotals: { 売上高: 800000000 },
          monthlyBalances: [],
        },
      }
      const result = buildSectionPrompt('companyStatus.financialSummary', context)
      expect(result.userPrompt).toContain('1.0十億')
    })

    it('should replace template variables', function () {
      const context: GenerationContext = {
        sectionType: 'companyStatus.businessDescription',
        companyName: 'テスト株式会社',
        fiscalYear: 2025,
      }
      const result = buildSectionPrompt('companyStatus.businessDescription', context)
      expect(result.userPrompt).not.toContain('{{companyName}}')
      expect(result.userPrompt).not.toContain('{{fiscalYear}}')
    })

    it('should throw for unknown section type', function () {
      expect(function () {
        buildSectionPrompt('unknown.type' as BusinessReportSectionType, {
          sectionType: 'x',
          companyName: 'test',
          fiscalYear: 2025,
        })
      }).toThrow('Unknown section type')
    })

    it('should keep unreplaced template vars as-is', function () {
      const context: GenerationContext = {
        sectionType: 'shares.majorShareholders',
        companyName: 'test',
        fiscalYear: 2025,
      }
      const result = buildSectionPrompt('shares.majorShareholders', context)
      expect(result.userPrompt).toContain('{{shareholderData}}')
    })
  })

  describe('getSectionTitle', function () {
    it('should return correct title for known section types', function () {
      expect(getSectionTitle('companyStatus.businessDescription')).toBe('1-1 事業の内容')
      expect(getSectionTitle('officers.directors')).toBe('4-1 取締役')
      expect(getSectionTitle('importantMatters.litigation')).toBe('10-2 訴訟等')
    })

    it('should return section type for unknown', function () {
      expect(getSectionTitle('unknown.section' as BusinessReportSectionType)).toBe(
        'unknown.section'
      )
    })

    it('should return titles for all section types', function () {
      for (const type of allSectionTypes) {
        const title = getSectionTitle(type)
        expect(title).toBeDefined()
        expect(title.length).toBeGreaterThan(0)
      }
    })
  })
})
