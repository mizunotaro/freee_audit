import { z } from 'zod'
import type {
  MappingSuggestion,
  AdjustmentRecommendation,
  RiskAssessment,
  DisclosureNote,
} from '@/types/conversion'

export interface ParseError {
  message: string
  rawResponse: string
  cause?: Error
}

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

const MappingSuggestionAlternativeSchema = z.object({
  code: z.string(),
  name: z.string(),
  confidence: z.number().min(0).max(1),
})

const MappingSuggestionItemSchema = z.object({
  sourceCode: z.string(),
  sourceName: z.string(),
  targetCode: z.string(),
  targetName: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  alternatives: z.array(MappingSuggestionAlternativeSchema).optional(),
})

const MappingSuggestionsResponseSchema = z.object({
  suggestions: z.array(MappingSuggestionItemSchema),
})

const AdjustmentImpactSchema = z.object({
  assetChange: z.number().optional(),
  liabilityChange: z.number().optional(),
  equityChange: z.number().optional(),
  netIncomeChange: z.number().optional(),
})

const AdjustmentItemSchema = z.object({
  type: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  description: z.string(),
  estimatedImpact: AdjustmentImpactSchema,
  reasoning: z.string(),
  references: z.array(z.string()),
})

const AdjustmentsResponseSchema = z.object({
  adjustments: z.array(AdjustmentItemSchema),
})

const RiskItemSchema = z.object({
  category: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  description: z.string(),
  mitigationSuggestion: z.string(),
})

const RisksResponseSchema = z.object({
  risks: z.array(RiskItemSchema),
})

const DisclosureItemSchema = z.object({
  category: z.string(),
  title: z.string(),
  titleEn: z.string(),
  content: z.string(),
  contentEn: z.string().optional(),
  standardReference: z.string(),
})

const DisclosuresResponseSchema = z.object({
  disclosures: z.array(DisclosureItemSchema),
})

const QualityIssueSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  category: z.string(),
  description: z.string(),
  affectedItems: z.array(z.string()),
  suggestedAction: z.string(),
})

const QualityCategoriesSchema = z.object({
  completeness: z.number().min(0).max(100),
  accuracy: z.number().min(0).max(100),
  compliance: z.number().min(0).max(100),
  documentation: z.number().min(0).max(100),
})

const QualityReviewResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  categories: QualityCategoriesSchema,
  issues: z.array(QualityIssueSchema),
  recommendations: z.array(z.string()),
})

export class AIResponseParser {
  extractJSON(response: string): string | null {
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    return jsonMatch ? jsonMatch[0] : null
  }

  parseJSON<T>(response: string, schema: z.ZodSchema<T>): Result<T, ParseError> {
    try {
      const jsonStr = this.extractJSON(response)
      if (!jsonStr) {
        return {
          ok: false,
          error: {
            message: 'No JSON object found in response',
            rawResponse: response,
          },
        }
      }

      const parsed = JSON.parse(jsonStr)
      const validated = schema.parse(parsed)
      return { ok: true, value: validated }
    } catch (e) {
      const error = e as Error
      return {
        ok: false,
        error: {
          message: `Failed to parse JSON: ${error.message}`,
          rawResponse: response,
          cause: error,
        },
      }
    }
  }

  parseMappingSuggestions(response: string): Result<MappingSuggestion[], ParseError> {
    const result = this.parseJSON(response, MappingSuggestionsResponseSchema)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const suggestions: MappingSuggestion[] = result.value.suggestions.map((s) => ({
      sourceAccountCode: s.sourceCode,
      sourceAccountName: s.sourceName,
      suggestedTargetCode: s.targetCode,
      suggestedTargetName: s.targetName,
      confidence: s.confidence,
      reasoning: s.reasoning,
      alternatives: (s.alternatives || []).map((a) => ({
        code: a.code,
        name: a.name,
        confidence: a.confidence,
      })),
    }))

    return { ok: true, value: suggestions }
  }

  parseAdjustmentRecommendations(response: string): Result<AdjustmentRecommendation[], ParseError> {
    const result = this.parseJSON(response, AdjustmentsResponseSchema)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const recommendations: AdjustmentRecommendation[] = result.value.adjustments.map((a) => ({
      type: a.type as AdjustmentRecommendation['type'],
      priority: a.priority,
      title: a.title,
      description: a.description,
      estimatedImpact: a.estimatedImpact,
      reasoning: a.reasoning,
      references: a.references,
    }))

    return { ok: true, value: recommendations }
  }

  parseRiskAssessments(response: string): Result<RiskAssessment[], ParseError> {
    const result = this.parseJSON(response, RisksResponseSchema)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const risks: RiskAssessment[] = result.value.risks.map((r) => ({
      category: r.category,
      riskLevel: r.riskLevel,
      description: r.description,
      mitigationSuggestion: r.mitigationSuggestion,
    }))

    return { ok: true, value: risks }
  }

  parseDisclosureNotes(
    response: string
  ): Result<Omit<DisclosureNote, 'id' | 'order' | 'isGenerated'>[], ParseError> {
    const result = this.parseJSON(response, DisclosuresResponseSchema)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const notes: Omit<DisclosureNote, 'id' | 'order' | 'isGenerated'>[] =
      result.value.disclosures.map((d) => ({
        category: d.category as DisclosureNote['category'],
        title: d.title,
        titleEn: d.titleEn,
        content: d.content,
        contentEn: d.contentEn,
        standardReference: d.standardReference,
      }))

    return { ok: true, value: notes }
  }

  parseQualityReview(response: string): Result<QualityReview, ParseError> {
    const result = this.parseJSON(response, QualityReviewResponseSchema)

    if (!result.ok) {
      return { ok: false, error: result.error }
    }

    const review: QualityReview = {
      overallScore: result.value.overallScore,
      categories: {
        completeness: result.value.categories.completeness,
        accuracy: result.value.categories.accuracy,
        compliance: result.value.categories.compliance,
        documentation: result.value.categories.documentation,
      },
      issues: result.value.issues.map((i) => ({
        severity: i.severity,
        category: i.category,
        description: i.description,
        affectedItems: i.affectedItems,
        suggestedAction: i.suggestedAction,
      })),
      recommendations: result.value.recommendations,
    }

    return { ok: true, value: review }
  }
}

export interface QualityReview {
  overallScore: number
  categories: {
    completeness: number
    accuracy: number
    compliance: number
    documentation: number
  }
  issues: QualityIssue[]
  recommendations: string[]
}

export interface QualityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  affectedItems: string[]
  suggestedAction: string
}

export const aiResponseParser = new AIResponseParser()
