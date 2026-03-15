import type { DCFInputs, DCFResult, CalculationStep, Result, ValuationError } from './types'

const VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(2)}%`
}

export interface DCFPeriodCalculation {
  year: number
  fcf: number
  discountFactor: number
  presentValue: number
  formula: string
  formulaWithValues: string
}

export function calculateDCF(inputs: DCFInputs): Result<DCFResult> {
  const { freeCashFlow, growthRate, terminalGrowthRate, discountRate, projectionYears } = inputs

  if (freeCashFlow <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Free Cash Flow must be positive', { freeCashFlow }),
    }
  }

  if (growthRate <= -1) {
    return {
      success: false,
      error: createError('invalid_input', 'Growth rate must be greater than -100%', { growthRate }),
    }
  }

  if (terminalGrowthRate >= discountRate) {
    return {
      success: false,
      error: createError('invalid_input', 'Terminal growth rate must be less than discount rate', {
        terminalGrowthRate,
        discountRate,
      }),
    }
  }

  if (projectionYears < 1 || projectionYears > 20) {
    return {
      success: false,
      error: createError('invalid_input', 'Projection years must be between 1 and 20', {
        projectionYears,
      }),
    }
  }

  if (discountRate <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Discount rate must be positive', { discountRate }),
    }
  }

  try {
    const steps: CalculationStep[] = []
    const periodCalculations: DCFPeriodCalculation[] = []
    const presentValues: number[] = []
    let totalPV = 0

    const g = growthRate / 100
    const gt = terminalGrowthRate / 100
    const r = discountRate / 100

    for (let year = 1; year <= projectionYears; year++) {
      const fcf = freeCashFlow * Math.pow(1 + g, year)
      const discountFactor = Math.pow(1 + r, year)
      const pv = fcf / discountFactor
      presentValues.push(pv)
      totalPV += pv

      const formula = `FCF₍${year}₎ / (1 + r)ⁿ`
      const formulaWithValues = `${formatNumber(fcf)} / (1 + ${formatPercent(r)})^${year} = ${formatNumber(pv)}`

      periodCalculations.push({
        year,
        fcf,
        discountFactor,
        presentValue: pv,
        formula,
        formulaWithValues,
      })
    }

    const terminalFCF = freeCashFlow * Math.pow(1 + g, projectionYears) * (1 + gt)
    const terminalValue = terminalFCF / (r - gt)
    const terminalPV = terminalValue / Math.pow(1 + r, projectionYears)
    const enterpriseValue = totalPV + terminalPV

    steps.push({
      id: generateId(),
      name: 'Step 1: Free Cash Flow Projection',
      description: `Project FCF for ${projectionYears} years with ${growthRate}% growth rate`,
      formula: `FCFₙ = FCF₀ × (1 + g)ⁿ`,
      formulaWithValues: `FCF₁ = ${formatNumber(freeCashFlow)} × (1 + ${formatPercent(g)})^1 = ${formatNumber(freeCashFlow * (1 + g))}`,
      inputs: { FCF0: freeCashFlow, g: g, years: projectionYears },
      output: freeCashFlow * Math.pow(1 + g, projectionYears),
      unit: inputs.unit || 'million',
      children: periodCalculations.map((p) => ({
        id: generateId(),
        name: `Year ${p.year}`,
        description: `FCF and PV for year ${p.year}`,
        formula: p.formula,
        formulaWithValues: p.formulaWithValues,
        inputs: { FCF: p.fcf, r: r, year: p.year },
        output: p.presentValue,
        unit: inputs.unit || 'million',
      })),
    })

    steps.push({
      id: generateId(),
      name: 'Step 2: Present Value of FCF',
      description: 'Calculate present value of each period FCF',
      formula: `PV = Σ(FCFₙ / (1 + r)ⁿ)`,
      formulaWithValues: `PV = ${periodCalculations.map((p) => formatNumber(p.presentValue)).join(' + ')} = ${formatNumber(totalPV)}`,
      inputs: { totalPV },
      output: totalPV,
      unit: inputs.unit || 'million',
    })

    steps.push({
      id: generateId(),
      name: 'Step 3: Terminal Value',
      description: `Calculate terminal value with ${terminalGrowthRate}% perpetual growth`,
      formula: `TV = FCFₙ₊₁ / (r - gₜ)`,
      formulaWithValues: `TV = ${formatNumber(terminalFCF)} / (${formatPercent(r)} - ${formatPercent(gt)}) = ${formatNumber(terminalValue)}`,
      inputs: { terminalFCF, r, gt },
      output: terminalValue,
      unit: inputs.unit || 'million',
    })

    steps.push({
      id: generateId(),
      name: 'Step 4: Present Value of Terminal Value',
      description: `Discount terminal value to present`,
      formula: `PV(TV) = TV / (1 + r)ⁿ`,
      formulaWithValues: `PV(TV) = ${formatNumber(terminalValue)} / (1 + ${formatPercent(r)})^${projectionYears} = ${formatNumber(terminalPV)}`,
      inputs: { terminalValue, r, years: projectionYears },
      output: terminalPV,
      unit: inputs.unit || 'million',
    })

    steps.push({
      id: generateId(),
      name: 'Step 5: Enterprise Value',
      description: 'Sum of present values and terminal value',
      formula: `EV = PV(FCF) + PV(TV)`,
      formulaWithValues: `EV = ${formatNumber(totalPV)} + ${formatNumber(terminalPV)} = ${formatNumber(enterpriseValue)}`,
      inputs: { totalPV, terminalPV },
      output: enterpriseValue,
      unit: inputs.unit || 'million',
    })

    const result: DCFResult = {
      enterpriseValue: Math.round(enterpriseValue),
      currency: inputs.currency || 'JPY',
      unit: inputs.unit || 'million',
      steps,
      metadata: {
        method: 'dcf',
        calculatedAt: new Date().toISOString(),
        version: VERSION,
        presentValues: presentValues.map((pv) => Math.round(pv)),
        terminalValue: Math.round(terminalValue),
        terminalPV: Math.round(terminalPV),
      },
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during DCF calculation'
      ),
    }
  }
}

export function formatDCFExplanation(result: DCFResult): string {
  const { steps, enterpriseValue, metadata } = result
  const lines: string[] = []

  lines.push(`DCF Valuation Summary`)
  lines.push(`=====================`)
  lines.push(``)
  lines.push(`Enterprise Value: ${enterpriseValue.toLocaleString()} MM JPY`)
  lines.push(``)
  lines.push(`Calculation Steps:`)
  lines.push(``)

  steps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.name}`)
    lines.push(`   Formula: ${step.formula}`)
    lines.push(`   Calculation: ${step.formulaWithValues}`)
    lines.push(`   Result: ${formatNumber(step.output)} ${step.unit}`)
    lines.push(``)
  })

  lines.push(`Present Values by Period:`)
  metadata.presentValues.forEach((pv, index) => {
    lines.push(`  Year ${index + 1}: ${pv.toLocaleString()} MM JPY`)
  })
  lines.push(``)
  lines.push(`Terminal Value: ${metadata.terminalValue.toLocaleString()} MM JPY`)
  lines.push(`Terminal Value (PV): ${metadata.terminalPV.toLocaleString()} MM JPY`)

  return lines.join('\n')
}

export function validateDCFInputs(inputs: Partial<DCFInputs>): Result<true> {
  const errors: string[] = []

  if (typeof inputs.freeCashFlow !== 'number' || inputs.freeCashFlow <= 0) {
    errors.push('Free Cash Flow must be a positive number')
  }

  if (typeof inputs.growthRate !== 'number' || inputs.growthRate <= -100) {
    errors.push('Growth rate must be greater than -100%')
  }

  if (typeof inputs.terminalGrowthRate !== 'number') {
    errors.push('Terminal growth rate is required')
  }

  if (typeof inputs.discountRate !== 'number' || inputs.discountRate <= 0) {
    errors.push('Discount rate must be a positive number')
  }

  if (inputs.terminalGrowthRate !== undefined && inputs.discountRate !== undefined) {
    if (inputs.terminalGrowthRate >= inputs.discountRate) {
      errors.push('Terminal growth rate must be less than discount rate')
    }
  }

  if (
    typeof inputs.projectionYears !== 'number' ||
    inputs.projectionYears < 1 ||
    inputs.projectionYears > 20
  ) {
    errors.push('Projection years must be between 1 and 20')
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: createError('validation_error', errors.join('; '), { errors }),
    }
  }

  return { success: true, data: true }
}
