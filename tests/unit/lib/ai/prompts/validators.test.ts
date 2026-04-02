import { describe, it, expect } from 'vitest'
import {
  validateVariable,
  transformValue,
  sanitizeValue,
  createVariable,
  COMMON_VARIABLES,
} from '@/lib/ai/prompts/validators'
import type { TemplateVariable } from '@/lib/ai/prompts/template-types'

describe('validateVariable', () => {
  it('should validate correct string type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'string', required: true }
    const result = validateVariable(variable, 'hello')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should reject wrong type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'string', required: true }
    const result = validateVariable(variable, 123)
    expect(result.valid).toBe(false)
    expect(result.errors[0].code).toBe('type_mismatch')
  })

  it('should validate number type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'number', required: true }
    expect(validateVariable(variable, 42).valid).toBe(true)
    expect(validateVariable(variable, NaN).valid).toBe(false)
    expect(validateVariable(variable, Infinity).valid).toBe(false)
    expect(validateVariable(variable, '42').valid).toBe(false)
  })

  it('should validate boolean type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'boolean', required: true }
    expect(validateVariable(variable, true).valid).toBe(true)
    expect(validateVariable(variable, false).valid).toBe(true)
    expect(validateVariable(variable, 'true').valid).toBe(false)
  })

  it('should validate array type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'array', required: true }
    expect(validateVariable(variable, [1, 2, 3]).valid).toBe(true)
    expect(validateVariable(variable, 'not array').valid).toBe(false)
  })

  it('should validate object type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'object', required: true }
    expect(validateVariable(variable, { key: 'value' }).valid).toBe(true)
    expect(validateVariable(variable, null).valid).toBe(false)
    expect(validateVariable(variable, [1, 2]).valid).toBe(false)
  })

  it('should validate date type', () => {
    const variable: TemplateVariable = { name: 'test', type: 'date', required: true }
    expect(validateVariable(variable, new Date()).valid).toBe(true)
    expect(validateVariable(variable, new Date('invalid')).valid).toBe(false)
    expect(validateVariable(variable, '2024-01-01').valid).toBe(false)
  })

  it('should validate string minLength', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { minLength: 5 },
    }
    expect(validateVariable(variable, 'hello').valid).toBe(true)
    expect(validateVariable(variable, 'hi').valid).toBe(false)
    expect(validateVariable(variable, 'hi').errors[0].code).toBe('constraint_violation')
  })

  it('should warn on string maxLength exceeded', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { maxLength: 5 },
    }
    const result = validateVariable(variable, 'hello world')
    expect(result.valid).toBe(true)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('value_truncated')
  })

  it('should validate string pattern', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { pattern: '^\\d{4}$' },
    }
    expect(validateVariable(variable, '2024').valid).toBe(true)
    expect(validateVariable(variable, 'abc').valid).toBe(false)
  })

  it('should warn on invalid regex pattern', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { pattern: '[' },
    }
    const result = validateVariable(variable, 'hello')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('pattern_approximation')
  })

  it('should validate enum constraint', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { enum: ['ja', 'en'] },
    }
    expect(validateVariable(variable, 'ja').valid).toBe(true)
    expect(validateVariable(variable, 'fr').valid).toBe(false)
    expect(validateVariable(variable, 'fr').errors[0].code).toBe('invalid_value')
  })

  it('should validate number min constraint', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      validation: { min: 1 },
    }
    expect(validateVariable(variable, 5).valid).toBe(true)
    expect(validateVariable(variable, 0).valid).toBe(false)
  })

  it('should validate number max constraint', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      validation: { max: 10 },
    }
    expect(validateVariable(variable, 5).valid).toBe(true)
    expect(validateVariable(variable, 11).valid).toBe(false)
  })

  it('should validate array minLength', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'array',
      required: true,
      validation: { minLength: 2 },
    }
    expect(validateVariable(variable, [1, 2]).valid).toBe(true)
    expect(validateVariable(variable, [1]).valid).toBe(false)
  })

  it('should warn on array maxLength exceeded', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'array',
      required: true,
      validation: { maxLength: 2 },
    }
    const result = validateVariable(variable, [1, 2, 3])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].code).toBe('value_truncated')
  })

  it('should skip constraint validation when validation is not defined', () => {
    const variable: TemplateVariable = { name: 'test', type: 'string', required: true }
    const result = validateVariable(variable, 'any value')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })
})

describe('transformValue', () => {
  it('should return value unchanged when no transform', () => {
    expect(transformValue('hello')).toBe('hello')
  })

  it('should return non-string value unchanged', () => {
    expect(transformValue(123, 'uppercase')).toBe(123)
  })

  it('should apply uppercase transform', () => {
    expect(transformValue('hello', 'uppercase')).toBe('HELLO')
  })

  it('should apply lowercase transform', () => {
    expect(transformValue('HELLO', 'lowercase')).toBe('hello')
  })

  it('should apply trim transform', () => {
    expect(transformValue('  hello  ', 'trim')).toBe('hello')
  })

  it('should apply sanitize transform', () => {
    const input = 'hello\x00world\u200B'
    const result = transformValue(input, 'sanitize') as string
    expect(result).not.toContain('\x00')
    expect(result).not.toContain('\u200B')
  })

  it('should return value unchanged for unknown transform', () => {
    expect(transformValue('hello', 'unknown' as TemplateVariable['transform'])).toBe('hello')
  })
})

