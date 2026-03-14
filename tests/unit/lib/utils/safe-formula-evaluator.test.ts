import {
  SafeFormulaEvaluator,
  FormulaError,
  createFormulaEvaluator,
  ValidationResult,
} from '@/lib/utils/safe-formula-evaluator'

describe('SafeFormulaEvaluator', () => {
  const defaultVariables = ['revenue', 'expense', 'profit', 'a', 'b', 'c', 'x', 'y', 'z']
  let evaluator: SafeFormulaEvaluator

  beforeEach(() => {
    evaluator = new SafeFormulaEvaluator(defaultVariables)
  })

  describe('constructor', () => {
    it('should create evaluator with allowed variables', () => {
      expect(evaluator).toBeInstanceOf(SafeFormulaEvaluator)
    })

    it('should accept custom config', () => {
      const customEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        maxOperators: 10,
        divisionByZeroBehavior: 'error',
      })
      expect(customEvaluator).toBeInstanceOf(SafeFormulaEvaluator)
    })
  })

  describe('evaluate - basic operations', () => {
    it('should evaluate simple addition', () => {
      expect(evaluator.evaluate('a + b', { a: 5, b: 3 })).toBe(8)
    })

    it('should evaluate simple subtraction', () => {
      expect(evaluator.evaluate('a - b', { a: 10, b: 3 })).toBe(7)
    })

    it('should evaluate simple multiplication', () => {
      expect(evaluator.evaluate('a * b', { a: 4, b: 5 })).toBe(20)
    })

    it('should evaluate simple division', () => {
      expect(evaluator.evaluate('a / b', { a: 15, b: 3 })).toBe(5)
    })

    it('should evaluate with parentheses', () => {
      expect(evaluator.evaluate('(a + b) * c', { a: 2, b: 3, c: 4 })).toBe(20)
    })

    it('should evaluate power', () => {
      expect(evaluator.evaluate('a ^ 2', { a: 5 })).toBe(25)
    })

    it('should evaluate modulo', () => {
      expect(evaluator.evaluate('a % b', { a: 10, b: 3 })).toBe(1)
    })

    it('should evaluate negative numbers', () => {
      expect(evaluator.evaluate('a + b', { a: -5, b: 3 })).toBe(-2)
    })

    it('should evaluate decimal numbers', () => {
      expect(evaluator.evaluate('a * b', { a: 2.5, b: 4 })).toBe(10)
    })

    it('should evaluate complex formula', () => {
      expect(evaluator.evaluate('((a + b) * c) - (x / y)', { a: 1, b: 2, c: 3, x: 6, y: 2 })).toBe(
        6
      )
    })
  })

  describe('evaluate - financial formulas', () => {
    it('should calculate profit margin', () => {
      const result = evaluator.evaluate('profit / revenue * 100', { revenue: 1000, profit: 200 })
      expect(result).toBe(20)
    })

    it('should calculate expense ratio', () => {
      const result = evaluator.evaluate('expense / revenue', { revenue: 1000, expense: 300 })
      expect(result).toBe(0.3)
    })
  })

  describe('evaluate - built-in math functions', () => {
    it('should evaluate abs', () => {
      expect(evaluator.evaluate('abs(a)', { a: -5 })).toBe(5)
    })

    it('should evaluate ceil', () => {
      expect(evaluator.evaluate('ceil(a)', { a: 3.2 })).toBe(4)
    })

    it('should evaluate floor', () => {
      expect(evaluator.evaluate('floor(a)', { a: 3.8 })).toBe(3)
    })

    it('should evaluate round', () => {
      expect(evaluator.evaluate('round(a)', { a: 3.5 })).toBe(4)
    })

    it('should evaluate sqrt', () => {
      expect(evaluator.evaluate('sqrt(a)', { a: 16 })).toBe(4)
    })

    it('should evaluate pow', () => {
      expect(evaluator.evaluate('pow(a, 3)', { a: 2 })).toBe(8)
    })

    it('should evaluate log', () => {
      expect(evaluator.evaluate('log(a)', { a: Math.E })).toBeCloseTo(1)
    })

    it('should evaluate log10', () => {
      expect(evaluator.evaluate('log10(a)', { a: 100 })).toBe(2)
    })

    it('should evaluate exp', () => {
      expect(evaluator.evaluate('exp(a)', { a: 0 })).toBe(1)
    })

    it('should evaluate sign', () => {
      expect(evaluator.evaluate('sign(a)', { a: -5 })).toBe(-1)
      expect(evaluator.evaluate('sign(a)', { a: 5 })).toBe(1)
      expect(evaluator.evaluate('sign(a)', { a: 0 })).toBe(0)
    })
  })

  describe('evaluate - statistical functions', () => {
    it('should evaluate sum', () => {
      expect(evaluator.evaluate('sum(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(6)
    })

    it('should evaluate avg', () => {
      expect(evaluator.evaluate('avg(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(2)
    })

    it('should evaluate mean (alias for avg)', () => {
      expect(evaluator.evaluate('mean(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(2)
    })

    it('should evaluate min', () => {
      expect(evaluator.evaluate('min(a, b, c)', { a: 5, b: 2, c: 8 })).toBe(2)
    })

    it('should evaluate max', () => {
      expect(evaluator.evaluate('max(a, b, c)', { a: 5, b: 2, c: 8 })).toBe(8)
    })

    it('should evaluate count', () => {
      expect(evaluator.evaluate('count(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(3)
    })

    it('should evaluate median', () => {
      expect(evaluator.evaluate('median(a, b, c)', { a: 1, b: 2, c: 3 })).toBe(2)
      expect(evaluator.evaluate('median(a, b, c, x)', { a: 1, b: 2, c: 3, x: 4 })).toBe(2.5)
    })

    it('should evaluate variance', () => {
      const result = evaluator.evaluate('variance(a, b, c)', { a: 2, b: 4, c: 6 })
      expect(result).toBeCloseTo(2.666666, 4)
    })

    it('should evaluate std', () => {
      const result = evaluator.evaluate('std(a, b, c)', { a: 2, b: 4, c: 6 })
      expect(result).toBeCloseTo(1.632993, 4)
    })
  })

  describe('evaluate - conditional function', () => {
    it('should evaluate if with true condition', () => {
      expect(evaluator.evaluate('if(a > b, a, b)', { a: 10, b: 5 })).toBe(10)
    })

    it('should evaluate if with false condition', () => {
      expect(evaluator.evaluate('if(a > b, a, b)', { a: 3, b: 5 })).toBe(5)
    })

    it('should evaluate nested if', () => {
      const result = evaluator.evaluate('if(a > 10, 1, if(a > 5, 2, 3))', { a: 7 })
      expect(result).toBe(2)
    })
  })

  describe('validate', () => {
    it('should validate a correct formula', () => {
      const result = evaluator.validate('a + b * c')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.usedVariables).toContain('a')
      expect(result.usedVariables).toContain('b')
      expect(result.usedVariables).toContain('c')
    })

    it('should detect unknown variable', () => {
      const result = evaluator.validate('unknown + a')
      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual(expect.stringContaining('Unknown variable'))
    })

    it('should detect disallowed function', () => {
      const result = evaluator.validate('eval("1+1")')
      expect(result.isValid).toBe(false)
    })

    it('should return empty arrays for empty formula', () => {
      const result = evaluator.validate('')
      expect(result.isValid).toBe(false)
      expect(result.usedVariables).toHaveLength(0)
      expect(result.usedFunctions).toHaveLength(0)
    })

    it('should detect used functions', () => {
      const result = evaluator.validate('sum(a, b) + max(c, x)')
      expect(result.isValid).toBe(true)
      expect(result.usedFunctions).toContain('sum')
      expect(result.usedFunctions).toContain('max')
    })
  })

  describe('security - injection prevention', () => {
    it('should reject eval', () => {
      expect(() => evaluator.evaluate('eval("process.exit(1)")', {})).toThrow()
    })

    it('should reject Function constructor', () => {
      expect(() => evaluator.evaluate('Function("return this")()', {})).toThrow()
    })

    it('should reject require', () => {
      const result = evaluator.validate('require("fs")')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('dangerous pattern'))).toBe(true)
    })

    it('should reject import', () => {
      const result = evaluator.validate('import("fs")')
      expect(result.isValid).toBe(false)
    })

    it('should reject window access', () => {
      const result = evaluator.validate('window.location')
      expect(result.isValid).toBe(false)
    })

    it('should reject global access', () => {
      const result = evaluator.validate('global.process')
      expect(result.isValid).toBe(false)
    })

    it('should reject process access', () => {
      const result = evaluator.validate('process.env')
      expect(result.isValid).toBe(false)
    })

    it('should reject constructor access', () => {
      const result = evaluator.validate('a.constructor')
      expect(result.isValid).toBe(false)
    })

    it('should reject prototype access', () => {
      const result = evaluator.validate('a.prototype')
      expect(result.isValid).toBe(false)
    })

    it('should reject __proto__ access', () => {
      const result = evaluator.validate('a.__proto__')
      expect(result.isValid).toBe(false)
    })

    it('should reject this keyword', () => {
      const result = evaluator.validate('this')
      expect(result.isValid).toBe(false)
    })

    it('should reject arguments', () => {
      const result = evaluator.validate('arguments.callee')
      expect(result.isValid).toBe(false)
    })

    it('should reject code in string literals', () => {
      expect(() => evaluator.evaluate('eval("1+1")', {})).toThrow()
    })

    it('should reject unknown functions', () => {
      const result = evaluator.validate('fetch("http://evil.com")')
      expect(result.isValid).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should throw on undefined variable in context', () => {
      expect(() => evaluator.evaluate('a + b', { a: 1 })).toThrow(FormulaError)
    })

    it('should throw on unknown variable in context', () => {
      expect(() => evaluator.evaluate('a + b', { a: 1, b: 2, unknown: 3 })).toThrow(FormulaError)
    })

    it('should throw on syntax error', () => {
      expect(() => evaluator.evaluate('a +', { a: 1 })).toThrow(FormulaError)
    })

    it('should throw on mismatched parentheses', () => {
      expect(() => evaluator.evaluate('(a + b', { a: 1, b: 2 })).toThrow(FormulaError)
    })

    it('should throw on non-string formula', () => {
      expect(() => evaluator.evaluate(null as unknown as string, {})).toThrow(FormulaError)
    })

    it('should throw on empty formula', () => {
      expect(() => evaluator.evaluate('', {})).toThrow(FormulaError)
    })
  })

  describe('division by zero handling', () => {
    it('should return Infinity by default', () => {
      const result = evaluator.evaluate('a / 0', { a: 1 })
      expect(result).toBe(Infinity)
    })

    it('should return null when configured', () => {
      const nullEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        divisionByZeroBehavior: 'null',
      })
      const result = nullEvaluator.evaluate('a / 0', { a: 1 })
      expect(result).toBeNull()
    })

    it('should throw error when configured', () => {
      const errorEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        divisionByZeroBehavior: 'error',
      })
      expect(() => errorEvaluator.evaluate('a / 0', { a: 1 })).toThrow(FormulaError)
    })

    it('should return -Infinity for negative divided by zero', () => {
      const result = evaluator.evaluate('a / 0', { a: -1 })
      expect(result).toBe(-Infinity)
    })
  })

  describe('complexity limits', () => {
    it('should reject formula exceeding max operators', () => {
      const limitedEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        maxOperators: 3,
      })
      const result = limitedEvaluator.validate('a + b + c + x + y + z')
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('operator count'))).toBe(true)
    })

    it('should reject formula exceeding max nesting depth', () => {
      const limitedEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        maxNestingDepth: 3,
      })
      const result = limitedEvaluator.validate(
        'if(a > 0, if(b > 0, if(c > 0, if(x > 0, 1, 2), 3), 4), 5)'
      )
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('nesting depth'))).toBe(true)
    })

    it('should reject formula exceeding max length', () => {
      const limitedEvaluator = new SafeFormulaEvaluator(defaultVariables, {
        maxFormulaLength: 50,
      })
      const longFormula = 'a + '.repeat(50) + 'b'
      const result = limitedEvaluator.validate(longFormula)
      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.includes('maximum length'))).toBe(true)
    })
  })

  describe('type coercion', () => {
    it('should handle string numbers in context', () => {
      expect(evaluator.evaluate('a + b', { a: '5' as unknown as number, b: 3 })).toBe(8)
    })
  })
})

