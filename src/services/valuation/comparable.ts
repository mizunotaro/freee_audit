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

function calculateMultiple(company: ComparableCompany, type: MultipleType): number {
  switch (type) {
    case 'PE':
      return company.per
    case 'PB':
      return company.pbr ?? company.marketCap / (company.bookValue ?? 1)
    case 'EV_EBITDA':
      return company.evEbitda
    case 'EV_REVENUE':
      return company.evRevenue ?? company.enterpriseValue / company.revenue
    case 'PS':
      return company.psr
    default:
      return 0
  }
}

function applyMultiple(multiple: number, type: MultipleType, inputs: ComparableInputs): number {
  switch (type) {
    case 'PE':
      return inputs.targetNetIncome * multiple
    case 'PB':
      return (inputs.targetBookValue ?? 0) * multiple
    case 'EV_EBITDA':
      return inputs.targetEBITDA * multiple
    case 'EV_REVENUE':
      return inputs.targetRevenue * multiple
    case 'PS':
      return inputs.targetRevenue * multiple
    default:
      return 0
  }
}

function getMultipleLabel(type: MultipleType): string {
  const labels: Record<MultipleType, string> = {
    PE: 'P/E (Price to Earnings)',
    PB: 'P/B (Price to Book)',
    EV_EBITDA: 'EV/EBITDA',
    EV_REVENUE: 'EV/Revenue',
    PS: 'P/S (Price to Sales)',
  }
  return labels[type]
}

