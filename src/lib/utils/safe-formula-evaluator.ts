import { create, all, MathNode, MathJsInstance } from 'mathjs'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  usedVariables: string[]
  usedFunctions: string[]
}

export interface EvaluatorConfig {
  maxOperators: number
  maxNestingDepth: number
  maxFormulaLength: number
  divisionByZeroBehavior: 'infinity' | 'null' | 'error'
}

const DEFAULT_CONFIG: EvaluatorConfig = {
  maxOperators: 50,
  maxNestingDepth: 10,
  maxFormulaLength: 10000,
  divisionByZeroBehavior: 'infinity',
}

const ALLOWED_MATH_FUNCTIONS: readonly string[] = [
  'abs',
  'ceil',
  'floor',
  'round',
  'sqrt',
  'pow',
  'log',
  'log10',
  'exp',
  'sign',
] as const

const ALLOWED_STATISTICAL_FUNCTIONS: readonly string[] = [
  'sum',
  'mean',
  'min',
  'max',
  'median',
  'mode',
  'variance',
  'std',
] as const

const ALLOWED_CUSTOM_FUNCTIONS: readonly string[] = ['avg', 'count', 'if'] as const

const DANGEROUS_PATTERNS: readonly RegExp[] = [
  /\beval\b/gi,
  /\bFunction\b/gi,
  /\brequire\b/gi,
  /\bimport\b/gi,
  /\bwindow\b/gi,
  /\bglobal\b/gi,
  /\bprocess\b/gi,
  /\bconstructor\b/gi,
  /\bprototype\b/gi,
  /\b__proto__\b/gi,
  /\bthis\b/gi,
  /\barguments\b/gi,
  /\bcallee\b/gi,
  /\bcaller\b/gi,
] as const

const ALL_ALLOWED_FUNCTIONS = new Set([
  ...ALLOWED_MATH_FUNCTIONS,
  ...ALLOWED_STATISTICAL_FUNCTIONS,
  ...ALLOWED_CUSTOM_FUNCTIONS,
])

export class SafeFormulaEvaluator {
  private readonly allowedVariables: Set<string>
  private readonly config: EvaluatorConfig
  private readonly math: MathJsInstance

  constructor(variables: string[], config: Partial<EvaluatorConfig> = {}) {
    this.allowedVariables = new Set(variables)
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.math = create(all, {
      number: 'number',
    })
  }

