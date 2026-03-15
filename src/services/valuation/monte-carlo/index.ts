import * as ss from 'simple-statistics'
import type {
  MonteCarloInputs,
  MonteCarloResult,
  MonteCarloVariable,
  DistributionConfig,
  CalculationStep,
  Result,
  ValuationError,
} from '../types'

const _VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `mc_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

class SeededRandom {
  private seed: number

  constructor(seed: number) {
    this.seed = seed
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000
    return x - Math.floor(x)
  }
}

function sampleNormal(mean: number, stdDev: number, rng: () => number): number {
  let u1 = rng()
  const u2 = rng()
  while (u1 === 0) u1 = rng()

  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + z * stdDev
}

function sampleLogNormal(mean: number, stdDev: number, rng: () => number): number {
  const normal = sampleNormal(mean, stdDev, rng)
  return Math.exp(normal)
}

function sampleUniform(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min)
}

function sampleTriangular(min: number, max: number, mode: number, rng: () => number): number {
  const u = rng()
  const fc = (mode - min) / (max - min)

  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min))
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode))
  }
}

function inverseNormalCdf(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  if (p === 0.5) return 0

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ]
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  let q: number, r: number

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    r = ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
    return r / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    r = q * ((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]
    return (r / ((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4])) * r + 1
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    r = ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
    return -r / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
}

function sampleDistribution(config: DistributionConfig, rng: () => number): number {
  const { type, params } = config

  switch (type) {
    case 'normal':
      if (params.mean === undefined || params.stdDev === undefined) {
        throw new Error('Normal distribution requires mean and stdDev')
      }
      return sampleNormal(params.mean, params.stdDev, rng)

    case 'lognormal':
      if (params.mean === undefined || params.stdDev === undefined) {
        throw new Error('Lognormal distribution requires mean and stdDev')
      }
      return sampleLogNormal(params.mean, params.stdDev, rng)

    case 'uniform':
      if (params.min === undefined || params.max === undefined) {
        throw new Error('Uniform distribution requires min and max')
      }
      return sampleUniform(params.min, params.max, rng)

    case 'triangular':
      if (params.min === undefined || params.max === undefined || params.mode === undefined) {
        throw new Error('Triangular distribution requires min, max, and mode')
      }
      return sampleTriangular(params.min, params.max, params.mode, rng)

    default:
      throw new Error(`Unknown distribution type: ${type}`)
  }
}

function validateInputs(inputs: MonteCarloInputs): Result<true> {
  if (!inputs.variables || inputs.variables.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'At least one variable is required'),
    }
  }

  if (inputs.iterations < 100 || inputs.iterations > 1000000) {
    return {
      success: false,
      error: createError('invalid_input', 'Iterations must be between 100 and 1,000,000'),
    }
  }

  if (!inputs.formula || inputs.formula.trim() === '') {
    return {
      success: false,
      error: createError('invalid_input', 'Formula is required'),
    }
  }

  for (const variable of inputs.variables) {
    const { name, distribution } = variable

    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return {
        success: false,
        error: createError('invalid_input', `Invalid variable name: ${name}`),
      }
    }

    const { type, params } = distribution

    switch (type) {
      case 'normal':
      case 'lognormal':
        if (params.mean === undefined || params.stdDev === undefined) {
          return {
            success: false,
            error: createError(
              'invalid_input',
              `${type} distribution for ${name} requires mean and stdDev`
            ),
          }
        }
        if (params.stdDev < 0) {
          return {
            success: false,
            error: createError('invalid_input', `stdDev for ${name} must be non-negative`),
          }
        }
        break

      case 'uniform':
        if (params.min === undefined || params.max === undefined) {
          return {
            success: false,
            error: createError(
              'invalid_input',
              `Uniform distribution for ${name} requires min and max`
            ),
          }
        }
        if (params.min > params.max) {
          return {
            success: false,
            error: createError(
              'invalid_input',
              `min must be less than or equal to max for ${name}`
            ),
          }
        }
        break

      case 'triangular':
        if (params.min === undefined || params.max === undefined || params.mode === undefined) {
          return {
            success: false,
            error: createError(
              'invalid_input',
              `Triangular distribution for ${name} requires min, max, and mode`
            ),
          }
        }
        if (params.min > params.mode || params.mode > params.max) {
          return {
            success: false,
            error: createError('invalid_input', `For ${name}: min <= mode <= max is required`),
          }
        }
        break
    }
  }

  return { success: true, data: true }
}

function evaluateFormula(formula: string, variables: Record<string, number>): number {
  let expr = formula

  const sortedNames = Object.keys(variables).sort((a, b) => b.length - a.length)

  for (const name of sortedNames) {
    const value = variables[name]
    const regex = new RegExp(`\\b${name}\\b`, 'g')
    expr = expr.replace(regex, `(${value})`)
  }

  const allowedPattern = /^[\d\s+\-*/().^%]+$/
  if (!allowedPattern.test(expr)) {
    throw new Error(`Formula contains invalid characters: ${expr}`)
  }

  expr = expr.replace(/\^/g, '**')

  try {
    const result = Function(`"use strict"; return (${expr})`)()
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Formula evaluation resulted in non-finite number')
    }
    return result
  } catch (error) {
    throw new Error(
      `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

