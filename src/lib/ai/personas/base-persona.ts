import type {
  PersonaConfig,
  PersonaBuildContext,
  CompiledPrompt,
  PersonaResponse,
  PersonaResult,
  PersonaType,
  ReasoningItem,
  AlternativeOption,
  RiskItem,
} from './types'

export abstract class BasePersona {
  protected readonly config: PersonaConfig

  constructor(config: PersonaConfig) {
    this.config = Object.freeze(config)
  }

  get type(): PersonaType {
    return this.config.type
  }

  get name(): string {
    return this.config.name
  }

  get temperature(): number {
    return this.config.temperatureRange.recommended
  }

  abstract buildPrompt(context: PersonaBuildContext): PersonaResult<CompiledPrompt>

  validateResponse(response: unknown): PersonaResult<PersonaResponse> {
    if (!this.isValidResponseStructure(response)) {
      return {
        success: false,
        error: {
          code: 'validation_error',
          message: 'Invalid response structure',
          details: { received: typeof response },
        },
      }
    }

    const validated = this.sanitizeResponse(response as Record<string, unknown>)
    return { success: true, data: validated }
  }

  protected isValidResponseStructure(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) {
      return false
    }

    const obj = response as Record<string, unknown>
    return (
      typeof obj.conclusion === 'string' &&
      typeof obj.confidence === 'number' &&
      Array.isArray(obj.reasoning) &&
      Array.isArray(obj.risks)
    )
  }

  protected sanitizeResponse(response: Record<string, unknown>): PersonaResponse {
    const confidence = Math.max(0, Math.min(1, Number(response.confidence) || 0.5))

    return {
      persona: this.config.type,
      conclusion: String(response.conclusion).slice(0, 2000),
      confidence: Math.round(confidence * 100) / 100,
      reasoning: this.sanitizeReasoning(response.reasoning),
      alternatives: this.sanitizeAlternatives(response.alternatives),
      risks: this.sanitizeRisks(response.risks),
      recommendedAction: response.recommendedAction
        ? String(response.recommendedAction).slice(0, 1000)
        : undefined,
      metadata: {
        modelUsed: '',
        tokensUsed: 0,
        processingTimeMs: 0,
        templateVersion: this.config.version,
      },
    }
  }

  private sanitizeReasoning(reasoning: unknown): readonly ReasoningItem[] {
    if (!Array.isArray(reasoning)) return []

    return reasoning
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .slice(0, 10)
      .map((item) => ({
        point: String(item.point || '').slice(0, 200),
        analysis: String(item.analysis || '').slice(0, 1000),
        evidence: String(item.evidence || '').slice(0, 500),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.5)),
      }))
  }

  private sanitizeAlternatives(alternatives: unknown): readonly AlternativeOption[] | undefined {
    if (!Array.isArray(alternatives)) return undefined

    return alternatives
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .slice(0, 5)
      .map((item) => ({
        option: String(item.option || '').slice(0, 200),
        pros: Array.isArray(item.pros)
          ? item.pros.map((p: unknown) => String(p).slice(0, 200)).slice(0, 5)
          : [],
        cons: Array.isArray(item.cons)
          ? item.cons.map((c: unknown) => String(c).slice(0, 200)).slice(0, 5)
          : [],
        riskLevel: ['low', 'medium', 'high'].includes(String(item.riskLevel))
          ? (item.riskLevel as 'low' | 'medium' | 'high')
          : 'medium',
      }))
  }

  private sanitizeRisks(risks: unknown): readonly RiskItem[] {
    if (!Array.isArray(risks)) return []

    return risks
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .slice(0, 10)
      .map((item) => ({
        category: String(item.category || 'general').slice(0, 100),
        description: String(item.description || '').slice(0, 500),
        severity: ['low', 'medium', 'high', 'critical'].includes(String(item.severity))
          ? (item.severity as 'low' | 'medium' | 'high' | 'critical')
          : 'medium',
        probability: Math.max(0, Math.min(1, Number(item.probability) || 0.5)),
        mitigation: item.mitigation ? String(item.mitigation).slice(0, 500) : undefined,
      }))
  }

  protected sanitizeString(input: string, maxLength: number): string {
    const controlChars = String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i), 127)
    const pattern = new RegExp(`[${controlChars}]`, 'g')
    return input.replace(pattern, '').slice(0, maxLength)
  }

  protected estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }
}
