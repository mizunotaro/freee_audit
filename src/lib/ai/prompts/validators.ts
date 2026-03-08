import type {
  TemplateVariable,
  VariableType,
  ValidationError,
  ValidationWarning,
} from './template-types'

interface VariableValidationResult {
  valid: boolean
  errors: Omit<ValidationError, 'variable'>[]
  warnings: Omit<ValidationWarning, 'variable'>[]
}

const TYPE_CHECKERS: Record<VariableType, (value: unknown) => boolean> = {
  string: (v): v is string => typeof v === 'string',
  number: (v): v is number => typeof v === 'number' && !isNaN(v) && isFinite(v),
  boolean: (v): v is boolean => typeof v === 'boolean',
  array: (v): v is unknown[] => Array.isArray(v),
  object: (v): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v),
  date: (v): v is Date => v instanceof Date && !isNaN(v.getTime()),
}

export function validateVariable(
  variable: TemplateVariable,
  value: unknown
): VariableValidationResult {
  const errors: Omit<ValidationError, 'variable'>[] = []
  const warnings: Omit<ValidationWarning, 'variable'>[] = []

  const typeChecker = TYPE_CHECKERS[variable.type]
  if (!typeChecker(value)) {
    errors.push({
      code: 'type_mismatch',
      message: `Expected type ${variable.type}, got ${typeof value}`,
      value,
    })
    return { valid: false, errors, warnings }
  }

  if (variable.validation) {
    const constraintResult = validateConstraints(variable, value)
    errors.push(...constraintResult.errors)
    warnings.push(...constraintResult.warnings)
  }

  return { valid: errors.length === 0, errors, warnings }
}

function validateConstraints(variable: TemplateVariable, value: unknown): VariableValidationResult {
  const errors: Omit<ValidationError, 'variable'>[] = []
  const warnings: Omit<ValidationWarning, 'variable'>[] = []
  const { validation } = variable

  if (!validation) {
    return { valid: true, errors, warnings }
  }

  if (typeof value === 'string') {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      errors.push({
        code: 'constraint_violation',
        message: `String length ${value.length} is less than minimum ${validation.minLength}`,
        value,
      })
    }

    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      warnings.push({
        code: 'value_truncated',
        message: `String will be truncated to ${validation.maxLength} characters`,
      })
    }

    if (validation.pattern) {
      try {
        const regex = new RegExp(validation.pattern)
        if (!regex.test(value)) {
          errors.push({
            code: 'constraint_violation',
            message: `Value does not match pattern ${validation.pattern}`,
            value,
          })
        }
      } catch {
        warnings.push({
          code: 'pattern_approximation',
          message: `Invalid pattern regex: ${validation.pattern}`,
        })
      }
    }

    if (validation.enum && !validation.enum.includes(value)) {
      errors.push({
        code: 'invalid_value',
        message: `Value must be one of: ${validation.enum.join(', ')}`,
        value,
      })
    }
  }

  if (typeof value === 'number') {
    if (validation.min !== undefined && value < validation.min) {
      errors.push({
        code: 'constraint_violation',
        message: `Value ${value} is less than minimum ${validation.min}`,
        value,
      })
    }

    if (validation.max !== undefined && value > validation.max) {
      errors.push({
        code: 'constraint_violation',
        message: `Value ${value} is greater than maximum ${validation.max}`,
        value,
      })
    }
  }

  if (Array.isArray(value)) {
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      errors.push({
        code: 'constraint_violation',
        message: `Array length ${value.length} is less than minimum ${validation.minLength}`,
        value,
      })
    }

    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      warnings.push({
        code: 'value_truncated',
        message: `Array will be truncated to ${validation.maxLength} items`,
      })
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

export function transformValue(value: unknown, transform?: TemplateVariable['transform']): unknown {
  if (!transform || typeof value !== 'string') {
    return value
  }

  switch (transform) {
    case 'uppercase':
      return value.toUpperCase()
    case 'lowercase':
      return value.toLowerCase()
    case 'trim':
      return value.trim()
    case 'sanitize':
      return sanitizeString(value)
    default:
      return value
  }
}

export function sanitizeValue(value: unknown, variable: TemplateVariable): unknown {
  if (typeof value === 'string') {
    let sanitized = sanitizeString(value)

    if (variable.validation?.maxLength) {
      sanitized = sanitized.slice(0, variable.validation.maxLength)
    }

    return sanitized
  }

  if (typeof value === 'number') {
    if (!isFinite(value) || isNaN(value)) {
      return variable.defaultValue ?? 0
    }

    if (variable.validation?.min !== undefined && value < variable.validation.min) {
      return variable.validation.min
    }
    if (variable.validation?.max !== undefined && value > variable.validation.max) {
      return variable.validation.max
    }

    return Math.round(value * 1000000) / 1000000
  }

  if (Array.isArray(value)) {
    if (variable.validation?.maxLength) {
      return value.slice(0, variable.validation.maxLength)
    }
    return value
  }

  return value
}

function sanitizeString(input: string): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\u200B/g, '')
      .replace(/\uFEFF/g, '')
      .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
      .normalize('NFC')
  )
}

export function createVariable(
  name: string,
  type: VariableType,
  options?: Partial<Omit<TemplateVariable, 'name' | 'type'>>
): TemplateVariable {
  return {
    name,
    type,
    required: options?.required ?? true,
    defaultValue: options?.defaultValue,
    validation: options?.validation,
    description: options?.description,
    transform: options?.transform,
  }
}

export const COMMON_VARIABLES = {
  companyName: createVariable('companyName', 'string', {
    required: true,
    description: 'Company name for analysis',
    validation: { minLength: 1, maxLength: 200 },
    transform: 'sanitize',
  }),

  fiscalYear: createVariable('fiscalYear', 'string', {
    required: true,
    description: 'Fiscal year (e.g., 2024)',
    validation: { pattern: '^\\d{4}$' },
  }),

  language: createVariable('language', 'string', {
    required: false,
    defaultValue: 'ja',
    description: 'Output language',
    validation: { enum: ['ja', 'en'] },
  }),

  analysisDepth: createVariable('analysisDepth', 'string', {
    required: false,
    defaultValue: 'standard',
    description: 'Depth of analysis',
    validation: { enum: ['brief', 'standard', 'detailed', 'comprehensive'] },
  }),

  includeRisks: createVariable('includeRisks', 'boolean', {
    required: false,
    defaultValue: true,
    description: 'Include risk analysis',
  }),

  maxRecommendations: createVariable('maxRecommendations', 'number', {
    required: false,
    defaultValue: 5,
    description: 'Maximum number of recommendations',
    validation: { min: 1, max: 20 },
  }),
} as const