export function runMonteCarloSimulation(inputs: MonteCarloInputs): Result<MonteCarloResult> {
  const validation = validateInputs(inputs)
  if (!validation.success) {
    return validation
  }

  const startTime = performance.now()
  const { variables, formula, iterations, seed } = inputs

  const rng =
    seed !== undefined ? new SeededRandom(seed).next.bind(new SeededRandom(seed)) : Math.random

  const results: number[] = []

  try {
    for (let i = 0; i < iterations; i++) {
      const sampledValues: Record<string, number> = {}

      for (const variable of variables) {
        sampledValues[variable.name] = sampleDistribution(variable.distribution, rng)
      }

      const result = evaluateFormula(formula, sampledValues)
      results.push(result)
    }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'simulation_error',
        error instanceof Error ? error.message : 'Simulation failed'
      ),
    }
  }

  const sortedResults = [...results].sort((a, b) => a - b)

  const mean = ss.mean(results)
  const median = ss.median(results)
  const stdDev = ss.standardDeviation(results)
  const variance = ss.variance(results)
  const skewness = ss.sampleSkewness(results)
  const kurtosis = ss.sampleKurtosis(results)

  const percentile = (p: number): number => {
    const index = Math.floor((p / 100) * sortedResults.length)
    return sortedResults[Math.min(index, sortedResults.length - 1)]
  }

  const percentiles = {
    p1: percentile(1),
    p5: percentile(5),
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  }

  const min = sortedResults[0]
  const max = sortedResults[sortedResults.length - 1]

  const numBins = Math.min(100, Math.ceil(Math.sqrt(iterations)))
  const binWidth = (max - min) / numBins
  const histogram: { binStart: number; binEnd: number; count: number; frequency: number }[] = []

  for (let i = 0; i < numBins; i++) {
    const binStart = min + i * binWidth
    const binEnd = min + (i + 1) * binWidth
    const count = results.filter(
      (r) => r >= binStart && (i === numBins - 1 ? r <= binEnd : r < binEnd)
    ).length
    histogram.push({
      binStart,
      binEnd,
      count,
      frequency: count / iterations,
    })
  }

  const steps: CalculationStep[] = [
    {
      id: generateId(),
      name: 'Input Variables',
      description: `${variables.length} variable(s) defined`,
      formula: 'Variables',
      formulaWithValues: variables.map((v) => `${v.name}: ${v.distribution.type}`).join(', '),
      inputs: {},
      output: variables.length,
      unit: 'count',
    },
    {
      id: generateId(),
      name: 'Simulation Formula',
      description: 'Formula applied to each iteration',
      formula: 'Result = f(variables)',
      formulaWithValues: formula,
      inputs: {},
      output: 0,
      unit: 'formula',
    },
    {
      id: generateId(),
      name: 'Simulation Statistics',
      description: `${iterations} iterations completed`,
      formula: 'N iterations',
      formulaWithValues: `Mean: ${mean.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}, 95% CI: [${percentiles.p5.toFixed(2)}, ${percentiles.p95.toFixed(2)}]`,
      inputs: { iterations },
      output: iterations,
      unit: 'iterations',
    },
  ]

  const executionTimeMs = performance.now() - startTime

  const result: MonteCarloResult = {
    statistics: {
      mean,
      median,
      stdDev,
      variance,
      skewness,
      kurtosis,
      percentiles,
      min,
      max,
    },
    distribution: sortedResults,
    histogram,
    steps,
    executionTimeMs,
    iterations,
    source: 'typescript',
  }

  return { success: true, data: result }
}

