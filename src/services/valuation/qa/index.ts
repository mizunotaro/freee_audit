import type { AIProvider } from '@/lib/integrations/ai/provider'
import type {
  DCFResult,
  ComparableResult,
  AssetBasedResult,
  BlackScholesResult,
  MonteCarloResult,
  ScenarioResult,
  CalculationStep,
  ValuationMethod,
  Result,
  ValuationError as _ValuationError,
} from '../types'

export interface ValuationQARequest {
  calculationType: ValuationMethod
  inputs: Record<string, unknown>
  result:
    | DCFResult
    | ComparableResult
    | AssetBasedResult
    | BlackScholesResult
    | MonteCarloResult
    | ScenarioResult
  steps: CalculationStep[]
  executionSource: 'typescript' | 'r-service' | 'python-package'
  metadata?: {
    companyId?: string
    industry?: string
    calculationTimestamp?: string
  }
}

export interface QAIssue {
  id: string
  category: 'formula' | 'boundary' | 'consistency' | 'best_practice'
  severity: 'error' | 'warning' | 'info'
  message: string
  field?: string
  expectedRange?: { min: number; max: number }
  actualValue?: number
  suggestion?: string
}

export interface ValuationQAResult {
  passed: boolean
  score: number
  confidence: 'high' | 'medium' | 'low'
  issues: QAIssue[]
  recommendations: string[]
  validationDetails: {
    formulaCheck: { passed: boolean; issues: string[] }
    boundaryCheck: { passed: boolean; warnings: string[] }
    consistencyCheck: { passed: boolean; issues: string[] }
    bestPracticeCheck: { passed: boolean; issues: string[] }
  }
  crossValidation?: {
    llmValidated: boolean
    llmIssues: string[]
    llmConfidence: 'high' | 'medium' | 'low'
  }
}

export interface ValuationQAConfig {
  enableLLMValidation: boolean
  enableCrossValidation: boolean
  llmProvider?: AIProvider
  timeout?: number
  retryAttempts?: number
}

const DEFAULT_CONFIG: ValuationQAConfig = {
  enableLLMValidation: true,
  enableCrossValidation: true,
  timeout: 30000,
  retryAttempts: 2,
}

export class ValuationQAService {
  private config: ValuationQAConfig
  private aiProvider?: AIProvider

  constructor(config: Partial<ValuationQAConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.aiProvider = this.config.llmProvider
  }

  async validate(request: ValuationQARequest): Promise<Result<ValuationQAResult>> {
    const startTime = Date.now()
    const issues: QAIssue[] = []
    const warnings: string[] = []

    const formulaResult = this.validateFormulas(request.steps)
    issues.push(...formulaResult.issues)

    const boundaryResult = this.validateBoundaries(request)
    warnings.push(...boundaryResult.warnings)

    const consistencyResult = this.validateConsistency(request)
    issues.push(...consistencyResult.issues)

    let crossValidationResult
    if (this.config.enableCrossValidation && this.aiProvider) {
      try {
        crossValidationResult = await this.crossValidateWithLLM(request)
      } catch {
        crossValidationResult = undefined
      }
    }

    const recommendations = this.generateRecommendations(issues)
    const score = this.calculateScore(issues)
    const confidence = this.determineConfidence(score)

    const _executionTimeMs = Date.now() - startTime

    return {
      success: true,
      data: {
        passed: issues.filter((i) => i.severity !== 'error').length === 0,
        score,
        confidence,
        issues,
        recommendations,
        validationDetails: {
          formulaCheck: {
            passed: formulaResult.issues.length === 0,
            issues: formulaResult.issues.map((i) => i.message),
          },
          boundaryCheck: {
            passed: boundaryResult.warnings.length === 0,
            warnings: boundaryResult.warnings,
          },
          consistencyCheck: {
            passed: consistencyResult.issues.length === 0,
            issues: consistencyResult.issues.map((i) => i.message),
          },
          bestPracticeCheck: { passed: true, issues: [] },
        },
        crossValidation: crossValidationResult
          ? {
              llmValidated: crossValidationResult.llmValidated,
              llmIssues: crossValidationResult.llmIssues,
              llmConfidence: crossValidationResult.llmConfidence,
            }
          : undefined,
      },
    }
  }

