import { ImportAdvisor, importAdvisor } from '@/services/import/ai/import-advisor'
import type { ImportAdvisorContext } from '@/services/import/ai/types'

vi.mock('@/lib/integrations/ai/factory', () => ({
  createAIProviderFromEnv: vi.fn(),
}))

import { createAIProviderFromEnv } from '@/lib/integrations/ai/factory'

const baseContext: ImportAdvisorContext = {
  importType: 'journal',
  totalRows: 100,
  errorCount: 0,
  warningCount: 0,
  language: 'ja',
}

describe('ImportAdvisor', () => {
  let advisor: ImportAdvisor

  beforeEach(() => {
    advisor = new ImportAdvisor()
    vi.mocked(createAIProviderFromEnv).mockReset()
  })

  describe('getAdvice', () => {
    it('returns fallback advice when no provider', async () => {
      vi.mocked(createAIProviderFromEnv).mockReturnValueOnce(null as any)

      const result = await advisor.getAdvice(baseContext)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.advice.length).toBeGreaterThan(0)
        expect(result.data.persona).toBe('cpa')
        expect(result.data.confidence).toBeGreaterThan(0)
      }
    })

    it('returns fallback advice with warnings', async () => {
      vi.mocked(createAIProviderFromEnv).mockReturnValueOnce(null as any)

      const contextWithWarnings: ImportAdvisorContext = {
        ...baseContext,
        errorCount: 5,
        warningCount: 10,
      }

      const result = await advisor.getAdvice(contextWithWarnings)
      expect(result.success).toBe(true)
      if (result.success) {
        const types = result.data.advice.map((a) => a.type)
        expect(types).toContain('warning')
        expect(types).toContain('suggestion')
        expect(types).toContain('best_practice')
      }
    })

    it('falls back when AI provider throws', async () => {
      const mockProvider = {
        generate: vi.fn().mockRejectedValue(new Error('AI error')),
      }
      vi.mocked(createAIProviderFromEnv).mockReturnValueOnce(mockProvider as any)

      const result = await advisor.getAdvice(baseContext)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.advice.length).toBeGreaterThan(0)
      }
    })

    it('returns error on unexpected failure', async () => {
      vi.mocked(createAIProviderFromEnv).mockImplementation(() => {
        throw new Error('Config error')
      })

      const result = await advisor.getAdvice(baseContext)
      expect(result.success).toBe(false)
    })
  })

  describe('confidence calculation', () => {
    it('increases confidence for clean data', async () => {
      vi.mocked(createAIProviderFromEnv).mockReturnValueOnce(null as any)

      const result = await advisor.getAdvice({ ...baseContext, totalRows: 200, errorCount: 0 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.confidence).toBeGreaterThanOrEqual(80)
    })

    it('increases confidence with issues provided', async () => {
      vi.mocked(createAIProviderFromEnv).mockReturnValueOnce(null as any)

      const result = await advisor.getAdvice({
        ...baseContext,
        issues: [
          {
            id: '1',
            row: 0,
            type: 'duplicate_entry',
            severity: 'medium',
            category: 'completeness',
            message: 'dup',
            messageJa: '重複',
          },
        ],
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.confidence).toBeGreaterThanOrEqual(80)
    })
  })

  describe('importAdvisor instance', () => {
    it('is an ImportAdvisor instance', () => {
      expect(importAdvisor).toBeInstanceOf(ImportAdvisor)
    })
  })
})
