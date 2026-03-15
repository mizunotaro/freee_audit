import type {
  AssetBasedInputs,
  AssetBasedResult,
  AssetAdjustment,
  CalculationStep,
  Result,
  ValuationError,
} from './types'

const VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `ab_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function calculateAssetBased(inputs: AssetBasedInputs): Result<AssetBasedResult> {
  const {
    totalAssets,
    totalLiabilities,
    intangibleAssets = 0,
    adjustments = [],
    liquidationDiscount,
  } = inputs

  if (totalAssets <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Total assets must be positive'),
    }
  }

  if (totalLiabilities < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Total liabilities cannot be negative'),
    }
  }

  if (intangibleAssets < 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Intangible assets cannot be negative'),
    }
  }

  if (liquidationDiscount !== undefined && (liquidationDiscount < 0 || liquidationDiscount > 100)) {
    return {
      success: false,
      error: createError('invalid_input', 'Liquidation discount must be between 0 and 100'),
    }
  }

  try {
    const steps: CalculationStep[] = []

    const bookValue = totalAssets - totalLiabilities
    steps.push({
      id: generateId(),
      name: 'Step 1: Book Value',
      description: 'Calculate book value (Net Assets)',
      formula: 'BV = Total Assets - Total Liabilities',
      formulaWithValues: `BV = ${formatNumber(totalAssets)} - ${formatNumber(totalLiabilities)} = ${formatNumber(bookValue)}`,
      inputs: { totalAssets, totalLiabilities },
      output: bookValue,
      unit: inputs.unit || 'million',
    })

    let adjustedBookValue = bookValue

    const tangibleBookValue = bookValue - intangibleAssets
    if (intangibleAssets > 0) {
      adjustedBookValue = tangibleBookValue
      steps.push({
        id: generateId(),
        name: 'Step 2: Remove Intangible Assets',
        description: 'Calculate tangible book value',
        formula: 'TBV = BV - Intangible Assets',
        formulaWithValues: `TBV = ${formatNumber(bookValue)} - ${formatNumber(intangibleAssets)} = ${formatNumber(tangibleBookValue)}`,
        inputs: { bookValue, intangibleAssets },
        output: tangibleBookValue,
        unit: inputs.unit || 'million',
      })
    }

    if (adjustments.length > 0) {
      let totalAdditions = 0
      let totalDeductions = 0

      for (const adj of adjustments) {
        if (adj.type === 'addition') {
          totalAdditions += adj.amount
        } else {
          totalDeductions += adj.amount
        }
      }

      adjustedBookValue = adjustedBookValue + totalAdditions - totalDeductions

      steps.push({
        id: generateId(),
        name: 'Step 3: Apply Adjustments',
        description: `Apply ${adjustments.length} adjustment(s)`,
        formula: 'Adjusted BV = TBV + Additions - Deductions',
        formulaWithValues: `Adjusted BV = ${formatNumber(tangibleBookValue)} + ${formatNumber(totalAdditions)} - ${formatNumber(totalDeductions)} = ${formatNumber(adjustedBookValue)}`,
        inputs: { tangibleBookValue, totalAdditions, totalDeductions },
        output: adjustedBookValue,
        unit: inputs.unit || 'million',
        children: adjustments.map((adj) => ({
          id: generateId(),
          name: adj.name,
          description: `${adj.type === 'addition' ? '+' : '-'}${formatNumber(adj.amount)}`,
          formula: adj.type === 'addition' ? 'Addition' : 'Deduction',
          formulaWithValues: `${adj.name}: ${adj.type === 'addition' ? '+' : '-'}${formatNumber(adj.amount)}`,
          inputs: { amount: adj.amount },
          output: adj.type === 'addition' ? adj.amount : -adj.amount,
          unit: inputs.unit || 'million',
        })),
      })
    }

    let liquidationValue: number | undefined
    let enterpriseValue = adjustedBookValue

    if (liquidationDiscount !== undefined && liquidationDiscount > 0) {
      liquidationValue = adjustedBookValue * (1 - liquidationDiscount / 100)
      enterpriseValue = liquidationValue

      steps.push({
        id: generateId(),
        name: 'Step 4: Apply Liquidation Discount',
        description: `Apply ${liquidationDiscount}% liquidation discount`,
        formula: 'LV = Adjusted BV × (1 - Discount)',
        formulaWithValues: `LV = ${formatNumber(adjustedBookValue)} × (1 - ${liquidationDiscount}%) = ${formatNumber(liquidationValue)}`,
        inputs: { adjustedBookValue, liquidationDiscount },
        output: liquidationValue,
        unit: inputs.unit || 'million',
      })
    }

    const result: AssetBasedResult = {
      enterpriseValue: Math.round(enterpriseValue),
      currency: inputs.currency || 'JPY',
      unit: inputs.unit || 'million',
      steps,
      metadata: {
        method: 'asset_based',
        calculatedAt: new Date().toISOString(),
        version: VERSION,
        bookValue,
        adjustedBookValue,
        liquidationValue,
      },
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during asset-based calculation'
      ),
    }
  }
}

export function calculateAdjustedNetAssetValue(inputs: {
  currentAssets: number
  fixedAssets: number
  currentLiabilities: number
  longTermLiabilities: number
  assetRevaluations: AssetAdjustment[]
  liabilityAdjustments: AssetAdjustment[]
  currency?: 'JPY' | 'USD' | 'EUR'
  unit?: 'million' | 'thousand' | 'one'
}): Result<AssetBasedResult> {
  const {
    currentAssets,
    fixedAssets,
    currentLiabilities,
    longTermLiabilities,
    assetRevaluations,
    liabilityAdjustments,
    currency = 'JPY',
    unit = 'million',
  } = inputs

  const totalAssets = currentAssets + fixedAssets
  const totalLiabilities = currentLiabilities + longTermLiabilities

  const adjustments: AssetAdjustment[] = [...assetRevaluations, ...liabilityAdjustments]

  return calculateAssetBased({
    totalAssets,
    totalLiabilities,
    adjustments,
    currency,
    unit,
  })
}

export function formatAssetBasedExplanation(result: AssetBasedResult): string {
  const lines: string[] = []

  lines.push(`Asset-Based Valuation Summary`)
  lines.push(`=============================`)
  lines.push(``)
  lines.push(`Enterprise Value: ${result.enterpriseValue.toLocaleString()} MM JPY`)
  lines.push(``)
  lines.push(`Book Value: ${result.metadata.bookValue.toLocaleString()}`)
  lines.push(`Adjusted Book Value: ${result.metadata.adjustedBookValue.toLocaleString()}`)

  if (result.metadata.liquidationValue !== undefined) {
    lines.push(`Liquidation Value: ${result.metadata.liquidationValue.toLocaleString()}`)
  }

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
