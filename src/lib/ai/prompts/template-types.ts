export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date'

export interface TemplateVariable {
  readonly name: string
  readonly type: VariableType
  readonly required: boolean
  readonly defaultValue?: unknown
  readonly validation?: {
    readonly minLength?: number
    readonly maxLength?: number
    readonly min?: number
    readonly max?: number
    readonly pattern?: string
    readonly enum?: readonly string[]
  }
  readonly description?: string
  readonly transform?: 'uppercase' | 'lowercase' | 'trim' | 'sanitize'
}

export interface PromptTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly version: string
  readonly category: 'analysis' | 'report' | 'chat' | 'system' | 'custom'
  readonly template: string
  readonly variables: readonly TemplateVariable[]
  readonly metadata: {
    readonly author?: string
    readonly createdAt: Date
    readonly updatedAt: Date
    readonly tags: readonly string[]
    readonly estimatedTokens: number
  }
}

export interface CompiledTemplate {
  readonly templateId: string
  readonly content: string
  readonly estimatedTokens: number
  readonly variablesUsed: readonly string[]
  readonly compilationTimeMs: number
}

export interface ValidationResult {
  readonly valid: boolean
  readonly errors: readonly ValidationError[]
  readonly warnings: readonly ValidationWarning[]
}

export interface ValidationError {
  readonly variable: string
  readonly code: 'required_missing' | 'type_mismatch' | 'constraint_violation' | 'invalid_value'
  readonly message: string
  readonly value?: unknown
}

export interface ValidationWarning {
  readonly variable: string
  readonly code: 'default_used' | 'value_truncated' | 'pattern_approximation'
  readonly message: string
}

export interface TemplateRegistry {
  readonly templates: readonly PromptTemplate[]
  readonly categories: readonly string[]
  readonly version: string
}

export type TemplateResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: Record<string, unknown> } }
