import type {
  ScenarioInputs,
  ScenarioResult,
  SensitivityInputs,
  SensitivityResult,
  DCFInputs,
  CalculationStep,
  Result,
  ValuationError,
} from './types'
import { calculateDCF } from './dcf'

const _VERSION = '1.0.0'

function createError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ValuationError {
  return { code, message, details }
}

function generateId(): string {
  return `scenario_step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function applyAdjustments(
  baseInputs: DCFInputs,
  adjustments: Record<string, { factor: number; type: 'multiply' | 'add' | 'set' }>
): DCFInputs {
  const adjusted = { ...baseInputs }

  for (const [key, adjustment] of Object.entries(adjustments)) {
    const inputKey = key as keyof DCFInputs
    if (inputKey in adjusted && typeof adjusted[inputKey] === 'number') {
      const currentValue = adjusted[inputKey] as number
      switch (adjustment.type) {
        case 'multiply':
          ;(adjusted as Record<string, unknown>)[inputKey] = currentValue * adjustment.factor
          break
        case 'add':
          ;(adjusted as Record<string, unknown>)[inputKey] = currentValue + adjustment.factor
          break
        case 'set':
          ;(adjusted as Record<string, unknown>)[inputKey] = adjustment.factor
          break
      }
    }
  }

  return adjusted
}

export function calculateScenario(inputs: ScenarioInputs): Result<ScenarioResult> {
  const { baseInputs, scenarios } = inputs

  if (!scenarios || scenarios.length === 0) {
    return {
      success: false,
      error: createError('invalid_input', 'At least one scenario is required'),
    }
  }

  const validTypes = ['optimistic', 'base', 'pessimistic']
  for (const scenario of scenarios) {
    if (!validTypes.includes(scenario.type)) {
      return {
        success: false,
        error: createError(
          'invalid_input',
          `Invalid scenario type: ${scenario.type}. Must be one of: ${validTypes.join(', ')}`
        ),
      }
    }
  }

  try {
    const steps: CalculationStep[] = []
    const scenarioResults: ScenarioResult['scenarios'] = []

    for (const scenario of scenarios) {
      const adjustedInputs = applyAdjustments(baseInputs, scenario.adjustments)
      const result = calculateDCF(adjustedInputs)

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        }
      }

      scenarioResults.push({
        name: scenario.name,
        type: scenario.type,
        value: result.data.enterpriseValue,
        probability: scenario.type === 'base' ? 0.5 : scenario.type === 'optimistic' ? 0.25 : 0.25,
        inputs: {
          growthRate: adjustedInputs.growthRate,
          discountRate: adjustedInputs.discountRate,
        },
      })

      steps.push({
        id: generateId(),
        name: `${scenario.name} Scenario`,
        description: `DCF valuation with ${scenario.type} assumptions`,
        formula: 'DCF with adjusted inputs',
        formulaWithValues: `Growth: ${adjustedInputs.growthRate}%, Terminal: ${adjustedInputs.terminalGrowthRate ?? 0}%, WACC: ${adjustedInputs.discountRate}% → EV: ${formatNumber(result.data.enterpriseValue)}`,
        inputs: {},
        output: result.data.enterpriseValue,
        unit: baseInputs.unit || 'million',
      })
    }

    const values = scenarioResults.map((s) => s.value)
    const min = Math.min(...values)
    const max = Math.max(...values)

    const baseScenario = scenarioResults.find((s) => s.type === 'base')
    const optimisticScenario = scenarioResults.find((s) => s.type === 'optimistic')
    const pessimisticScenario = scenarioResults.find((s) => s.type === 'pessimistic')

    let weightedAverage: number
    if (baseScenario && optimisticScenario && pessimisticScenario) {
      weightedAverage =
        baseScenario.value * 0.5 +
        optimisticScenario.value * 0.25 +
        pessimisticScenario.value * 0.25
    } else {
      weightedAverage = values.reduce((a, b) => a + b, 0) / values.length
    }

    steps.push({
      id: generateId(),
      name: 'Weighted Average',
      description: 'Probability-weighted enterprise value',
      formula: 'EV = Σ(Probability × Scenario EV)',
      formulaWithValues: scenarios
        .map((s, i) => `${s.name}: ${formatNumber(scenarioResults[i].value)}`)
        .join(' + '),
      inputs: {},
      output: weightedAverage,
      unit: baseInputs.unit || 'million',
    })

    const scenarioResult: ScenarioResult = {
      scenarios: scenarioResults,
      weightedAverage: Math.round(weightedAverage),
      range: { min: Math.round(min), max: Math.round(max) },
      steps,
    }

    return { success: true, data: scenarioResult }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during scenario analysis'
      ),
    }
  }
}

export function calculateSensitivity(inputs: SensitivityInputs): Result<SensitivityResult> {
  const { baseInputs, variable1, variable2 } = inputs

  const validKeys: (keyof DCFInputs)[] = [
    'freeCashFlow',
    'growthRate',
    'terminalGrowthRate',
    'discountRate',
    'projectionYears',
  ]

  if (!validKeys.includes(variable1.name)) {
    return {
      success: false,
      error: createError(
        'invalid_input',
        `Invalid variable1: ${String(variable1.name)}. Must be one of: ${validKeys.join(', ')}`
      ),
    }
  }

  if (!validKeys.includes(variable2.name)) {
    return {
      success: false,
      error: createError(
        'invalid_input',
        `Invalid variable2: ${String(variable2.name)}. Must be one of: ${validKeys.join(', ')}`
      ),
    }
  }

  if (variable1.steps < 2 || variable1.steps > 20) {
    return {
      success: false,
      error: createError('invalid_input', 'variable1 steps must be between 2 and 20'),
    }
  }

  if (variable2.steps < 2 || variable2.steps > 20) {
    return {
      success: false,
      error: createError('invalid_input', 'variable2 steps must be between 2 and 20'),
    }
  }

  try {
    const rowValues: number[] = []
    const columnValues: number[] = []

    const rowStep = (variable1.max - variable1.min) / (variable1.steps - 1)
    for (let i = 0; i < variable1.steps; i++) {
      rowValues.push(variable1.min + i * rowStep)
    }

    const colStep = (variable2.max - variable2.min) / (variable2.steps - 1)
    for (let i = 0; i < variable2.steps; i++) {
      columnValues.push(variable2.min + i * colStep)
    }

    const matrix: SensitivityResult['matrix'] = []

    for (const rowValue of rowValues) {
      const row: SensitivityResult['matrix'][0] = []

      for (const colValue of columnValues) {
        const modifiedInputs = { ...baseInputs }
        ;(modifiedInputs as Record<string, unknown>)[variable1.name] = rowValue
        ;(modifiedInputs as Record<string, unknown>)[variable2.name] = colValue

        const result = calculateDCF(modifiedInputs)
        const enterpriseValue = result.success ? result.data.enterpriseValue : 0

        row.push({
          rowValue,
          columnValue: colValue,
          result: enterpriseValue,
        })
      }

      matrix.push(row)
    }

    const sensitivityResult: SensitivityResult = {
      matrix,
      rowVariable: String(variable1.name),
      columnVariable: String(variable2.name),
      rowValues,
      columnValues,
    }

    return { success: true, data: sensitivityResult }
  } catch (error) {
    return {
      success: false,
      error: createError(
        'calculation_error',
        error instanceof Error ? error.message : 'Unknown error during sensitivity analysis'
      ),
    }
  }
}

export function getDefaultScenarios(): ScenarioInputs['scenarios'] {
  return [
    {
      name: 'Optimistic',
      type: 'optimistic',
      adjustments: {
        growthRate: { factor: 1.2, type: 'multiply' },
        terminalGrowthRate: { factor: 1.1, type: 'multiply' },
        discountRate: { factor: 0.9, type: 'multiply' },
      },
    },
    {
      name: 'Base Case',
      type: 'base',
      adjustments: {},
    },
    {
      name: 'Pessimistic',
      type: 'pessimistic',
      adjustments: {
        growthRate: { factor: 0.8, type: 'multiply' },
        terminalGrowthRate: { factor: 0.9, type: 'multiply' },
        discountRate: { factor: 1.1, type: 'multiply' },
      },
    },
  ]
}

export function formatScenarioExplanation(result: ScenarioResult): string {
  const lines: string[] = []

  lines.push(`Scenario Analysis Summary`)
  lines.push(`=========================`)
  lines.push(``)
  lines.push(`Weighted Average: ${result.weightedAverage.toLocaleString()} MM`)
  lines.push(
    `Range: ${result.range.min.toLocaleString()} - ${result.range.max.toLocaleString()} MM`
  )
  lines.push(``)
  lines.push(`Scenarios:`)

  for (const scenario of result.scenarios) {
    const prob = scenario.probability ? ` (${(scenario.probability * 100).toFixed(0)}%)` : ''
    lines.push(`  ${scenario.name}${prob}: ${scenario.value.toLocaleString()} MM`)
  }

  lines.push(``)
  lines.push(`Calculation Steps:`)
  result.steps.forEach((step, index) => {
    lines.push(``)
    lines.push(`${index + 1}. ${step.name}`)
    lines.push(`   ${step.description}`)
    lines.push(`   ${step.formulaWithValues}`)
  })

  return lines.join('\n')
}

export function formatSensitivityMatrix(result: SensitivityResult): string {
  const lines: string[] = []

  lines.push(`Sensitivity Analysis Matrix`)
  lines.push(`===========================`)
  lines.push(``)
  lines.push(`Row: ${result.rowVariable}`)
  lines.push(`Column: ${result.columnVariable}`)
  lines.push(``)

  const header =
    '          | ' + result.columnValues.map((v) => v.toFixed(1).padStart(10)).join(' | ')
  lines.push(header)
  lines.push('-'.repeat(header.length))

  for (let i = 0; i < result.matrix.length; i++) {
    const row = result.matrix[i]
    const rowLabel = result.rowValues[i].toFixed(1).padStart(8)
    const values = row.map((cell) => cell.result.toFixed(0).padStart(10)).join(' | ')
    lines.push(`${rowLabel} | ${values}`)
  }

  return lines.join('\n')
}