export function latinHypercubeSampling(
  variables: MonteCarloVariable[],
  samples: number,
  seed?: number
): Record<string, number[]> {
  const rng = seed !== undefined ? new SeededRandom(seed) : null
  const random = rng ? rng.next.bind(rng) : Math.random

  const result: Record<string, number[]> = {}
  const n = samples

  for (const variable of variables) {
    result[variable.name] = []
  }

  const permutations: number[][] = []
  for (let i = 0; i < n; i++) {
    const perm: number[] = []
    for (let j = 0; j < variables.length; j++) {
      perm.push(i)
    }
    for (let j = perm.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1))
      ;[perm[j], perm[k]] = [perm[k], perm[j]]
    }
    permutations.push(perm)
  }

  for (let v = 0; v < variables.length; v++) {
    const variable = variables[v]
    const { distribution } = variable

    for (let i = 0; i < n; i++) {
      const u = (permutations[i][v] + random()) / n

      let value: number
      switch (distribution.type) {
        case 'normal':
          if (distribution.params.mean === undefined || distribution.params.stdDev === undefined) {
            throw new Error('Normal distribution requires mean and stdDev')
          }
          value = inverseNormalCdf(u) * distribution.params.stdDev + distribution.params.mean
          break
        case 'uniform':
          if (distribution.params.min === undefined || distribution.params.max === undefined) {
            throw new Error('Uniform distribution requires min and max')
          }
          value = distribution.params.min + u * (distribution.params.max - distribution.params.min)
          break
        default:
          value = sampleDistribution(distribution, random)
      }

      result[variable.name].push(value)
    }
  }

  return result
}

export function sensitivityAnalysis(
  baseInputs: MonteCarloInputs,
  variableName: string,
  variationRange: number,
  steps: number
): Result<{ values: number[]; results: MonteCarloResult[] }> {
  const variable = baseInputs.variables.find((v) => v.name === variableName)
  if (!variable) {
    return {
      success: false,
      error: createError('invalid_input', `Variable ${variableName} not found`),
    }
  }

  const { mean } = variable.distribution.params
  if (mean === undefined) {
    return {
      success: false,
      error: createError('invalid_input', `Variable ${variableName} must have a mean parameter`),
    }
  }

  const values: number[] = []
  const results: MonteCarloResult[] = []

  for (let i = 0; i < steps; i++) {
    const factor = 1 - variationRange + (2 * variationRange * i) / (steps - 1)
    const newMean = mean * factor

    const modifiedInputs: MonteCarloInputs = {
      ...baseInputs,
      variables: baseInputs.variables.map((v) =>
        v.name === variableName
          ? {
              ...v,
              distribution: {
                ...v.distribution,
                params: { ...v.distribution.params, mean: newMean },
              },
            }
          : v
      ),
    }

    const result = runMonteCarloSimulation(modifiedInputs)
    if (!result.success) {
      return result
    }

    values.push(newMean)
    results.push(result.data)
  }

  return { success: true, data: { values, results } }
}
