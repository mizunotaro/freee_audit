import type {
  PromptTemplate,
  CompiledTemplate,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TemplateResult,
} from './template-types'
import { validateVariable, transformValue, sanitizeValue } from './validators'

class TemplateEngine {
  private templates: Map<string, PromptTemplate> = new Map()
  private compiledCache: Map<string, CompiledTemplate> = new Map()
  private maxCacheSize: number = 100

  registerTemplate(template: PromptTemplate): TemplateResult<void> {
    const validation = this.validateTemplateDefinition(template)
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'invalid_template',
          message: 'Template validation failed',
          details: { errors: validation.errors },
        },
      }
    }

    if (this.templates.has(template.id)) {
      const existing = this.templates.get(template.id)!
      if (existing.version === template.version) {
        return { success: true, data: undefined }
      }
      this.compiledCache.delete(template.id)
    }

    this.templates.set(template.id, template)
    return { success: true, data: undefined }
  }

  registerTemplates(templates: readonly PromptTemplate[]): TemplateResult<number> {
    let successCount = 0
    const errors: Array<{ templateId: string; error: string }> = []

    for (const template of templates) {
      const result = this.registerTemplate(template)
      if (result.success) {
        successCount++
      } else {
        errors.push({ templateId: template.id, error: result.error.message })
      }
    }

    if (errors.length > 0 && successCount === 0) {
      return {
        success: false,
        error: {
          code: 'all_registrations_failed',
          message: 'All template registrations failed',
          details: { errors },
        },
      }
    }

    return { success: true, data: successCount }
  }

  getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId)
  }

  getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values()).filter((t) => t.category === category)
  }

  compile(
    templateId: string,
    variables: Record<string, unknown>
  ): TemplateResult<CompiledTemplate> {
    const template = this.templates.get(templateId)
    if (!template) {
      return {
        success: false,
        error: {
          code: 'template_not_found',
          message: `Template ${templateId} not found`,
        },
      }
    }

    const cacheKey = this.getCacheKey(templateId, variables)
    const cached = this.compiledCache.get(cacheKey)
    if (cached) {
      return { success: true, data: cached }
    }

    const validation = this.validateVariables(template, variables)
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: 'validation_failed',
          message: 'Variable validation failed',
          details: { errors: validation.errors },
        },
      }
    }

    const startTime = Date.now()
    const preparedVariables = this.prepareVariables(template, variables, validation.warnings)
    const content = this.renderTemplate(template.template, preparedVariables)
    const estimatedTokens = this.estimateTokens(content)
    const compilationTimeMs = Date.now() - startTime

    const compiled: CompiledTemplate = {
      templateId,
      content,
      estimatedTokens,
      variablesUsed: Object.keys(preparedVariables),
      compilationTimeMs,
    }

    this.cacheCompiled(cacheKey, compiled)

    return { success: true, data: compiled }
  }

  validate(templateId: string, variables: Record<string, unknown>): ValidationResult {
    const template = this.templates.get(templateId)
    if (!template) {
      return {
        valid: false,
        errors: [
          {
            variable: '_template',
            code: 'invalid_value',
            message: `Template ${templateId} not found`,
          },
        ],
        warnings: [],
      }
    }

    return this.validateVariables(template, variables)
  }

  listTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values())
  }

  clearCache(): void {
    this.compiledCache.clear()
  }

  private validateTemplateDefinition(template: PromptTemplate): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    if (!template.id || template.id.trim().length === 0) {
      errors.push({
        variable: 'id',
        code: 'required_missing',
        message: 'Template ID is required',
      })
    }

    if (!template.template || template.template.trim().length === 0) {
      errors.push({
        variable: 'template',
        code: 'required_missing',
        message: 'Template content is required',
      })
    }

    const variableNames = new Set<string>()
    for (const variable of template.variables) {
      if (variableNames.has(variable.name)) {
        errors.push({
          variable: variable.name,
          code: 'invalid_value',
          message: `Duplicate variable name: ${variable.name}`,
        })
      }
      variableNames.add(variable.name)

      if (variable.defaultValue !== undefined) {
        const defaultValidation = validateVariable(variable, variable.defaultValue)
        if (!defaultValidation.valid) {
          warnings.push({
            variable: variable.name,
            code: 'default_used',
            message: `Default value may not satisfy constraints`,
          })
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  private validateVariables(
    template: PromptTemplate,
    variables: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    for (const variable of template.variables) {
      const value = variables[variable.name]

      if (value === undefined || value === null) {
        if (variable.required && variable.defaultValue === undefined) {
          errors.push({
            variable: variable.name,
            code: 'required_missing',
            message: `Required variable ${variable.name} is missing`,
          })
          continue
        }

        if (variable.defaultValue !== undefined) {
          warnings.push({
            variable: variable.name,
            code: 'default_used',
            message: `Using default value for ${variable.name}`,
          })
        }
        continue
      }

      const validation = validateVariable(variable, value)
      errors.push(
        ...validation.errors.map((e) => ({
          ...e,
          variable: variable.name,
        }))
      )
      warnings.push(
        ...validation.warnings.map((w) => ({
          ...w,
          variable: variable.name,
        }))
      )
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  private prepareVariables(
    template: PromptTemplate,
    variables: Record<string, unknown>,
    _warnings: readonly ValidationWarning[]
  ): Record<string, unknown> {
    const prepared: Record<string, unknown> = {}

    for (const variable of template.variables) {
      let value = variables[variable.name]

      if (value === undefined || value === null) {
        value = variable.defaultValue
      }

      if (value === undefined || value === null) {
        continue
      }

      value = transformValue(value, variable.transform)
      value = sanitizeValue(value, variable)

      prepared[variable.name] = value
    }

    return prepared
  }

  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let result = template

    const sortedKeys = Object.keys(variables).sort((a, b) => b.length - a.length)

    for (const key of sortedKeys) {
      const value = variables[key]
      const placeholder = `{{${key}}}`
      const stringValue = this.valueToString(value)
      result = result.split(placeholder).join(stringValue)
    }

    result = result.replace(/\{\{[^}]+\}\}/g, '')

    return result
  }

  private valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }

    if (typeof value === 'string') {
      return value
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }

    if (value instanceof Date) {
      return value.toISOString()
    }

    if (Array.isArray(value)) {
      return value.map((v) => this.valueToString(v)).join(', ')
    }

    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  private getCacheKey(templateId: string, variables: Record<string, unknown>): string {
    const sortedVars = Object.keys(variables)
      .sort()
      .map((k) => `${k}=${JSON.stringify(variables[k])}`)
      .join('&')
    return `${templateId}:${sortedVars}`
  }

  private cacheCompiled(key: string, compiled: CompiledTemplate): void {
    if (this.compiledCache.size >= this.maxCacheSize) {
      const firstKey = this.compiledCache.keys().next().value
      if (firstKey) {
        this.compiledCache.delete(firstKey)
      }
    }
    this.compiledCache.set(key, compiled)
  }
}

export const templateEngine = new TemplateEngine()

export { TemplateEngine }
