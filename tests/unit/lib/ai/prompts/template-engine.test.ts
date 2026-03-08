import { describe, it, expect, beforeEach } from 'vitest'
import { TemplateEngine } from '@/lib/ai/prompts/template-engine'
import { validateVariable, COMMON_VARIABLES } from '@/lib/ai/prompts/validators'
import type { PromptTemplate } from '@/lib/ai/prompts/template-types'

describe('TemplateEngine', () => {
  let engine: TemplateEngine

  beforeEach(() => {
    engine = new TemplateEngine()
  })

  describe('registerTemplate', () => {
    it('should register valid template', () => {
      const template: PromptTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        version: '1.0.0',
        category: 'analysis',
        template: 'Hello, {{name}}!',
        variables: [{ name: 'name', type: 'string', required: true }],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: ['test'],
          estimatedTokens: 10,
        },
      }

      const result = engine.registerTemplate(template)

      expect(result.success).toBe(true)
    })

    it('should reject template without id', () => {
      const template = {
        id: '',
        name: 'Invalid',
        version: '1.0.0',
        category: 'analysis' as const,
        template: 'test',
        variables: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 0,
        },
        description: '',
      }

      const result = engine.registerTemplate(template as PromptTemplate)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('invalid_template')
      }
    })
  })

  describe('compile', () => {
    beforeEach(() => {
      const template: PromptTemplate = {
        id: 'greeting',
        name: 'Greeting',
        description: 'Greeting template',
        version: '1.0.0',
        category: 'chat',
        template: 'Hello, {{name}}! Welcome to {{company}}.',
        variables: [
          { name: 'name', type: 'string', required: true },
          { name: 'company', type: 'string', required: false, defaultValue: 'Our Company' },
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 20,
        },
      }
      engine.registerTemplate(template)
    })

    it('should compile template with variables', () => {
      const result = engine.compile('greeting', { name: 'John', company: 'Acme' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('Hello, John! Welcome to Acme.')
      }
    })

    it('should use default values', () => {
      const result = engine.compile('greeting', { name: 'John' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toBe('Hello, John! Welcome to Our Company.')
      }
    })

    it('should fail for missing required variable', () => {
      const result = engine.compile('greeting', {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('validation_failed')
      }
    })
  })

  describe('registerTemplates', () => {
    it('should register multiple templates', () => {
      const templates: PromptTemplate[] = [
        {
          id: 'template-1',
          name: 'Template 1',
          description: 'First template',
          version: '1.0.0',
          category: 'analysis',
          template: 'Content 1',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 10,
          },
        },
        {
          id: 'template-2',
          name: 'Template 2',
          description: 'Second template',
          version: '1.0.0',
          category: 'report',
          template: 'Content 2',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 10,
          },
        },
      ]

      const result = engine.registerTemplates(templates)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe(2)
      }
    })
  })

  describe('getTemplate', () => {
    it('should return registered template', () => {
      const template: PromptTemplate = {
        id: 'test-get',
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
        category: 'analysis',
        template: 'test',
        variables: [],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 5,
        },
      }
      engine.registerTemplate(template)

      const result = engine.getTemplate('test-get')

      expect(result).toBeDefined()
      expect(result?.name).toBe('Test')
    })

    it('should return undefined for unknown template', () => {
      const result = engine.getTemplate('unknown')

      expect(result).toBeUndefined()
    })
  })

  describe('getTemplatesByCategory', () => {
    beforeEach(() => {
      const templates: PromptTemplate[] = [
        {
          id: 'analysis-1',
          name: 'Analysis 1',
          description: 'Analysis template',
          version: '1.0.0',
          category: 'analysis',
          template: 'analysis',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 10,
          },
        },
        {
          id: 'report-1',
          name: 'Report 1',
          description: 'Report template',
          version: '1.0.0',
          category: 'report',
          template: 'report',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 10,
          },
        },
        {
          id: 'analysis-2',
          name: 'Analysis 2',
          description: 'Another analysis',
          version: '1.0.0',
          category: 'analysis',
          template: 'analysis2',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 10,
          },
        },
      ]
      engine.registerTemplates(templates)
    })

    it('should return templates by category', () => {
      const analysisTemplates = engine.getTemplatesByCategory('analysis')

      expect(analysisTemplates).toHaveLength(2)
      expect(analysisTemplates.every((t) => t.category === 'analysis')).toBe(true)
    })

    it('should return empty array for unknown category', () => {
      const result = engine.getTemplatesByCategory('unknown')

      expect(result).toHaveLength(0)
    })
  })

  describe('validate', () => {
    beforeEach(() => {
      const template: PromptTemplate = {
        id: 'validate-test',
        name: 'Validate Test',
        description: 'Test validation',
        version: '1.0.0',
        category: 'analysis',
        template: '{{value}}',
        variables: [
          { name: 'value', type: 'string', required: true, validation: { minLength: 5 } },
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 10,
        },
      }
      engine.registerTemplate(template)
    })

    it('should return valid for correct variables', () => {
      const result = engine.validate('validate-test', { value: 'hello world' })

      expect(result.valid).toBe(true)
    })

    it('should return invalid for constraint violation', () => {
      const result = engine.validate('validate-test', { value: 'hi' })

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should return invalid for unknown template', () => {
      const result = engine.validate('unknown', {})

      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('invalid_value')
    })
  })

  describe('listTemplates', () => {
    it('should list all templates', () => {
      const templates: PromptTemplate[] = [
        {
          id: 'list-1',
          name: 'List 1',
          description: 'List template 1',
          version: '1.0.0',
          category: 'analysis',
          template: 'list1',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 5,
          },
        },
        {
          id: 'list-2',
          name: 'List 2',
          description: 'List template 2',
          version: '1.0.0',
          category: 'report',
          template: 'list2',
          variables: [],
          metadata: {
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            estimatedTokens: 5,
          },
        },
      ]
      engine.registerTemplates(templates)

      const result = engine.listTemplates()

      expect(result.length).toBe(2)
    })
  })

  describe('clearCache', () => {
    it('should clear compiled cache', () => {
      const template: PromptTemplate = {
        id: 'cache-test',
        name: 'Cache Test',
        description: 'Cache test',
        version: '1.0.0',
        category: 'analysis',
        template: '{{value}}',
        variables: [{ name: 'value', type: 'string', required: true }],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 10,
        },
      }
      engine.registerTemplate(template)
      engine.compile('cache-test', { value: 'test' })

      engine.clearCache()

      expect(() => engine.compile('cache-test', { value: 'test' })).not.toThrow()
    })
  })

  describe('compile with various types', () => {
    beforeEach(() => {
      const template: PromptTemplate = {
        id: 'types-test',
        name: 'Types Test',
        description: 'Test various types',
        version: '1.0.0',
        category: 'analysis',
        template:
          'String: {{str}}, Number: {{num}}, Bool: {{bool}}, Array: {{arr}}, Object: {{obj}}',
        variables: [
          { name: 'str', type: 'string', required: true },
          { name: 'num', type: 'number', required: true },
          { name: 'bool', type: 'boolean', required: true },
          { name: 'arr', type: 'array', required: false },
          { name: 'obj', type: 'object', required: false },
        ],
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          estimatedTokens: 30,
        },
      }
      engine.registerTemplate(template)
    })

    it('should compile with all types', () => {
      const result = engine.compile('types-test', {
        str: 'hello',
        num: 42,
        bool: true,
        arr: ['a', 'b', 'c'],
        obj: { key: 'value' },
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.content).toContain('String: hello')
        expect(result.data.content).toContain('Number: 42')
        expect(result.data.content).toContain('Bool: true')
        expect(result.data.content).toContain('Array: a, b, c')
        expect(result.data.content).toContain('Object: {"key":"value"}')
      }
    })
  })
})

describe('validators', () => {
  describe('validateVariable', () => {
    it('should validate string type', () => {
      const result = validateVariable(COMMON_VARIABLES.companyName, 'Test Company')
      expect(result.valid).toBe(true)
    })

    it('should reject wrong type', () => {
      const result = validateVariable(COMMON_VARIABLES.companyName, 123)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('type_mismatch')
    })

    it('should validate enum constraints', () => {
      const result = validateVariable(COMMON_VARIABLES.language, 'fr')
      expect(result.valid).toBe(false)
    })

    it('should accept valid enum value', () => {
      const result = validateVariable(COMMON_VARIABLES.language, 'en')
      expect(result.valid).toBe(true)
    })

    it('should validate min/max number constraints', () => {
      const result = validateVariable(COMMON_VARIABLES.maxRecommendations, 25)
      expect(result.valid).toBe(false)
      expect(result.errors[0].code).toBe('constraint_violation')
    })

    it('should accept valid number in range', () => {
      const result = validateVariable(COMMON_VARIABLES.maxRecommendations, 10)
      expect(result.valid).toBe(true)
    })
  })
})
