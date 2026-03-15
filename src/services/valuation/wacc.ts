import type { WACCInputs, WACCResult, CalculationStep, Result, ValuationError } from './types'

const _VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `wacc_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatPercent(num: number): string {
  return `${(num * 100).toFixed(2)}%`
}

function formatNumber(num: number, decimals: number = 4): string {
  return num.toFixed(decimals)
}

export function calculateWACC(inputs: WACCInputs): Result<WACCResult> {
  if (inputs.mode === 'simple') {
    return calculateSimpleWACC(inputs)
  } else {
    return calculateDetailedWACC(inputs)
  }
}

function calculateSimpleWACC(inputs: WACCInputs): Result<WACCResult> {
  if (typeof inputs.simpleWACC !== 'number') {
    return {
      success: false,
      error: createError('invalid_input', 'simpleWACC is required for simple mode'),
    }
  }

  if (inputs.simpleWACC <= 0 || inputs.simpleWACC > 100) {
    return {
      success: false,
      error: createError('invalid_input', 'WACC must be between 0 and 100 percent'),
    }
  }

  const wacc = inputs.simpleWACC / 100

  const steps: CalculationStep[] = [
    {
      id: generateId(),
      name: 'WACC (Direct Input)',
      description: 'Weighted Average Cost of Capital - Direct input mode',
      formula: 'WACC = Input Value',
      formulaWithValues: `WACC = ${inputs.simpleWACC}%`,
      inputs: { wacc: inputs.simpleWACC },
      output: wacc,
      unit: 'decimal',
    },
  ]

  return {
    success: true,
    data: {
      wacc,
      mode: 'simple',
      steps,
    },
  }
}

function calculateDetailedWACC(inputs: WACCInputs): Result<WACCResult> {
  const { detailed } = inputs

  if (!detailed) {
    return {
      success: false,
      error: createError('invalid_input', 'Detailed inputs are required for detailed mode'),
    }
  }

  const { riskFreeRate, marketRiskPremium, beta, costOfDebt, taxRate, debtRatio, equityRatio } =
    detailed

  const validationErrors: string[] = []

  if (riskFreeRate < 0) validationErrors.push('Risk-free rate cannot be negative')
  if (marketRiskPremium <= 0) validationErrors.push('Market risk premium must be positive')
  if (beta <= 0) validationErrors.push('Beta must be positive')
  if (costOfDebt < 0) validationErrors.push('Cost of debt cannot be negative')
  if (taxRate < 0 || taxRate > 100) validationErrors.push('Tax rate must be between 0 and 100')
  if (debtRatio < 0 || debtRatio > 100)
    validationErrors.push('Debt ratio must be between 0 and 100')
  if (equityRatio < 0 || equityRatio > 100)
    validationErrors.push('Equity ratio must be between 0 and 100')

  const ratioSum = debtRatio + equityRatio
  if (Math.abs(ratioSum - 100) > 0.01) {
    validationErrors.push(`Debt ratio + Equity ratio must equal 100% (currently ${ratioSum}%)`)
  }

  if (validationErrors.length > 0) {
    return {
      success: false,
      error: createError('validation_error', validationErrors.join('; '), {
        errors: validationErrors,
      }),
    }
  }

  const Rf = riskFreeRate / 100
  const Rm = marketRiskPremium / 100
  const betaValue = beta
  const Rd = costOfDebt / 100
  const Tc = taxRate / 100
  const D_V = debtRatio / 100
  const E_V = equityRatio / 100

  const steps: CalculationStep[] = []

  const costOfEquity = Rf + betaValue * Rm
  steps.push({
    id: generateId(),
    name: 'Step 1: Cost of Equity (CAPM)',
    description: 'Calculate cost of equity using Capital Asset Pricing Model',
    formula: 'Re = Rf + β × (Rm - Rf)',
    formulaWithValues: `Re = ${formatPercent(Rf)} + ${betaValue} × ${formatPercent(Rm)} = ${formatPercent(costOfEquity)}`,
    inputs: { Rf: riskFreeRate, beta: betaValue, Rm: marketRiskPremium },
    output: costOfEquity,
    unit: 'decimal',
  })

  const afterTaxCostOfDebt = Rd * (1 - Tc)
  steps.push({
    id: generateId(),
    name: 'Step 2: After-Tax Cost of Debt',
    description: 'Calculate after-tax cost of debt',
    formula: 'Rd(after-tax) = Rd × (1 - Tc)',
    formulaWithValues: `Rd(after-tax) = ${formatPercent(Rd)} × (1 - ${formatPercent(Tc)}) = ${formatPercent(afterTaxCostOfDebt)}`,
    inputs: { Rd: costOfDebt, Tc: taxRate },
    output: afterTaxCostOfDebt,
    unit: 'decimal',
  })

  const weightedCostOfEquity = E_V * costOfEquity
  steps.push({
    id: generateId(),
    name: 'Step 3: Weighted Cost of Equity',
    description: 'Calculate weighted cost of equity',
    formula: 'E/V × Re',
    formulaWithValues: `${formatPercent(E_V)} × ${formatPercent(costOfEquity)} = ${formatPercent(weightedCostOfEquity)}`,
    inputs: { E_V: equityRatio, Re: costOfEquity },
    output: weightedCostOfEquity,
    unit: 'decimal',
  })

  const weightedCostOfDebt = D_V * afterTaxCostOfDebt
  steps.push({
    id: generateId(),
    name: 'Step 4: Weighted Cost of Debt',
    description: 'Calculate weighted cost of debt',
    formula: 'D/V × Rd × (1 - Tc)',
    formulaWithValues: `${formatPercent(D_V)} × ${formatPercent(afterTaxCostOfDebt)} = ${formatPercent(weightedCostOfDebt)}`,
    inputs: { D_V: debtRatio, Rd: afterTaxCostOfDebt },
    output: weightedCostOfDebt,
    unit: 'decimal',
  })

  const wacc = weightedCostOfEquity + weightedCostOfDebt
  steps.push({
    id: generateId(),
    name: 'Step 5: WACC',
    description: 'Calculate Weighted Average Cost of Capital',
    formula: 'WACC = (E/V × Re) + (D/V × Rd × (1 - Tc))',
    formulaWithValues: `${formatPercent(weightedCostOfEquity)} + ${formatPercent(weightedCostOfDebt)} = ${formatPercent(wacc)}`,
    inputs: {
      weightedCostOfEquity,
      weightedCostOfDebt,
    },
    output: wacc,
    unit: 'decimal',
  })

  const result: WACCResult = {
    wacc,
    mode: 'detailed',
    steps,
    components: {
      costOfEquity,
      costOfDebt: Rd,
      afterTaxCostOfDebt,
      weightedCostOfEquity,
      weightedCostOfDebt,
    },
  }

  return { success: true, data: result }
}

export interface LeveredBetaInputs {
  unleveredBeta: number
  debtEquityRatio: number
  taxRate: number
}

export function calculateLeveredBeta(
  inputs: LeveredBetaInputs
): Result<{ leveredBeta: number; steps: CalculationStep[] }> {
  const { unleveredBeta, debtEquityRatio, taxRate } = inputs

  if (unleveredBeta <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Unlevered beta must be positive'),
    }
  }

  if (debtEquityRatio < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Debt/Equity ratio cannot be negative'),
    }
  }

  if (taxRate < 0 || taxRate > 100) {
    return {
      success: false,
      error: createError('invalid_input', 'Tax rate must be between 0 and 100'),
    }
  }

  const Tc = taxRate / 100
  const leveredBeta = unleveredBeta * (1 + (1 - Tc) * debtEquityRatio)

  const steps: CalculationStep[] = [
    {
      id: generateId(),
      name: 'Levered Beta Calculation',
      description: 'Convert unlevered beta to levered beta',
      formula: 'βL = βU × (1 + (1 - Tc) × D/E)',
      formulaWithValues: `βL = ${unleveredBeta} × (1 + (1 - ${formatPercent(Tc)}) × ${debtEquityRatio}) = ${formatNumber(leveredBeta)}`,
      inputs: { unleveredBeta, debtEquityRatio, taxRate },
      output: leveredBeta,
      unit: 'decimal',
    },
  ]

  return {
    success: true,
    data: { leveredBeta, steps },
  }
}

export interface UnleveredBetaInputs {
  leveredBeta: number
  debtEquityRatio: number
  taxRate: number
}

export function calculateUnleveredBeta(
  inputs: UnleveredBetaInputs
): Result<{ unleveredBeta: number; steps: CalculationStep[] }> {
  const { leveredBeta, debtEquityRatio, taxRate } = inputs

  if (leveredBeta <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Levered beta must be positive'),
    }
  }

  if (debtEquityRatio < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Debt/Equity ratio cannot be negative'),
    }
  }

  if (taxRate < 0 || taxRate > 100) {
    return {
      success: false,
      error: createError('invalid_input', 'Tax rate must be between 0 and 100'),
    }
  }

  const Tc = taxRate / 100
  const unleveredBeta = leveredBeta / (1 + (1 - Tc) * debtEquityRatio)

  const steps: CalculationStep[] = [
    {
      id: generateId(),
      name: 'Unlevered Beta Calculation',
      description: 'Convert levered beta to unlevered beta',
      formula: 'βU = βL / (1 + (1 - Tc) × D/E)',
      formulaWithValues: `βU = ${leveredBeta} / (1 + (1 - ${formatPercent(Tc)}) × ${debtEquityRatio}) = ${formatNumber(unleveredBeta)}`,
      inputs: { leveredBeta, debtEquityRatio, taxRate },
      output: unleveredBeta,
      unit: 'decimal',
    },
  ]

  return {
    success: true,
    data: { unleveredBeta, steps },
  }
}

export function formatWACCExplanation(result: WACCResult): string {
  const lines: string[] = []

  lines.push(`WACC Calculation Summary`)
  lines.push(`========================`)
  lines.push(``)
  lines.push(`WACC: ${formatPercent(result.wacc)}`)
  lines.push(`Mode: ${result.mode}`)
  lines.push(``)

  if (result.components) {
    lines.push(`Components:`)
    lines.push(`  Cost of Equity (Re): ${formatPercent(result.components.costOfEquity)}`)
    lines.push(`  Cost of Debt (Rd): ${formatPercent(result.components.costOfDebt)}`)
    lines.push(`  After-Tax Cost of Debt: ${formatPercent(result.components.afterTaxCostOfDebt)}`)
    lines.push(
      `  Weighted Cost of Equity: ${formatPercent(result.components.weightedCostOfEquity)}`
    )
    lines.push(`  Weighted Cost of Debt: ${formatPercent(result.components.weightedCostOfDebt)}`)
    lines.push(``)
  }

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
