import type {
  BlackScholesInputs,
  BlackScholesResult,
  CalculationStep,
  Result,
  ValuationError,
} from './types'

const _VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `bs_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatNumber(num: number, decimals: number = 4): string {
  return num.toFixed(decimals)
}

function normalCDF(x: number): number {
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)

  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)

  return 0.5 * (1.0 + sign * y)
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function calculateBlackScholes(inputs: BlackScholesInputs): Result<BlackScholesResult> {
  const {
    spotPrice,
    strikePrice,
    timeToMaturity,
    riskFreeRate,
    volatility,
    dividendYield = 0,
    optionType,
  } = inputs

  if (spotPrice <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Spot price must be positive'),
    }
  }

  if (strikePrice <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Strike price must be positive'),
    }
  }

  if (timeToMaturity <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Time to maturity must be positive'),
    }
  }

  if (volatility <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Volatility must be positive'),
    }
  }

  if (riskFreeRate < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Risk-free rate cannot be negative'),
    }
  }

  if (dividendYield < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Dividend yield cannot be negative'),
    }
  }

  try {
    const S = spotPrice
    const K = strikePrice
    const T = timeToMaturity
    const r = riskFreeRate / 100
    const sigma = volatility / 100
    const q = dividendYield / 100

    const steps: CalculationStep[] = []

    const sqrtT = Math.sqrt(T)
    const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
    const d2 = d1 - sigma * sqrtT

    steps.push({
      id: generateId(),
      name: 'Step 1: Calculate d1',
      description: 'Calculate d1 parameter',
      formula: 'd1 = [ln(S/K) + (r - q + σ²/2) × T] / (σ × √T)',
      formulaWithValues: `d1 = [ln(${S}/${K}) + (${(r * 100).toFixed(2)}% - ${(q * 100).toFixed(2)}% + ${(((sigma * sigma) / 2) * 100).toFixed(4)}%) × ${T}] / (${(sigma * 100).toFixed(2)}% × √${T}) = ${formatNumber(d1)}`,
      inputs: { S, K, r, q, sigma, T },
      output: d1,
      unit: 'dimensionless',
    })

    steps.push({
      id: generateId(),
      name: 'Step 2: Calculate d2',
      description: 'Calculate d2 parameter',
      formula: 'd2 = d1 - σ × √T',
      formulaWithValues: `d2 = ${formatNumber(d1)} - ${(sigma * 100).toFixed(2)}% × √${T} = ${formatNumber(d2)}`,
      inputs: { d1, sigma, T },
      output: d2,
      unit: 'dimensionless',
    })

    const Nd1 = normalCDF(d1)
    const Nd2 = normalCDF(d2)
    const Nd1Neg = normalCDF(-d1)
    const Nd2Neg = normalCDF(-d2)

    let optionValue: number

    if (optionType === 'call') {
      optionValue = S * Math.exp(-q * T) * Nd1 - K * Math.exp(-r * T) * Nd2

      steps.push({
        id: generateId(),
        name: 'Step 3: Calculate Call Option Value',
        description: 'Calculate call option price',
        formula: 'C = S × e^(-qT) × N(d1) - K × e^(-rT) × N(d2)',
        formulaWithValues: `C = ${S} × e^(-${(q * 100).toFixed(2)}% × ${T}) × ${formatNumber(Nd1)} - ${K} × e^(-${(r * 100).toFixed(2)}% × ${T}) × ${formatNumber(Nd2)} = ${formatNumber(optionValue)}`,
        inputs: { S, K, r, q, T, Nd1, Nd2 },
        output: optionValue,
        unit: 'currency',
      })
    } else {
      optionValue = K * Math.exp(-r * T) * Nd2Neg - S * Math.exp(-q * T) * Nd1Neg

      steps.push({
        id: generateId(),
        name: 'Step 3: Calculate Put Option Value',
        description: 'Calculate put option price',
        formula: 'P = K × e^(-rT) × N(-d2) - S × e^(-qT) × N(-d1)',
        formulaWithValues: `P = ${K} × e^(-${(r * 100).toFixed(2)}% × ${T}) × ${formatNumber(Nd2Neg)} - ${S} × e^(-${(q * 100).toFixed(2)}% × ${T}) × ${formatNumber(Nd1Neg)} = ${formatNumber(optionValue)}`,
        inputs: { S, K, r, q, T, Nd1Neg, Nd2Neg },
        output: optionValue,
        unit: 'currency',
      })
    }

    const _discountFactor = Math.exp(-r * T)
    const delta = optionType === 'call' ? Math.exp(-q * T) * Nd1 : -Math.exp(-q * T) * Nd1Neg
    const gamma = (Math.exp(-q * T) * normalPDF(d1)) / (S * sigma * sqrtT)
    const theta =
      optionType === 'call'
        ? ((-S * Math.exp(-q * T) * normalPDF(d1) * sigma) / (2 * sqrtT) -
            r * K * Math.exp(-r * T) * Nd2 +
            q * S * Math.exp(-q * T) * Nd1) /
          365
        : ((-S * Math.exp(-q * T) * normalPDF(d1) * sigma) / (2 * sqrtT) +
            r * K * Math.exp(-r * T) * Nd2Neg -
            q * S * Math.exp(-q * T) * Nd1Neg) /
          365
    const vega = (S * Math.exp(-q * T) * normalPDF(d1) * sqrtT) / 100
    const rho =
      optionType === 'call'
        ? (K * T * Math.exp(-r * T) * Nd2) / 100
        : (-K * T * Math.exp(-r * T) * Nd2Neg) / 100

    steps.push({
      id: generateId(),
      name: 'Step 4: Calculate Greeks',
      description: 'Calculate option sensitivities',
      formula: 'Greeks',
      formulaWithValues: `Δ = ${formatNumber(delta)}, Γ = ${formatNumber(gamma)}, Θ = ${formatNumber(theta)}, ν = ${formatNumber(vega)}, ρ = ${formatNumber(rho)}`,
      inputs: { delta, gamma, theta, vega, rho },
      output: 0,
      unit: 'greeks',
    })

    const result: BlackScholesResult = {
      optionValue,
      optionType,
      steps,
      greeks: {
        delta,
        gamma,
        theta,
        vega,
        rho,
      },
      d1,
      d2,
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during Black-Scholes calculation'
      ),
    }
  }
}

export function impliedVolatility(
  optionPrice: number,
  inputs: Omit<BlackScholesInputs, 'volatility'>,
  maxIterations: number = 100,
  tolerance: number = 0.0001
): Result<{ impliedVol: number; iterations: number }> {
  let low = 0.0001
  let high = 5.0
  let iterations = 0

  while (iterations < maxIterations) {
    const mid = (low + high) / 2
    const result = calculateBlackScholes({ ...inputs, volatility: mid * 100 })

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      }
    }

    const diff = result.data.optionValue - optionPrice

    if (Math.abs(diff) < tolerance) {
      return { success: true, data: { impliedVol: mid * 100, iterations } }
    }

    if (diff > 0) {
      high = mid
    } else {
      low = mid
    }

    iterations++
  }

  return {
    success: false,
    error: createError('convergence_error', 'Implied volatility calculation did not converge'),
  }
}

export function formatBlackScholesExplanation(result: BlackScholesResult): string {
  const lines: string[] = []

  lines.push(`Black-Scholes Option Valuation`)
  lines.push(`==============================`)
  lines.push(``)
  lines.push(`Option Type: ${result.optionType.toUpperCase()}`)
  lines.push(`Option Value: ${formatNumber(result.optionValue)}`)
  lines.push(``)
  lines.push(`Parameters:`)
  lines.push(`  d1: ${formatNumber(result.d1)}`)
  lines.push(`  d2: ${formatNumber(result.d2)}`)
  lines.push(``)
  lines.push(`Greeks:`)
  lines.push(`  Delta (Δ): ${formatNumber(result.greeks.delta)}`)
  lines.push(`  Gamma (Γ): ${formatNumber(result.greeks.gamma)}`)
  lines.push(`  Theta (Θ): ${formatNumber(result.greeks.theta)} per day`)
  lines.push(`  Vega (ν): ${formatNumber(result.greeks.vega)} per 1% vol change`)
  lines.push(`  Rho (ρ): ${formatNumber(result.greeks.rho)} per 1% rate change`)
  lines.push(``)
  lines.push(`Calculation Steps:`)
  result.steps.forEach((step, index) => {
    lines.push(``)
    lines.push(`${index + 1}. ${step.name}`)
    lines.push(`   ${step.description}`)
    lines.push(`   Formula: ${step.formula}`)
    lines.push(`   ${step.formulaWithValues}`)
  })

  return lines.join('\n')
}
