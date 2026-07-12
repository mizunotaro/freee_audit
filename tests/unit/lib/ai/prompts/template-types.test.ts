import { describe, it, expect } from 'vitest'
import type {
  VariableType,
  TemplateVariable,
  PromptTemplate,
  CompiledTemplate,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TemplateRegistry,
  TemplateResult,
} from '@/lib/ai/prompts/template-types'

describe('src/lib/ai/prompts/template-types', () => {
  describe('VariableType', () => {
    it('is exactly the six-member primitive/kind union', () => {
      expectTypeOf<VariableType>().toEqualTypeOf<
        'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'
      >()
    })

    it('accepts every documented member at runtime', () => {
      const members: VariableType[] = ['string', 'number', 'boolean', 'array', 'object', 'date']
      expect(members).toHaveLength(6)
      expect(members).toEqual(['string', 'number', 'boolean', 'array', 'object', 'date'])
    })

    it('rejects values outside the union (fail-safe)', () => {
      // @ts-expect-error - 'bigint' is not a VariableType member
      const bad: VariableType = 'bigint'
      expect(bad).toBe('bigint')
    })
  })

  describe('TemplateVariable', () => {
    it('accepts the minimal required shape (name + type + required)', () => {
      const v: TemplateVariable = { name: 'companyName', type: 'string', required: true }
      expect(v.name).toBe('companyName')
      expect(v.type).toBe('string')
      expect(v.required).toBe(true)
      expect(v.defaultValue).toBeUndefined()
      expect(v.validation).toBeUndefined()
      expect(v.description).toBeUndefined()
      expect(v.transform).toBeUndefined()
    })

    it('accepts a fully-populated shape including every optional field', () => {
      const v: TemplateVariable = {
        name: 'limit',
        type: 'number',
        required: false,
        defaultValue: 10,
        validation: {
          minLength: 1,
          maxLength: 100,
          min: 0,
          max: 1000,
          pattern: '^\\d+$',
          enum: ['10', '100', '1000'],
        },
        description: 'Maximum number of items',
        transform: 'uppercase',
      }
      expect(v.defaultValue).toBe(10)
      expect(v.validation?.min).toBe(0)
      expect(v.validation?.max).toBe(1000)
      expect(v.validation?.minLength).toBe(1)
      expect(v.validation?.maxLength).toBe(100)
      expect(v.validation?.pattern).toBe('^\\d+$')
      expect(v.validation?.enum).toEqual(['10', '100', '1000'])
      expect(v.description).toBe('Maximum number of items')
      expect(v.transform).toBe('uppercase')
    })

    it('accepts each VariableType for the type field', () => {
      for (const type of ['string', 'number', 'boolean', 'array', 'object', 'date'] as const) {
        const v: TemplateVariable = { name: 'x', type, required: false }
        expect(v.type).toBe(type)
      }
    })

    it('accepts each transform member', () => {
      const transforms: TemplateVariable['transform'][] = [
        'uppercase',
        'lowercase',
        'trim',
        'sanitize',
        undefined,
      ]
      expect(transforms).toHaveLength(5)
    })

    it('accepts boundary validation values (zeroes and an empty enum)', () => {
      const v: TemplateVariable = {
        name: 'x',
        type: 'string',
        required: true,
        validation: { minLength: 0, maxLength: 0, min: 0, max: 0, pattern: '', enum: [] },
      }
      expect(v.validation?.minLength).toBe(0)
      expect(v.validation?.maxLength).toBe(0)
      expect(v.validation?.enum).toEqual([])
    })

    it('exposes every property as readonly (fail-safe against mutation)', () => {
      const v: TemplateVariable = { name: 'x', type: 'string', required: true }
      expect(v.name).toBe('x')
      expectTypeOf<TemplateVariable['name']>().toEqualTypeOf<string>()
      expectTypeOf<TemplateVariable['type']>().toEqualTypeOf<VariableType>()
      expectTypeOf<TemplateVariable['required']>().toEqualTypeOf<boolean>()
      // @ts-expect-error - name is readonly and cannot be reassigned at the type level
      v.name = 'mutated'
    })

    it('rejects an invalid transform value (fail-safe)', () => {
      const v = { name: 'x', type: 'string' as const, required: true }
      // @ts-expect-error - 'capitalize' is not a TemplateVariable transform
      const bad: TemplateVariable = { ...v, transform: 'capitalize' }
      expect(bad.transform).toBe('capitalize')
    })
  })

  describe('PromptTemplate', () => {
    const baseTemplate: PromptTemplate = {
      id: 'tmpl-1',
      name: 'Analysis Template',
      description: 'A sample analysis prompt',
      version: '1.0.0',
      category: 'analysis',
      template: 'Analyze {{target}} for {{period}}.',
      variables: [
        { name: 'target', type: 'string', required: true },
        { name: 'period', type: 'string', required: false, defaultValue: 'Q1' },
      ],
      metadata: {
        author: 'cpa-persona',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
        tags: ['analysis', 'jp'],
        estimatedTokens: 256,
      },
    }

    it('accepts a fully-populated template', () => {
      expect(baseTemplate.id).toBe('tmpl-1')
      expect(baseTemplate.category).toBe('analysis')
      expect(baseTemplate.variables).toHaveLength(2)
      expect(baseTemplate.metadata.author).toBe('cpa-persona')
      expect(baseTemplate.metadata.estimatedTokens).toBe(256)
    })

    it('accepts every category member', () => {
      const categories: PromptTemplate['category'][] = [
        'analysis',
        'report',
        'chat',
        'system',
        'custom',
      ]
      expect(categories).toHaveLength(5)
      for (const category of categories) {
        const t: PromptTemplate = { ...baseTemplate, category }
        expect(t.category).toBe(category)
      }
    })

    it('accepts a template without the optional metadata.author', () => {
      const t: PromptTemplate = {
        ...baseTemplate,
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 0,
        },
      }
      expect(t.metadata.author).toBeUndefined()
      expect(t.metadata.tags).toEqual([])
      expect(t.metadata.estimatedTokens).toBe(0)
    })

    it('accepts an empty variables list (boundary)', () => {
      const t: PromptTemplate = { ...baseTemplate, variables: [] }
      expect(t.variables).toEqual([])
    })

    it('rejects an invalid category value (fail-safe)', () => {
      const partial = {
        id: 'x',
        name: 'x',
        description: 'x',
        version: '1.0.0',
        template: 'x',
        variables: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 0,
        },
      }
      // @ts-expect-error - 'dashboard' is not a PromptTemplate category
      const bad: PromptTemplate = { ...partial, category: 'dashboard' }
      expect(bad.category).toBe('dashboard')
    })

    it('treats all fields as readonly', () => {
      expectTypeOf<PromptTemplate['id']>().toEqualTypeOf<string>()
      expectTypeOf<PromptTemplate['version']>().toEqualTypeOf<string>()
      expectTypeOf<PromptTemplate['variables']>().toEqualTypeOf<readonly TemplateVariable[]>()
    })
  })

  describe('CompiledTemplate', () => {
    it('accepts a fully-populated compiled template', () => {
      const c: CompiledTemplate = {
        templateId: 'tmpl-1',
        content: 'Analyze sales for Q1.',
        estimatedTokens: 18,
        variablesUsed: ['target', 'period'],
        compilationTimeMs: 3,
      }
      expect(c.templateId).toBe('tmpl-1')
      expect(c.estimatedTokens).toBe(18)
      expect(c.variablesUsed).toEqual(['target', 'period'])
      expect(c.compilationTimeMs).toBe(3)
    })

    it('accepts boundary values (zero tokens, zero time, no variables)', () => {
      const c: CompiledTemplate = {
        templateId: 'empty',
        content: '',
        estimatedTokens: 0,
        variablesUsed: [],
        compilationTimeMs: 0,
      }
      expect(c.content).toBe('')
      expect(c.estimatedTokens).toBe(0)
      expect(c.variablesUsed).toEqual([])
    })

    it('exposes readonly fields', () => {
      expectTypeOf<CompiledTemplate['content']>().toEqualTypeOf<string>()
      expectTypeOf<CompiledTemplate['variablesUsed']>().toEqualTypeOf<readonly string[]>()
    })
  })

  describe('ValidationError', () => {
    it('accepts the required fields plus optional value', () => {
      const e: ValidationError = {
        variable: 'target',
        code: 'required_missing',
        message: 'target is required',
        value: undefined,
      }
      expect(e.variable).toBe('target')
      expect(e.code).toBe('required_missing')
      expect(e.message).toBe('target is required')
    })

    it('works without the optional value field', () => {
      const e: ValidationError = {
        variable: 'limit',
        code: 'type_mismatch',
        message: 'expected number',
      }
      expect(e.value).toBeUndefined()
    })

    it('accepts every documented error code', () => {
      const codes: ValidationError['code'][] = [
        'required_missing',
        'type_mismatch',
        'constraint_violation',
        'invalid_value',
      ]
      expect(codes).toHaveLength(4)
      expectTypeOf<ValidationError['code']>().toEqualTypeOf<
        'required_missing' | 'type_mismatch' | 'constraint_violation' | 'invalid_value'
      >()
    })

    it('can carry the offending value of any type', () => {
      const e: ValidationError = {
        variable: 'limit',
        code: 'invalid_value',
        message: 'must be positive',
        value: -1,
      }
      expect(e.value).toBe(-1)
    })

    it('rejects an invalid error code (fail-safe)', () => {
      // @ts-expect-error - 'unknown_error' is not a ValidationError code
      const bad: ValidationError = { variable: 'x', code: 'unknown_error', message: 'm' }
      expect(bad.code).toBe('unknown_error')
    })
  })

  describe('ValidationWarning', () => {
    it('accepts a warning with all required fields', () => {
      const w: ValidationWarning = {
        variable: 'period',
        code: 'default_used',
        message: 'fell back to default Q1',
      }
      expect(w.variable).toBe('period')
      expect(w.code).toBe('default_used')
      expect(w.message).toBe('fell back to default Q1')
    })

    it('accepts every documented warning code', () => {
      const codes: ValidationWarning['code'][] = [
        'default_used',
        'value_truncated',
        'pattern_approximation',
      ]
      expect(codes).toHaveLength(3)
      expectTypeOf<ValidationWarning['code']>().toEqualTypeOf<
        'default_used' | 'value_truncated' | 'pattern_approximation'
      >()
    })

    it('rejects an invalid warning code (fail-safe)', () => {
      // @ts-expect-error - 'deprecated' is not a ValidationWarning code
      const bad: ValidationWarning = { variable: 'x', code: 'deprecated', message: 'm' }
      expect(bad.code).toBe('deprecated')
    })
  })

  describe('ValidationResult', () => {
    it('represents a valid result with empty error/warning lists', () => {
      const r: ValidationResult = { valid: true, errors: [], warnings: [] }
      expect(r.valid).toBe(true)
      expect(r.errors).toEqual([])
      expect(r.warnings).toEqual([])
    })

    it('represents an invalid result with errors and warnings', () => {
      const r: ValidationResult = {
        valid: false,
        errors: [{ variable: 'target', code: 'required_missing', message: 'missing' }],
        warnings: [{ variable: 'period', code: 'default_used', message: 'default applied' }],
      }
      expect(r.valid).toBe(false)
      expect(r.errors).toHaveLength(1)
      expect(r.warnings).toHaveLength(1)
      expect(r.errors[0].code).toBe('required_missing')
      expect(r.warnings[0].code).toBe('default_used')
    })

    it('exposes readonly arrays typed as ValidationError/ValidationWarning', () => {
      expectTypeOf<ValidationResult['errors']>().toEqualTypeOf<readonly ValidationError[]>()
      expectTypeOf<ValidationResult['warnings']>().toEqualTypeOf<readonly ValidationWarning[]>()
    })
  })

  describe('TemplateRegistry', () => {
    it('accepts a registry with templates, categories and version', () => {
      const reg: TemplateRegistry = {
        templates: [
          {
            id: 'tmpl-1',
            name: 'T1',
            description: 'd',
            version: '1.0.0',
            category: 'analysis',
            template: 't',
            variables: [],
            metadata: {
              createdAt: new Date(),
              updatedAt: new Date(),
              tags: [],
              estimatedTokens: 1,
            },
          },
        ],
        categories: ['analysis', 'report'],
        version: '2026.07',
      }
      expect(reg.templates).toHaveLength(1)
      expect(reg.categories).toEqual(['analysis', 'report'])
      expect(reg.version).toBe('2026.07')
    })

    it('accepts an empty registry (boundary)', () => {
      const reg: TemplateRegistry = { templates: [], categories: [], version: '' }
      expect(reg.templates).toEqual([])
      expect(reg.categories).toEqual([])
      expect(reg.version).toBe('')
    })

    it('exposes readonly aggregate fields', () => {
      expectTypeOf<TemplateRegistry['templates']>().toEqualTypeOf<readonly PromptTemplate[]>()
      expectTypeOf<TemplateRegistry['categories']>().toEqualTypeOf<readonly string[]>()
    })
  })

  describe('TemplateResult<T>', () => {
    it('is a discriminated union on the success flag', () => {
      expectTypeOf<TemplateResult<string>>().toEqualTypeOf<
        | { success: true; data: string }
        | {
            success: false
            error: { code: string; message: string; details?: Record<string, unknown> }
          }
      >()
    })

    it('narrows to data on the success branch', () => {
      const ok: TemplateResult<number> = { success: true, data: 42 }
      expect(ok.success).toBe(true)
      if (ok.success) {
        expect(ok.data).toBe(42)
        expectTypeOf(ok.data).toEqualTypeOf<number>()
      }
    })

    it('narrows to error on the failure branch', () => {
      const fail: TemplateResult<number> = {
        success: false,
        error: { code: 'TEMPLATE_NOT_FOUND', message: 'no such template' },
      }
      expect(fail.success).toBe(false)
      if (!fail.success) {
        expect(fail.error.code).toBe('TEMPLATE_NOT_FOUND')
        expect(fail.error.message).toBe('no such template')
        expect(fail.error.details).toBeUndefined()
        expectTypeOf(fail.error.code).toEqualTypeOf<string>()
      }
    })

    it('carries optional structured details on the error branch', () => {
      const fail: TemplateResult<unknown> = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'bad input',
          details: { field: 'target', allowed: ['A', 'B'] },
        },
      }
      if (!fail.success) {
        expect(fail.error.details).toEqual({ field: 'target', allowed: ['A', 'B'] })
      }
    })

    it('substitutes the generic data type across the success branch', () => {
      type Item = { id: string; qty: number }
      const ok: TemplateResult<Item> = {
        success: true,
        data: { id: 'a', qty: 3 },
      }
      if (ok.success) {
        expect(ok.data.id).toBe('a')
        expectTypeOf(ok.data).toEqualTypeOf<Item>()
      }
    })

    it('degrades safely: a failure with empty message still type-checks', () => {
      const fail: TemplateResult<never> = {
        success: false,
        error: { code: '', message: '' },
      }
      expect(fail.success).toBe(false)
      if (!fail.success) {
        expect(fail.error.code).toBe('')
        expect(fail.error.message).toBe('')
      }
    })

    it('rejects a success branch missing data (fail-safe)', () => {
      // @ts-expect-error - success branch requires data
      const bad: TemplateResult<string> = { success: true }
      expect(bad.success).toBe(true)
    })

    it('rejects a failure branch missing error (fail-safe)', () => {
      // @ts-expect-error - failure branch requires error
      const bad: TemplateResult<string> = { success: false }
      expect(bad.success).toBe(false)
    })
  })
})