  evaluate(formula: string, context: Record<string, number>): number | null {
    const validation = this.validate(formula)
    if (!validation.isValid) {
      throw new FormulaError(`Invalid formula: ${validation.errors.join(', ')}`)
    }

    for (const key of Object.keys(context)) {
      if (!this.allowedVariables.has(key)) {
        throw new FormulaError(`Unknown variable: ${key}`)
      }
    }

    try {
      const compiled = this.math.compile(formula)
      const scope = this.buildScope(context)
      const result = compiled.evaluate(scope)

      if (typeof result !== 'number') {
        if (Array.isArray(result)) {
          throw new FormulaError('Formula returned an array, expected a number')
        }
        throw new FormulaError('Formula did not return a number')
      }

      if (!Number.isFinite(result) || Number.isNaN(result)) {
        return this.handleNonFinite(result)
      }

      return result
    } catch (error) {
      if (error instanceof FormulaError) {
        throw error
      }
      throw new FormulaError(
        `Evaluation error: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  validate(formula: string): ValidationResult {
    const errors: string[] = []
    const usedVariables: string[] = []
    const usedFunctions: string[] = []

    if (typeof formula !== 'string') {
      errors.push('Formula must be a string')
      return { isValid: false, errors, usedVariables, usedFunctions }
    }

    if (formula.length === 0) {
      errors.push('Formula cannot be empty')
      return { isValid: false, errors, usedVariables, usedFunctions }
    }

    if (formula.length > this.config.maxFormulaLength) {
      errors.push(`Formula exceeds maximum length of ${this.config.maxFormulaLength} characters`)
    }

    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(formula)) {
        errors.push(`Formula contains dangerous pattern: ${pattern.source}`)
      }
    }

    let ast: MathNode
    try {
      ast = this.math.parse(formula)
    } catch (error) {
      errors.push(`Syntax error: ${error instanceof Error ? error.message : String(error)}`)
      return { isValid: false, errors, usedVariables, usedFunctions }
    }

    const complexity = this.analyzeComplexity(ast)
    if (complexity.operatorCount > this.config.maxOperators) {
      errors.push(`Formula exceeds maximum operator count of ${this.config.maxOperators}`)
    }
    if (complexity.nestingDepth > this.config.maxNestingDepth) {
      errors.push(`Formula exceeds maximum nesting depth of ${this.config.maxNestingDepth}`)
    }

    ast.traverse((node: MathNode) => {
      if (node.type === 'SymbolNode') {
        const symbolNode = node as unknown as { name: string }
        const name = symbolNode.name

        if (ALL_ALLOWED_FUNCTIONS.has(name)) {
          if (!usedFunctions.includes(name)) {
            usedFunctions.push(name)
          }
        } else if (this.allowedVariables.has(name)) {
          if (!usedVariables.includes(name)) {
            usedVariables.push(name)
          }
        } else if (this.math[name as keyof MathJsInstance] !== undefined) {
          if (!ALL_ALLOWED_FUNCTIONS.has(name)) {
            errors.push(`Function not allowed: ${name}`)
          }
        } else {
          errors.push(`Unknown variable or function: ${name}`)
        }
      }

      if (node.type === 'FunctionNode') {
        const funcNode = node as unknown as { fn: { name: string } }
        const funcName = funcNode.fn.name

        if (!ALL_ALLOWED_FUNCTIONS.has(funcName) && !this.math[funcName as keyof MathJsInstance]) {
          errors.push(`Function not allowed: ${funcName}`)
        }
      }

      if (node.type === 'CallNode') {
        errors.push('Function calls are not allowed')
      }
    })

    return {
      isValid: errors.length === 0,
      errors,
      usedVariables,
      usedFunctions,
    }
  }

  private buildScope(context: Record<string, number>): Record<string, unknown> {
    const scope: Record<string, unknown> = { ...context }

    for (const func of ALLOWED_MATH_FUNCTIONS) {
      const mathFunc = this.math[func as keyof MathJsInstance]
      if (typeof mathFunc === 'function') {
        scope[func] = mathFunc
      }
    }

    scope.sum = (...args: number[]) => {
      const values = this.flatten(args)
      return values.reduce((a, b) => a + b, 0)
    }

    scope.avg = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      return values.reduce((a, b) => a + b, 0) / values.length
    }

    scope.mean = scope.avg

    scope.min = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      return Math.min(...values)
    }

    scope.max = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      return Math.max(...values)
    }

    scope.count = (...args: number[]) => {
      return this.flatten(args).length
    }

    scope.median = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      const sorted = [...values].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }

    scope.mode = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      const counts = new Map<number, number>()
      for (const v of values) {
        counts.set(v, (counts.get(v) ?? 0) + 1)
      }
      let maxCount = 0
      let mode = values[0]
      for (const [value, count] of counts) {
        if (count > maxCount) {
          maxCount = count
          mode = value
        }
      }
      return mode
    }

    scope.variance = (...args: number[]) => {
      const values = this.flatten(args)
      if (values.length === 0) return 0
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    }

    scope.std = (...args: number[]) => {
      const varianceFn = scope.variance as (...args: number[]) => number
      const variance = varianceFn(...args)
      return Math.sqrt(variance)
    }

    scope.if = (condition: number | boolean, trueValue: number, falseValue: number) => {
      return condition ? trueValue : falseValue
    }

    return scope
  }

  private flatten(args: number[]): number[] {
    const result: number[] = []
    for (const arg of args) {
      if (Array.isArray(arg)) {
        result.push(...this.flatten(arg as unknown as number[]))
      } else if (typeof arg === 'number') {
        result.push(arg)
      }
    }
    return result
  }

  private analyzeComplexity(ast: MathNode): { operatorCount: number; nestingDepth: number } {
    let operatorCount = 0
    let maxNestingDepth = 0

    const traverse = (node: MathNode, depth: number) => {
      if (node.type === 'OperatorNode' || node.type === 'FunctionNode') {
        operatorCount++
        maxNestingDepth = Math.max(maxNestingDepth, depth)
      }

      for (const child of Object.values(node)) {
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            for (const item of child) {
              if (item && typeof item === 'object' && 'type' in item) {
                traverse(item as MathNode, depth + 1)
              }
            }
          } else if ('type' in child) {
            traverse(child as MathNode, depth + 1)
          }
        }
      }
    }

    traverse(ast, 0)

    return { operatorCount, nestingDepth: maxNestingDepth }
  }

  private handleNonFinite(result: number): number | null {
    switch (this.config.divisionByZeroBehavior) {
      case 'infinity':
        return result
      case 'null':
        return null
      case 'error':
        throw new FormulaError('Division by zero or non-finite result')
      default:
        return result
    }
  }
}

export class FormulaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormulaError'
  }
}

export function createFormulaEvaluator(
  variables: string[],
  config?: Partial<EvaluatorConfig>
): SafeFormulaEvaluator {
  return new SafeFormulaEvaluator(variables, config)
}