describe('createFormulaEvaluator', () => {
  it('should create evaluator with default config', () => {
    const evaluator = createFormulaEvaluator(['a', 'b'])
    expect(evaluator).toBeInstanceOf(SafeFormulaEvaluator)
    expect(evaluator.evaluate('a + b', { a: 1, b: 2 })).toBe(3)
  })

  it('should create evaluator with custom config', () => {
    const evaluator = createFormulaEvaluator(['a'], { divisionByZeroBehavior: 'null' })
    expect(evaluator.evaluate('a / 0', { a: 1 })).toBeNull()
  })
})

describe('Performance', () => {
  it('should evaluate 1000 times under 1 second', () => {
    const evaluator = new SafeFormulaEvaluator(['a', 'b', 'c'])
    const formula = '(a + b) * c - a / b'
    const context = { a: 10, b: 5, c: 3 }

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      evaluator.evaluate(formula, context)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1000)
  })

  it('should validate 1000 times under 1 second', () => {
    const evaluator = new SafeFormulaEvaluator(['a', 'b', 'c'])
    const formula = 'sum(a, b, c) + max(a, b) * min(b, c)'

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      evaluator.validate(formula)
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1000)
  })
})

describe('Edge cases', () => {
  let evaluator: SafeFormulaEvaluator

  beforeEach(() => {
    evaluator = new SafeFormulaEvaluator(['a', 'b', 'c'])
  })

  it('should handle zero correctly', () => {
    expect(evaluator.evaluate('a + 0', { a: 5 })).toBe(5)
    expect(evaluator.evaluate('a * 0', { a: 5 })).toBe(0)
    expect(evaluator.evaluate('0 / a', { a: 5 })).toBe(0)
  })

  it('should handle very large numbers', () => {
    const result = evaluator.evaluate('a * b', { a: 1e15, b: 1e15 })
    expect(result).toBe(1e30)
  })

  it('should handle very small numbers', () => {
    const result = evaluator.evaluate('a * b', { a: 1e-15, b: 1e-15 })
    expect(result).toBe(1e-30)
  })

  it('should throw on complex number result', () => {
    expect(() => evaluator.evaluate('sqrt(a)', { a: -1 })).toThrow(FormulaError)
  })

  it('should handle empty statistical functions', () => {
    expect(evaluator.evaluate('count()', {})).toBe(0)
    expect(evaluator.evaluate('sum()', {})).toBe(0)
    expect(evaluator.evaluate('avg()', {})).toBe(0)
  })

  it('should handle whitespace in formula', () => {
    expect(evaluator.evaluate('  a   +   b  ', { a: 1, b: 2 })).toBe(3)
  })

  it('should handle unary operators', () => {
    expect(evaluator.evaluate('-a', { a: 5 })).toBe(-5)
    expect(evaluator.evaluate('+a', { a: 5 })).toBe(5)
  })

  it('should handle scientific notation', () => {
    expect(evaluator.evaluate('a + 1e3', { a: 0 })).toBe(1000)
    expect(evaluator.evaluate('a + 1e-3', { a: 0 })).toBe(0.001)
  })
})