  private validateFormulas(steps: CalculationStep[]): { issues: QAIssue[] } {
    const issues: QAIssue[] = []

    for (const step of steps) {
      if (!step.formula || !step.formulaWithValues) {
        issues.push({
          id: `formula_missing_${step.id}`,
          category: 'formula',
          severity: 'error',
          message: `Missing formula for step: ${step.name}`,
          field: step.id,
        })
      }
      if (step.children) {
        issues.push(...this.validateFormulas(step.children).issues)
      }
    }

    return { issues }
  }

  private validateBoundaries(request: ValuationQARequest): { warnings: string[] } {
    const warnings: string[] = []
    const result = request.result as DCFResult & {
      enterpriseValue?: number
      terminalValue?: number
    }

    if (result.enterpriseValue !== undefined && result.enterpriseValue < 0) {
      warnings.push('Enterprise value is negative')
    }
    if (result.terminalValue !== undefined && result.terminalValue < 0) {
      warnings.push('Terminal value is negative')
    }

    return { warnings }
  }

  private validateConsistency(request: ValuationQARequest): { issues: QAIssue[] } {
    const issues: QAIssue[] = []

    if (request.steps.length === 0) {
      issues.push({
        id: 'no_steps_provided',
        category: 'consistency',
        severity: 'error',
        message: 'No calculation steps provided',
      })
    }

    const result = request.result as DCFResult
    if (result.metadata?.presentValues) {
      const pvSum = result.metadata.presentValues.reduce((a, b) => a + b, 0)
      if (pvSum <= 0) {
        issues.push({
          id: 'present_values_negative',
          category: 'consistency',
          severity: 'warning',
          message: 'Sum of present values is non-positive',
        })
      }
    }

    return { issues }
  }

  private async crossValidateWithLLM(request: ValuationQARequest): Promise<{
    llmValidated: boolean
    llmIssues: string[]
    llmConfidence: 'high' | 'medium' | 'low'
  }> {
    if (!this.aiProvider) {
      return {
        llmValidated: false,
        llmIssues: ['AI provider not configured'],
        llmConfidence: 'low',
      }
    }

    const prompt = this.buildValidationPrompt(request)
    try {
      const response = await this.aiProvider.generate({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2000,
        temperature: 0.2,
      })

      const passed =
        response.content.toLowerCase().includes('passed') &&
        !response.content.toLowerCase().includes('failed')
      const llmIssues: string[] = []
      let llmConfidence: 'high' | 'medium' | 'low' = 'medium'

      if (response.content.toLowerCase().includes('critical')) {
        llmIssues.push('Critical issues found')
        llmConfidence = 'low'
      }

      return { llmValidated: passed, llmIssues, llmConfidence }
    } catch (error) {
      return {
        llmValidated: false,
        llmIssues: [error instanceof Error ? error.message : 'LLM validation failed'],
        llmConfidence: 'low',
      }
    }
  }

  private buildValidationPrompt(request: ValuationQARequest): string {
    const stepsDescription = request.steps
      .map((s, i) => `${i + 1}. ${s.name}: ${s.formula} = ${s.formulaWithValues}`)
      .join('\n')

    return `You are a Financial Analyst reviewing a valuation calculation for quality assurance.

Calculation Type: ${request.calculationType}

Input Parameters:
${JSON.stringify(request.inputs, null, 2)}

Result:
${JSON.stringify(request.result, null, 2)}

Calculation Steps:
${stepsDescription}

Source: ${request.executionSource}

Please validate:
1. Formula correctness: Verify each formula is mathematically correct
2. Boundary checks: Ensure inputs are within acceptable ranges
3. Consistency: Check results are internally consistent

Respond with JSON containing passed (boolean), issues (string array)
 confidence (high|medium|low)`
  }

  private generateRecommendations(issues: QAIssue[]): string[] {
    const recommendations: string[] = []

    if (issues.some((i) => i.severity === 'error')) {
      recommendations.push('Critical: Fix errors before proceeding')
    }
    if (issues.some((i) => i.severity === 'warning')) {
      recommendations.push('Review warnings to improve accuracy')
    }

    return recommendations
  }

  private calculateScore(issues: QAIssue[]): number {
    const errorCount = issues.filter((i) => i.severity === 'error').length
    const warningCount = issues.filter((i) => i.severity === 'warning').length
    return Math.max(0, 100 - errorCount * 50 - warningCount * 10)
  }

  private determineConfidence(score: number): 'high' | 'medium' | 'low' {
    if (score >= 80) return 'high'
    if (score >= 60) return 'medium'
    return 'low'
  }
}

export const valuationQAService = new ValuationQAService()
