import type {
  ComparableInputs,
  ComparableResult,
  ComparableCompany,
  MultipleType,
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
  return `comp_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function calculateComparable(inputs: ComparableInputs): Result<ComparableResult> {
  const {
    targetRevenue: _targetRevenue,
    targetEBITDA: _targetEBITDA,
    targetNetIncome: _targetNetIncome,
    targetBookValue: _targetBookValue,
    selectedMultiples,
    comparableData,
  } = inputs

  if (!selectedMultiples || selectedMultiples.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'At least one multiple must be selected'),
    }
  }

  if (!comparableData || comparableData.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Comparable company data is required'),
    }
  }

  try {
    const steps: CalculationStep[] = []
    const valuations: ComparableResult['valuations'] = []
    const multiples: Record<MultipleType, { multiple: number; value: number }> = {} as Record<
      MultipleType,
      { multiple: number; value: number }
    >

    for (const multipleType of selectedMultiples) {
      const targetMetric = getTargetMetricForType(multipleType, inputs)

      if (targetMetric <= 0) {
        continue
      }

      const comparableMultiples = comparableData
        .map((c) => getComparableMultiple(c, multipleType))
        .filter((m) => m > 0)

      if (comparableMultiples.length === 0) {
        continue
      }

      const avgMultiple =
        comparableMultiples.reduce((a, b) => a + b, 0) / comparableMultiples.length
      const value = avgMultiple * targetMetric

      multiples[multipleType] = { multiple: avgMultiple, value }

      valuations.push({
        multiple: multipleType,
        value: Math.round(value),
        multipleUsed: avgMultiple,
      })

      steps.push({
        id: generateId(),
        name: `${multipleType} Valuation`,
        description: `Calculate value using ${multipleType} multiple`,
        formula: `Value = Multiple × Target Metric`,
        formulaWithValues: `Value = ${formatNumber(avgMultiple)}x × ${formatNumber(targetMetric)} = ${formatNumber(value)}`,
        inputs: { multiple: avgMultiple, targetMetric },
        output: value,
        unit: 'currency',
      })
    }

    if (valuations.length === 0) {
      return {
        success: false,
        error: createError('calculation_error', 'No valid valuations could be calculated'),
      }
    }

    const averageValue = valuations.reduce((sum, v) => sum + v.value, 0) / valuations.length

    steps.push({
      id: generateId(),
      name: 'Average Valuation',
      description: 'Calculate average of all valuation methods',
      formula: 'Average = Sum of Values / Count',
      formulaWithValues: `Average = (${valuations.map((v) => formatNumber(v.value)).join(' + ')}) / ${valuations.length} = ${formatNumber(averageValue)}`,
      inputs: {},
      output: averageValue,
      unit: inputs.unit || 'million',
    })

    const result: ComparableResult = {
      enterpriseValue: Math.round(averageValue),
      currency: inputs.currency || 'JPY',
      unit: inputs.unit || 'million',
      valuations,
      steps,
      metadata: {
        method: 'comparable',
        calculatedAt: new Date().toISOString(),
        version: VERSION,
        multiples,
        averageMultiple:
          Object.values(multiples).reduce((sum, m) => sum + m.multiple, 0) /
          Object.keys(multiples).length,
        medianMultiple: getMedianMultiple(Object.values(multiples).map((m) => m.multiple)),
      },
    }

    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during comparable company analysis'
      ),
    }
  }
}

function getTargetMetricForType(type: MultipleType, inputs: ComparableInputs): number {
  switch (type) {
    case 'PE':
      return inputs.targetNetIncome
    case 'PB':
      return inputs.targetBookValue ?? 0
    case 'EV_EBITDA':
      return inputs.targetEBITDA
    case 'EV_REVENUE':
    case 'PS':
      return inputs.targetRevenue
    default:
      return 0
  }
}

function getComparableMultiple(company: ComparableCompany, type: MultipleType): number {
  switch (type) {
    case 'PE':
      return company.per
    case 'PB':
      return company.pbr ?? 0
    case 'EV_EBITDA':
      return company.evEbitda
    case 'EV_REVENUE':
      return company.evRevenue ?? company.psr
    case 'PS':
      return company.psr
    default:
      return 0
  }
}

function getMedianMultiple(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
