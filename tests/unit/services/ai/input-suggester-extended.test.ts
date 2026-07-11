import { InputSuggester } from '@/services/ai/input-suggester'
import type { InputFieldDefinition, InputSuggestionContext } from '@/lib/ai/input-suggestion/types'

function field(key: string, overrides: Partial<InputFieldDefinition> = {}): InputFieldDefinition {
  return { key, type: 'number', label: key, labelEn: key, required: true, ...overrides }
}

function context(overrides: Partial<InputSuggestionContext> = {}): InputSuggestionContext {
  return {
    analysisType: 'valuation',
    companyInfo: { name: 'Test Corp', industry: 'Technology', sector: 'Software' },
    ...overrides,
  }
}

describe('InputSuggester — extended rule-based paths', () => {
  let suggester: InputSuggester

  beforeEach(() => {
    suggester = new InputSuggester()
  })

  describe('peer-data clamping and filtering', () => {
    it('clamps a peer average that overflows the field max', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [
            { name: 'A', per: 60 },
            { name: 'B', per: 60 },
          ],
        })
      )
      // avg 60, per range [5, 50] -> clamped to 50
      expect(result.suggestedValue).toBe(50)
      expect(result.range).toEqual({ min: 5, max: 50 })
      expect(result.confidence).toBe(75)
    })

    it('clamps a peer average that underflows the field min', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [
            { name: 'A', per: 1 },
            { name: 'B', per: 2 },
          ],
        })
      )
      // avg 1.5, per range [5, 50] -> clamped to 5
      expect(result.suggestedValue).toBe(5)
    })

    it('ignores non-positive peer values when averaging', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [
            { name: 'A', per: 20 },
            { name: 'B', per: 0 },
            { name: 'C', per: 30 },
          ],
        })
      )
      // only 20 and 30 count -> avg 25
      expect(result.suggestedValue).toBe(25)
    })

    it('falls back to the default when no positive peer values exist', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [{ name: 'A', per: 0 }],
        })
      )
      expect(result.suggestedValue).toBe(15)
    })

    it('maps the evEbitda peer field and keeps confidence at 75', async () => {
      const result = await suggester.suggestInput(
        field('evEbitda'),
        context({
          peerData: [
            { name: 'A', evEbitda: 8 },
            { name: 'B', evEbitda: 12 },
          ],
        })
      )
      expect(result.suggestedValue).toBe(10)
      expect(result.confidence).toBe(75)
    })

    it('maps the beta peer field', async () => {
      const result = await suggester.suggestInput(
        field('beta'),
        context({
          peerData: [
            { name: 'A', beta: 1.2 },
            { name: 'B', beta: 1.4 },
          ],
        })
      )
      expect(result.suggestedValue).toBeCloseTo(1.3, 5)
    })
  })

  describe('industry-benchmark adjustment', () => {
    it('overrides the peer average with the benchmark value', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [
            { name: 'A', per: 20 },
            { name: 'B', per: 30 },
          ],
          industryBenchmark: { avgPer: 18 },
        })
      )
      // peer avg 25, but benchmark avgPer 18 wins
      expect(result.suggestedValue).toBe(18)
    })

    it('clamps an overflowing benchmark value to the field max', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({ industryBenchmark: { avgPer: 100 } })
      )
      expect(result.suggestedValue).toBe(50)
    })

    it('maps the growthRate benchmark field via avgGrowthRate', async () => {
      const result = await suggester.suggestInput(
        field('growthRate'),
        context({ industryBenchmark: { avgGrowthRate: 0.08 } })
      )
      // growthRate has no peer mapping; benchmark avgGrowthRate 0.08 -> clamp(-0.2, 0.5) = 0.08
      expect(result.suggestedValue).toBeCloseTo(0.08, 5)
      expect(result.confidence).toBe(60)
    })
  })

  describe('reasoning text', () => {
    it('composes label, percent, and source label for a percentage field', async () => {
      const result = await suggester.suggestInput(field('growthRate'), context())
      // value 0.05 -> 5.0%; growthRate label 成長率; industry_average source 業界平均値に基づく
      expect(result.reasoning).toBe('成長率の推奨値は5.0%です（業界平均値に基づく）。')
    })

    it('appends the peer-count sentence when peer data is referenced', async () => {
      const result = await suggester.suggestInput(
        field('per'),
        context({
          peerData: [
            { name: 'A', per: 20 },
            { name: 'B', per: 30 },
          ],
        })
      )
      expect(result.reasoning).toContain('2社の類似企業データを参照しました。')
    })
  })

  describe('unknown-field fallback', () => {
    it('derives min/max from a numeric defaultValue', async () => {
      const result = await suggester.suggestInput(
        field('customField', { defaultValue: 42 }),
        context()
      )
      expect(result.suggestedValue).toBe(42)
      expect(result.range).toEqual({ min: 21, max: 63 })
      expect(result.confidence).toBe(30)
      expect(result.source).toBe('ai_estimate')
      expect(result.reasoning).toBe('Default value from field definition')
    })

    it('produces a 0/0 range when no defaultValue is present', async () => {
      const result = await suggester.suggestInput(field('unknownKey'), context())
      expect(result.suggestedValue).toBe(0)
      expect(result.range).toEqual({ min: 0, max: 0 })
    })
  })
})