export function calculateComparable(inputs: ComparableInputs): Result<ComparableResult> {
  const {
    targetRevenue,
    targetEBITDA,
    targetNetIncome,
    targetBookValue: _targetBookValue,
    selectedMultiples,
    comparableData,
  } = inputs

  if (targetRevenue <= 0) {
    return {
      success: false,
      error: createError('invalid_input', 'Target revenue must be positive'),
    }
  }

  if (targetEBITDA <= 0 && selectedMultiples.includes('EV_EBITDA')) {
    return {
      success: false,
      error: createError('invalid_input', 'Target EBITDA must be positive for EV/EBITDA valuation'),
    }
  }

  if (targetNetIncome <= 0 && selectedMultiples.includes('PE')) {
    return {
      success: false,
      error: createError('invalid_input', 'Target net income must be positive for P/E valuation'),
    }
  }

  if (!comparableData || comparableData.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'At least one comparable company is required'),
    }
  }

  if (selectedMultiples.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'At least one multiple type must be selected'),
    }
  }

  try {
    const steps: CalculationStep[] = []
    const multiples: Record<MultipleType, { multiple: number; value: number }> = {} as Record<
      MultipleType,
      { multiple: number; value: number }
    >

    steps.push({
      id: generateId(),
      name: 'Comparable Companies',
      description: `${comparableData.length} comparable companies selected`,
      formula: 'N companies',
      formulaWithValues: comparableData.map((c) => c.name).join(', '),
      inputs: { count: comparableData.length },
      output: comparableData.length,
      unit: 'count',
    })

    const multipleValues: Record<MultipleType, number[]> = {
      PE: [],
      PB: [],
      EV_EBITDA: [],
      EV_REVENUE: [],
      PS: [],
    }

    for (const company of comparableData) {
      for (const type of selectedMultiples) {
        const value = calculateMultiple(company, type)
        if (value > 0) {
          multipleValues[type].push(value)
        }
      }
    }

    for (const type of selectedMultiples) {
      const values = multipleValues[type]
      if (values.length === 0) continue

      const avg = values.reduce((a, b) => a + b, 0) / values.length
      const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      const selectedMultiple = values.length % 2 === 0 ? avg : median

      const valuation = applyMultiple(selectedMultiple, type, inputs)

      multiples[type] = {
        multiple: selectedMultiple,
        value: valuation,
      }

      steps.push({
        id: generateId(),
        name: `${getMultipleLabel(type)} Valuation`,
        description: `Average multiple: ${formatNumber(avg, 2)}x, Median: ${formatNumber(median, 2)}x`,
        formula: `Value = Target Metric × ${type}`,
        formulaWithValues: `Value = ${getTargetMetricForType(type, inputs)} × ${formatNumber(selectedMultiple, 2)} = ${formatNumber(valuation)}`,
        inputs: { multiple: selectedMultiple, targetValue: getTargetMetricForType(type, inputs) },
        output: valuation,
        unit: inputs.unit || 'million',
      })
    }

    const validMultiples = Object.values(multiples).map((m) => m.value)
    const averageValue = validMultiples.reduce((a, b) => a + b, 0) / validMultiples.length
    const medianMultiple = validMultiples.sort((a, b) => a - b)[
      Math.floor(validMultiples.length / 2)
    ]

    steps.push({
      id: generateId(),
      name: 'Final Valuation',
      description: 'Average of all multiple-based valuations',
      formula: 'EV = Average of valuations',
      formulaWithValues: `EV = (${validMultiples.map((v) => formatNumber(v)).join(' + ')}) / ${validMultiples.length} = ${formatNumber(averageValue)}`,
      inputs: {},
      output: averageValue,
      unit: inputs.unit || 'million',
    })

    const result: ComparableResult = {
      enterpriseValue: Math.round(averageValue),
      currency: inputs.currency || 'JPY',
      unit: inputs.unit || 'million',
      steps,
      metadata: {
        method: 'comparable',
        calculatedAt: new Date().toISOString(),
        version: VERSION,
        multiples,
        averageMultiple: avgMultiple(Object.values(multiples).map((m) => m.multiple)),
        medianMultiple,
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

function avgMultiple(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function calculateIndustryMultiples(
  companies: ComparableCompany[]
): Record<MultipleType, { min: number; max: number; average: number; median: number }> {
  const result: Record<string, { min: number; max: number; average: number; median: number }> = {}

  const types: MultipleType[] = ['PE', 'PB', 'EV_EBITDA', 'EV_REVENUE', 'PS']

  for (const type of types) {
    const values = companies
      .map((c) => calculateMultiple(c, type))
      .filter((v) => v > 0)
      .sort((a, b) => a - b)

    if (values.length > 0) {
      result[type] = {
        min: values[0],
        max: values[values.length - 1],
        average: values.reduce((a, b) => a + b, 0) / values.length,
        median: values[Math.floor(values.length / 2)],
      }
    }
  }

  return result as Record<
    MultipleType,
    { min: number; max: number; average: number; median: number }
  >
}

export function selectBestComparables(
  companies: ComparableCompany[],
  targetProfile: {
    industry?: string
    revenue?: number
    ebitdaMargin?: number
  },
  maxCount: number = 5
): ComparableCompany[] {
  const scored = companies.map((company) => {
    let score = 0

    if (targetProfile.revenue && company.revenue) {
      const revenueDiff = Math.abs(company.revenue - targetProfile.revenue) / targetProfile.revenue
      score += Math.max(0, 1 - revenueDiff) * 40
    }

    if (targetProfile.ebitdaMargin && company.ebitda && company.revenue) {
      const companyMargin = company.ebitda / company.revenue
      const marginDiff = Math.abs(companyMargin - targetProfile.ebitdaMargin)
      score += Math.max(0, 1 - marginDiff) * 30
    }

    score += 30

    return { company, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((s) => s.company)
}

export function formatComparableExplanation(result: ComparableResult): string {
  const lines: string[] = []

  lines.push(`Comparable Company Valuation Summary`)
  lines.push(`====================================`)
  lines.push(``)
  lines.push(`Enterprise Value: ${result.enterpriseValue.toLocaleString()} MM JPY`)
  lines.push(``)
  lines.push(`Multiples Used:`)

  for (const [type, data] of Object.entries(result.metadata.multiples)) {
    const typedType = type as MultipleType
    lines.push(
      `  ${getMultipleLabel(typedType)}: ${formatNumber(data.multiple, 2)}x → ${formatNumber(data.value)} MM`
    )
  }

  lines.push(``)
  lines.push(`Average Multiple: ${formatNumber(result.metadata.averageMultiple, 2)}x`)
  lines.push(`Median Multiple: ${formatNumber(result.metadata.medianMultiple, 2)}x`)
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
