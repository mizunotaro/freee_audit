import { PersonaResponseSchema, type PersonaResponse } from './schemas'
import type { ValidationResult } from './input-validator'

export interface OutputValidationError {
  code: string
  message: string
  details?: unknown
}

export function validatePersonaResponse(input: unknown): ValidationResult<PersonaResponse> {
  const result = PersonaResponseSchema.safeParse(input)

  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Output validation failed',
        path: result.error.errors.map((e) => e.path.join('.')).join(', '),
      },
    }
  }

  return { success: true, data: result.data }
}

const DEFAULT_RESPONSE: PersonaResponse = {
  conclusion: 'Analysis could not be completed',
  confidence: 0.5,
  reasoning: [
    {
      point: 'Validation Error',
      analysis: 'The response could not be properly validated',
      evidence: 'N/A',
      confidence: 0.5,
    },
  ],
  risks: [
    {
      category: 'General',
      description: 'Unable to complete analysis',
      severity: 'medium',
      probability: 0.5,
    },
  ],
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || isNaN(value)) return fallback
  return Math.max(min, Math.min(max, value))
}

function truncateString(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== 'string') return fallback
  return value.slice(0, maxLength)
}

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type Severity = (typeof VALID_SEVERITIES)[number]

function parseSeverity(value: unknown): Severity {
  if (typeof value === 'string' && VALID_SEVERITIES.includes(value as Severity)) {
    return value as Severity
  }
  return 'medium'
}

export function sanitizeResponse(input: unknown): PersonaResponse {
  if (typeof input !== 'object' || input === null) {
    return DEFAULT_RESPONSE
  }

  const validated = validatePersonaResponse(input)
  if (validated.success) {
    return validated.data
  }

  const obj = input as Record<string, unknown>

  return {
    conclusion: truncateString(obj.conclusion, 200, DEFAULT_RESPONSE.conclusion),
    confidence: clampNumber(obj.confidence, 0, 1, DEFAULT_RESPONSE.confidence),
    reasoning: Array.isArray(obj.reasoning)
      ? obj.reasoning.slice(0, 10).map((r: unknown) => {
          const item = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>
          return {
            point: truncateString(item.point, 200, 'Unknown'),
            analysis: truncateString(item.analysis, 1000, 'N/A'),
            evidence: truncateString(item.evidence, 500, 'N/A'),
            confidence: clampNumber(item.confidence, 0, 1, 0.5),
          }
        })
      : DEFAULT_RESPONSE.reasoning,
    risks: Array.isArray(obj.risks)
      ? obj.risks.slice(0, 10).map((r: unknown) => {
          const item = (typeof r === 'object' && r !== null ? r : {}) as Record<string, unknown>
          return {
            category: truncateString(item.category, 100, 'General'),
            description: truncateString(item.description, 500, 'N/A'),
            severity: parseSeverity(item.severity),
            probability: clampNumber(item.probability, 0, 1, 0.5),
            mitigation:
              typeof item.mitigation === 'string' ? item.mitigation.slice(0, 500) : undefined,
          }
        })
      : DEFAULT_RESPONSE.risks,
    alternatives: undefined,
    recommendedAction:
      typeof obj.recommendedAction === 'string' ? obj.recommendedAction.slice(0, 1000) : undefined,
  }
}