describe('sanitizeValue', () => {
  it('should sanitize string value', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'string',
      required: true,
      validation: { maxLength: 5 },
    }
    expect(sanitizeValue('hello world', variable)).toBe('hello')
  })

  it('should sanitize number value with NaN', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      defaultValue: 0,
    }
    expect(sanitizeValue(NaN, variable)).toBe(0)
  })

  it('should sanitize number value with Infinity', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      defaultValue: 0,
    }
    expect(sanitizeValue(Infinity, variable)).toBe(0)
  })

  it('should clamp number to min constraint', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      validation: { min: 5 },
    }
    expect(sanitizeValue(3, variable)).toBe(5)
  })

  it('should clamp number to max constraint', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
      validation: { max: 10 },
    }
    expect(sanitizeValue(15, variable)).toBe(10)
  })

  it('should round number to 6 decimal places', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
    }
    expect(sanitizeValue(1.123456789, variable)).toBe(1.123457)
  })

  it('should truncate array to maxLength', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'array',
      required: true,
      validation: { maxLength: 2 },
    }
    expect(sanitizeValue([1, 2, 3], variable)).toEqual([1, 2])
  })

  it('should return array unchanged without maxLength', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'array',
      required: true,
    }
    expect(sanitizeValue([1, 2, 3], variable)).toEqual([1, 2, 3])
  })

  it('should return non-string/number/array value unchanged', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'boolean',
      required: true,
    }
    expect(sanitizeValue(true, variable)).toBe(true)
  })

  it('should return 0 for NaN without defaultValue', () => {
    const variable: TemplateVariable = {
      name: 'test',
      type: 'number',
      required: true,
    }
    expect(sanitizeValue(NaN, variable)).toBe(0)
  })
})

describe('createVariable', () => {
  it('should create a variable with defaults', () => {
    const variable = createVariable('test', 'string')
    expect(variable.name).toBe('test')
    expect(variable.type).toBe('string')
    expect(variable.required).toBe(true)
    expect(variable.defaultValue).toBeUndefined()
    expect(variable.validation).toBeUndefined()
    expect(variable.description).toBeUndefined()
    expect(variable.transform).toBeUndefined()
  })

  it('should create a variable with options', () => {
    const variable = createVariable('test', 'number', {
      required: false,
      defaultValue: 5,
      validation: { min: 1, max: 10 },
      description: 'A test variable',
      transform: 'trim',
    })
    expect(variable.name).toBe('test')
    expect(variable.type).toBe('number')
    expect(variable.required).toBe(false)
    expect(variable.defaultValue).toBe(5)
    expect(variable.validation?.min).toBe(1)
    expect(variable.validation?.max).toBe(10)
    expect(variable.description).toBe('A test variable')
    expect(variable.transform).toBe('trim')
  })
})

describe('COMMON_VARIABLES', () => {
  it('should have companyName variable', () => {
    expect(COMMON_VARIABLES.companyName.name).toBe('companyName')
    expect(COMMON_VARIABLES.companyName.type).toBe('string')
    expect(COMMON_VARIABLES.companyName.required).toBe(true)
    expect(COMMON_VARIABLES.companyName.validation?.minLength).toBe(1)
    expect(COMMON_VARIABLES.companyName.validation?.maxLength).toBe(200)
    expect(COMMON_VARIABLES.companyName.transform).toBe('sanitize')
  })

  it('should have fiscalYear variable with pattern', () => {
    expect(COMMON_VARIABLES.fiscalYear.name).toBe('fiscalYear')
    expect(COMMON_VARIABLES.fiscalYear.validation?.pattern).toBe('^\\d{4}$')
  })

  it('should have language variable with enum', () => {
    expect(COMMON_VARIABLES.language.defaultValue).toBe('ja')
    expect(COMMON_VARIABLES.language.required).toBe(false)
    expect(COMMON_VARIABLES.language.validation?.enum).toEqual(['ja', 'en'])
  })

  it('should have analysisDepth variable with enum', () => {
    expect(COMMON_VARIABLES.analysisDepth.defaultValue).toBe('standard')
    expect(COMMON_VARIABLES.analysisDepth.validation?.enum).toContain('brief')
    expect(COMMON_VARIABLES.analysisDepth.validation?.enum).toContain('comprehensive')
  })

  it('should have includeRisks boolean variable', () => {
    expect(COMMON_VARIABLES.includeRisks.type).toBe('boolean')
    expect(COMMON_VARIABLES.includeRisks.defaultValue).toBe(true)
  })

  it('should have maxRecommendations number variable', () => {
    expect(COMMON_VARIABLES.maxRecommendations.type).toBe('number')
    expect(COMMON_VARIABLES.maxRecommendations.defaultValue).toBe(5)
    expect(COMMON_VARIABLES.maxRecommendations.validation?.min).toBe(1)
    expect(COMMON_VARIABLES.maxRecommendations.validation?.max).toBe(20)
  })
})
