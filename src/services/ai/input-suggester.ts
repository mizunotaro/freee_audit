import type {
  InputFieldDefinition,
  InputSuggestionContext,
  InputSuggestion,
  InputSuggestionResult,
} from '@/lib/ai/input-suggestion/types'
import { INPUT_SUGGESTION_CONFIG, FIELD_DEFAULTS } from '@/lib/ai/input-suggestion/constants'
import { clamp } from '@/lib/ai/input-suggestion/utils'

export class InputSuggester {
  private readonly config = INPUT_SUGGESTION_CONFIG

  async suggestInput(
    field: InputFieldDefinition,
    context: InputSuggestionContext
  ): Promise<InputSuggestion> {
    return this.getRuleBasedSuggestion(field, context)
  }

  async suggestMultiple(
    fields: InputFieldDefinition[],
    context: InputSuggestionContext
  ): Promise<InputSuggestionResult> {
    const suggestions = new Map<string, InputSuggestion>()
    const errors: Array<{ fieldKey: string; message: string }> = []

    for (const field of fields) {
      try {
        const suggestion = await this.suggestInput(field, context)
        suggestions.set(field.key, suggestion)
      } catch (error) {
        errors.push({ fieldKey: field.key, message: String(error) })
      }
    }

    return {
      success: errors.length === 0,
      suggestions,
      errors: errors.length > 0 ? errors : undefined,
      generatedAt: new Date(),
      modelUsed: 'rule-based',
    }
  }

  private getRuleBasedSuggestion(
    field: InputFieldDefinition,
    context: InputSuggestionContext
  ): InputSuggestion {
    const defaults = FIELD_DEFAULTS[field.key]

    if (defaults) {
      let adjustedValue = defaults.value

      if (context.peerData && context.peerData.length > 0) {
        const relevantField = this.getRelevantPeerField(field.key)
        if (relevantField) {
          const values = context.peerData
            .map((p) => p[relevantField as keyof typeof p] as number | undefined)
            .filter((v): v is number => v !== undefined && v > 0)
          if (values.length > 0) {
            const avg = values.reduce((a, b) => a + b, 0) / values.length
            adjustedValue = avg
          }
        }
      }

      if (context.industryBenchmark) {
        const benchmarkField = this.getRelevantBenchmarkField(field.key)
        if (
          benchmarkField &&
          context.industryBenchmark[benchmarkField as keyof typeof context.industryBenchmark]
        ) {
          adjustedValue = context.industryBenchmark[
            benchmarkField as keyof typeof context.industryBenchmark
          ] as number
        }
      }

      return {
        fieldKey: field.key,
        suggestedValue: clamp(adjustedValue, defaults.min, defaults.max),
        range: { min: defaults.min, max: defaults.max },
        reasoning: this.generateReasoning(field.key, adjustedValue, defaults.source, context),
        confidence: context.peerData && context.peerData.length > 0 ? 75 : 60,
        source: defaults.source as InputSuggestion['source'],
      }
    }

    const defaultValue = typeof field.defaultValue === 'number' ? field.defaultValue : 0
    const min = field.min ?? defaultValue * 0.5
    const max = field.max ?? defaultValue * 1.5

    return {
      fieldKey: field.key,
      suggestedValue: defaultValue,
      range: { min, max },
      reasoning: 'Default value from field definition',
      confidence: 30,
      source: 'ai_estimate',
    }
  }

  private getRelevantPeerField(fieldKey: string): string | null {
    const mapping: Record<string, string> = {
      per: 'per',
      pbr: 'pbr',
      evEbitda: 'evEbitda',
      beta: 'beta',
    }
    return mapping[fieldKey] || null
  }

  private getRelevantBenchmarkField(fieldKey: string): string | null {
    const mapping: Record<string, string> = {
      per: 'avgPer',
      pbr: 'avgPbr',
      evEbitda: 'avgEvEbitda',
      beta: 'avgBeta',
      growthRate: 'avgGrowthRate',
    }
    return mapping[fieldKey] || null
  }

  private generateReasoning(
    fieldKey: string,
    value: number,
    source: string,
    context: InputSuggestionContext
  ): string {
    const sourceLabels: Record<string, string> = {
      industry_average: '業界平均値に基づく',
      peer_data: '類似企業データに基づく',
      historical_data: '過去データに基づく',
      regulatory: '規制・ガイドラインに基づく',
      ai_estimate: 'AI推定値',
    }

    const fieldLabels: Record<string, string> = {
      growthRate: '成長率',
      discountRate: '割引率（WACC）',
      terminalGrowthRate: '永続成長率',
      riskFreeRate: 'リスクフリーレート',
      beta: 'ベータ値',
      marketRiskPremium: '市場リスクプレミアム',
      volatility: 'ボラティリティ',
      per: 'PER',
      pbr: 'PBR',
      evEbitda: 'EV/EBITDA',
      psr: 'PSR',
    }

    const label = fieldLabels[fieldKey] || fieldKey
    const sourceLabel = sourceLabels[source] || source

    let reasoning = `${label}の推奨値は${(value * 100).toFixed(1)}%です（${sourceLabel}）。`

    if (context.peerData && context.peerData.length > 0) {
      reasoning += ` ${context.peerData.length}社の類似企業データを参照しました。`
    }

    return reasoning
  }
}

let inputSuggesterInstance: InputSuggester | null = null

export function getInputSuggester(): InputSuggester {
  if (!inputSuggesterInstance) {
    inputSuggesterInstance = new InputSuggester()
  }
  return inputSuggesterInstance
}
