import type { ConversionRule, MappingCondition } from '@/types/conversion'
import {
  type Result,
  type AppError,
  success,
  failure,
  createAppError,
  ERROR_CODES,
} from '@/types/result'

export interface MappingContext {
  date?: Date
  partnerName?: string
  description?: string
  tags?: string[]
  amount?: number
}

export interface JournalData {
  entryDate: Date
  description: string
  partnerName?: string
  amount: number
  tags?: string[]
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  code: string
  message: string
  field?: string
}

export class MappingRuleEngine {
  calculateAmount(
    rule: ConversionRule,
    sourceAmount: number,
    context?: MappingContext
  ): Result<number, AppError> {
    switch (rule.type) {
      case 'direct':
        return success(sourceAmount)

      case 'percentage':
        if (rule.percentage === undefined) {
          return failure(
            createAppError(
              ERROR_CODES.VALIDATION_ERROR,
              'Percentage rule requires percentage value'
            )
          )
        }
        return success(Math.round(sourceAmount * (rule.percentage / 100)))

      case 'formula':
        return this.evaluateFormula(rule.formula ?? 'amount', sourceAmount, context)

      case 'ai_suggested':
        return success(sourceAmount)

      default:
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Unknown rule type: ${(rule as { type: string }).type}`
          )
        )
    }
  }

  evaluateConditions(conditions: MappingCondition[], journalData: JournalData): string | null {
    for (const condition of conditions) {
      if (this.evaluateCondition(condition, journalData)) {
        return condition.targetAccountId
      }
    }

    return null
  }

  validateRule(rule: ConversionRule): ValidationResult {
    const errors: ValidationError[] = []

    const validTypes = ['direct', 'percentage', 'formula', 'ai_suggested']
    if (!validTypes.includes(rule.type)) {
      errors.push({
        code: 'INVALID_TYPE',
        message: `Invalid rule type: ${rule.type}. Must be one of: ${validTypes.join(', ')}`,
        field: 'type',
      })
    }

    if (rule.type === 'percentage') {
      if (rule.percentage === undefined) {
        errors.push({
          code: 'MISSING_PERCENTAGE',
          message: 'Percentage rule requires percentage value',
          field: 'percentage',
        })
      } else if (rule.percentage < 0 || rule.percentage > 100) {
        errors.push({
          code: 'INVALID_PERCENTAGE',
          message: 'Percentage must be between 0 and 100',
          field: 'percentage',
        })
      }
    }

    if (rule.type === 'formula') {
      if (!rule.formula) {
        errors.push({
          code: 'MISSING_FORMULA',
          message: 'Formula rule requires formula expression',
          field: 'formula',
        })
      } else {
        const formulaErrors = this.validateFormula(rule.formula)
        errors.push(...formulaErrors)
      }
    }

    if (rule.conditions) {
      for (let i = 0; i < rule.conditions.length; i++) {
        const conditionErrors = this.validateCondition(rule.conditions[i], i)
        errors.push(...conditionErrors)
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  private evaluateCondition(condition: MappingCondition, data: JournalData): boolean {
    const fieldValue = this.getFieldValue(condition.field, data)

    if (fieldValue === null || fieldValue === undefined) {
      return false
    }

    switch (condition.operator) {
      case 'equals':
        return String(fieldValue) === String(condition.value)

      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase())

      case 'gt':
        return Number(fieldValue) > Number(condition.value)

      case 'lt':
        return Number(fieldValue) < Number(condition.value)

      case 'between': {
        const rangeValue = String(condition.value).split(',')
        if (rangeValue.length !== 2) return false
        const numValue = Number(fieldValue)
        const min = Number(rangeValue[0].trim())
        const max = Number(rangeValue[1].trim())
        return numValue >= min && numValue <= max
      }

      default:
        return false
    }
  }

  private getFieldValue(field: string, data: JournalData): unknown {
    const fieldMap: Record<string, unknown> = {
      entryDate: data.entryDate,
      date: data.entryDate,
      description: data.description,
      partnerName: data.partnerName,
      partner: data.partnerName,
      amount: data.amount,
      tags: data.tags,
    }

    return fieldMap[field]
  }

  private evaluateFormula(
    formula: string,
    amount: number,
    context?: MappingContext
  ): Result<number, AppError> {
    try {
      const sanitizedFormula = this.sanitizeFormula(formula)

      const variables: Record<string, number> = {
        amount,
        AMOUNT: amount,
      }

      if (context) {
        if (context.date) {
          variables.year = context.date.getFullYear()
          variables.month = context.date.getMonth() + 1
          variables.day = context.date.getDate()
          variables.YEAR = variables.year
          variables.MONTH = variables.month
          variables.DAY = variables.day
        }
        if (context.amount !== undefined) {
          variables.contextAmount = context.amount
        }
      }

      let result = sanitizedFormula
      for (const [key, value] of Object.entries(variables)) {
        result = result.replace(new RegExp(`\\b${key}\\b`, 'g'), String(value))
      }

      if (!/^[\d\s+\-*/().]+$/.test(result)) {
        return failure(
          createAppError(
            ERROR_CODES.VALIDATION_ERROR,
            'Invalid formula: contains disallowed characters'
          )
        )
      }

      const evalResult = Function(`"use strict"; return (${result})`)()
      if (typeof evalResult !== 'number' || !isFinite(evalResult)) {
        return failure(
          createAppError(ERROR_CODES.VALIDATION_ERROR, 'Formula did not evaluate to a valid number')
        )
      }

      return success(Math.round(evalResult))
    } catch (error) {
      return failure(
        createAppError(
          ERROR_CODES.VALIDATION_ERROR,
          `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      )
    }
  }

  private sanitizeFormula(formula: string): string {
    return formula
      .replace(/[^0-9+\-*/().a-zA-Z\s_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private validateFormula(formula: string): ValidationError[] {
    const errors: ValidationError[] = []

    const dangerousPatterns = [
      /eval/i,
      /function/i,
      /=>/,
      /\bthis\b/i,
      /\bwindow\b/i,
      /\bglobal\b/i,
      /\bprocess\b/i,
      /\brequire\b/i,
      /\bimport\b/i,
      /\bexport\b/i,
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(formula)) {
        errors.push({
          code: 'DANGEROUS_PATTERN',
          message: `Formula contains potentially dangerous pattern: ${pattern.source}`,
          field: 'formula',
        })
      }
    }

    const validVariables = [
      'amount',
      'AMOUNT',
      'year',
      'YEAR',
      'month',
      'MONTH',
      'day',
      'DAY',
      'contextAmount',
    ]
    const variablePattern = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g
    const matches = formula.match(variablePattern) || []

    for (const match of matches) {
      if (!validVariables.includes(match) && !/^\d+$/.test(match)) {
        const isOperator = ['Math', 'abs', 'ceil', 'floor', 'round', 'min', 'max'].includes(match)
        if (!isOperator) {
          errors.push({
            code: 'UNKNOWN_VARIABLE',
            message: `Unknown variable in formula: ${match}`,
            field: 'formula',
          })
        }
      }
    }

    let parenthesesCount = 0
    for (const char of formula) {
      if (char === '(') parenthesesCount++
      if (char === ')') parenthesesCount--
      if (parenthesesCount < 0) {
        errors.push({
          code: 'UNBALANCED_PARENTHESES',
          message: 'Unbalanced parentheses in formula',
          field: 'formula',
        })
        break
      }
    }
    if (parenthesesCount !== 0) {
      errors.push({
        code: 'UNBALANCED_PARENTHESES',
        message: 'Unbalanced parentheses in formula',
        field: 'formula',
      })
    }

    return errors
  }

  private validateCondition(condition: MappingCondition, index: number): ValidationError[] {
    const errors: ValidationError[] = []

    if (!condition.field || condition.field.trim() === '') {
      errors.push({
        code: 'EMPTY_FIELD',
        message: `Condition ${index}: field is required`,
        field: `conditions[${index}].field`,
      })
    }

    const validOperators = ['equals', 'contains', 'gt', 'lt', 'between']
    if (!validOperators.includes(condition.operator)) {
      errors.push({
        code: 'INVALID_OPERATOR',
        message: `Condition ${index}: invalid operator "${condition.operator}"`,
        field: `conditions[${index}].operator`,
      })
    }

    if (condition.value === undefined || condition.value === null || condition.value === '') {
      errors.push({
        code: 'EMPTY_VALUE',
        message: `Condition ${index}: value is required`,
        field: `conditions[${index}].value`,
      })
    }

    if (!condition.targetAccountId || condition.targetAccountId.trim() === '') {
      errors.push({
        code: 'EMPTY_TARGET',
        message: `Condition ${index}: targetAccountId is required`,
        field: `conditions[${index}].targetAccountId`,
      })
    }

    return errors
  }
}

export const mappingRuleEngine = new MappingRuleEngine()
