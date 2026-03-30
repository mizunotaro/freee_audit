import { describe, it, expect } from 'vitest'
import {
  calculateScenario,
  calculateSensitivity,
  getDefaultScenarios,
  formatScenarioExplanation,
  formatSensitivityMatrix,
} from '@/services/valuation/scenario'

describe('calculateScenario', () => {
  const baseInputs = {
    freeCashFlow: 1000,
    growthRate: 5,
    terminalGrowthRate: 2,
    discountRate: 10,
    projectionYears: 5,
  }

  it('calculates three scenarios', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        {
          name: 'Optimistic',
          type: 'optimistic',
          adjustments: {
            growthRate: { factor: 1.2, type: 'multiply' },
          },
        },
        {
          name: 'Base',
          type: 'base',
          adjustments: {},
        },
        {
          name: 'Pessimistic',
          type: 'pessimistic',
          adjustments: {
            growthRate: { factor: 0.8, type: 'multiply' },
          },
        },
      ],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.scenarios).toHaveLength(3)
      expect(result.data.weightedAverage).toBeGreaterThan(0)
      expect(result.data.range.min).toBeGreaterThan(0)
      expect(result.data.range.max).toBeGreaterThan(0)
      expect(result.data.range.max).toBeGreaterThanOrEqual(result.data.range.min)
    }
  })

  it('calculates weighted average with all three scenario types', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        {
          name: 'Opt',
          type: 'optimistic',
          adjustments: { growthRate: { factor: 1.5, type: 'multiply' } },
        },
        { name: 'Base', type: 'base', adjustments: {} },
        {
          name: 'Pess',
          type: 'pessimistic',
          adjustments: { growthRate: { factor: 0.5, type: 'multiply' } },
        },
      ],
    })
    if (result.success) {
      const opt = result.data.scenarios.find((s) => s.type === 'optimistic')!
      const base = result.data.scenarios.find((s) => s.type === 'base')!
      const pess = result.data.scenarios.find((s) => s.type === 'pessimistic')!
      const expected = opt.value * 0.25 + base.value * 0.5 + pess.value * 0.25
      expect(result.data.weightedAverage).toBe(Math.round(expected))
    }
  })

  it('uses simple average when not all three types present', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        {
          name: 'Case A',
          type: 'optimistic',
          adjustments: { growthRate: { factor: 1.5, type: 'multiply' } },
        },
        {
          name: 'Case B',
          type: 'pessimistic',
          adjustments: { growthRate: { factor: 0.5, type: 'multiply' } },
        },
      ],
    })
    if (result.success) {
      const avg =
        result.data.scenarios.reduce((s, sc) => s + sc.value, 0) / result.data.scenarios.length
      expect(result.data.weightedAverage).toBe(Math.round(avg))
    }
  })

  it('rejects empty scenarios', () => {
    const result = calculateScenario({ baseInputs, scenarios: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('scenario')
    }
  })

  it('rejects invalid scenario type', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [{ name: 'Bad', type: 'invalid' as 'optimistic', adjustments: {} }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Invalid scenario type')
    }
  })

  it('propagates DCF errors', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        {
          name: 'Bad',
          type: 'optimistic',
          adjustments: { freeCashFlow: { factor: 0, type: 'set' } },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('applies multiply adjustment', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        { name: 'Base', type: 'base', adjustments: {} },
        {
          name: 'Double',
          type: 'optimistic',
          adjustments: { growthRate: { factor: 2, type: 'multiply' } },
        },
      ],
    })
    if (result.success) {
      const doubled = result.data.scenarios.find((s) => s.name === 'Double')!
      expect(doubled.inputs.growthRate).toBe(10)
    }
  })

  it('applies add adjustment', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        {
          name: 'Plus',
          type: 'optimistic',
          adjustments: { discountRate: { factor: 2, type: 'add' } },
        },
      ],
    })
    if (result.success) {
      expect(result.data.scenarios[0].inputs.discountRate).toBe(12)
    }
  })

  it('applies set adjustment', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        { name: 'Set', type: 'base', adjustments: { growthRate: { factor: 15, type: 'set' } } },
      ],
    })
    if (result.success) {
      expect(result.data.scenarios[0].inputs.growthRate).toBe(15)
    }
  })

  it('assigns correct probabilities', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        { name: 'Opt', type: 'optimistic', adjustments: {} },
        { name: 'Base', type: 'base', adjustments: {} },
        { name: 'Pess', type: 'pessimistic', adjustments: {} },
      ],
    })
    if (result.success) {
      expect(result.data.scenarios.find((s) => s.type === 'base')!.probability).toBe(0.5)
      expect(result.data.scenarios.find((s) => s.type === 'optimistic')!.probability).toBe(0.25)
      expect(result.data.scenarios.find((s) => s.type === 'pessimistic')!.probability).toBe(0.25)
    }
  })

  it('includes steps for each scenario plus weighted average', () => {
    const result = calculateScenario({
      baseInputs,
      scenarios: [
        { name: 'Opt', type: 'optimistic', adjustments: {} },
        { name: 'Base', type: 'base', adjustments: {} },
        { name: 'Pess', type: 'pessimistic', adjustments: {} },
      ],
    })
    if (result.success) {
      expect(result.data.steps).toHaveLength(4)
    }
  })
})

describe('calculateSensitivity', () => {
  const baseInputs = {
    freeCashFlow: 1000,
    growthRate: 5,
    terminalGrowthRate: 2,
    discountRate: 10,
    projectionYears: 5,
  }

  it('generates a sensitivity matrix', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'growthRate', min: 1, max: 10, steps: 3 },
      variable2: { name: 'discountRate', min: 5, max: 15, steps: 3 },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.matrix).toHaveLength(3)
      expect(result.data.matrix[0]).toHaveLength(3)
      expect(result.data.rowVariable).toBe('growthRate')
      expect(result.data.columnVariable).toBe('discountRate')
      expect(result.data.rowValues).toHaveLength(3)
      expect(result.data.columnValues).toHaveLength(3)
    }
  })

  it('matrix cells contain EV or 0', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'growthRate', min: 3, max: 7, steps: 2 },
      variable2: { name: 'discountRate', min: 8, max: 12, steps: 2 },
    })
    if (result.success) {
      for (const row of result.data.matrix) {
        for (const cell of row) {
          expect(typeof cell.result).toBe('number')
          expect(cell.result).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('rejects invalid variable1 name', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'invalid' as 'growthRate', min: 1, max: 10, steps: 3 },
      variable2: { name: 'discountRate', min: 5, max: 15, steps: 3 },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('variable1')
    }
  })

  it('rejects invalid variable2 name', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'growthRate', min: 1, max: 10, steps: 3 },
      variable2: { name: 'invalid' as 'discountRate', min: 5, max: 15, steps: 3 },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('variable2')
    }
  })

  it('rejects variable1 steps < 2', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'growthRate', min: 1, max: 10, steps: 1 },
      variable2: { name: 'discountRate', min: 5, max: 15, steps: 3 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects variable2 steps > 20', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'growthRate', min: 1, max: 10, steps: 3 },
      variable2: { name: 'discountRate', min: 5, max: 15, steps: 21 },
    })
    expect(result.success).toBe(false)
  })

  it('returns 0 for cells with invalid DCF inputs', () => {
    const result = calculateSensitivity({
      baseInputs,
      variable1: { name: 'freeCashFlow', min: -100, max: 0, steps: 2 },
      variable2: { name: 'discountRate', min: 8, max: 12, steps: 2 },
    })
    if (result.success) {
      for (const row of result.data.matrix) {
        for (const cell of row) {
          expect(cell.result).toBe(0)
        }
      }
    }
  })
})

describe('getDefaultScenarios', () => {
  it('returns three default scenarios', () => {
    const scenarios = getDefaultScenarios()
    expect(scenarios).toHaveLength(3)
    expect(scenarios.map((s) => s.type)).toEqual(['optimistic', 'base', 'pessimistic'])
  })

  it('optimistic multiplies growth rate up', () => {
    const scenarios = getDefaultScenarios()
    const opt = scenarios.find((s) => s.type === 'optimistic')!
    expect(opt.adjustments.growthRate!.factor).toBe(1.2)
    expect(opt.adjustments.discountRate!.factor).toBe(0.9)
  })

  it('base has no adjustments', () => {
    const scenarios = getDefaultScenarios()
    const base = scenarios.find((s) => s.type === 'base')!
    expect(Object.keys(base.adjustments)).toHaveLength(0)
  })

  it('pessimistic multiplies growth rate down', () => {
    const scenarios = getDefaultScenarios()
    const pess = scenarios.find((s) => s.type === 'pessimistic')!
    expect(pess.adjustments.growthRate!.factor).toBe(0.8)
    expect(pess.adjustments.discountRate!.factor).toBe(1.1)
  })
})

describe('formatScenarioExplanation', () => {
  it('formats scenario result', () => {
    const result = calculateScenario({
      baseInputs: {
        freeCashFlow: 1000,
        growthRate: 5,
        terminalGrowthRate: 2,
        discountRate: 10,
        projectionYears: 5,
      },
      scenarios: [
        { name: 'Opt', type: 'optimistic', adjustments: {} },
        { name: 'Base', type: 'base', adjustments: {} },
        { name: 'Pess', type: 'pessimistic', adjustments: {} },
      ],
    })
    if (result.success) {
      const text = formatScenarioExplanation(result.data)
      expect(text).toContain('Scenario Analysis Summary')
      expect(text).toContain('Weighted Average')
      expect(text).toContain('Range')
      expect(text).toContain('Opt')
      expect(text).toContain('Base')
      expect(text).toContain('Pess')
    }
  })
})

describe('formatSensitivityMatrix', () => {
  it('formats sensitivity matrix as table', () => {
    const result = calculateSensitivity({
      baseInputs: {
        freeCashFlow: 1000,
        growthRate: 5,
        terminalGrowthRate: 2,
        discountRate: 10,
        projectionYears: 5,
      },
      variable1: { name: 'growthRate', min: 3, max: 7, steps: 2 },
      variable2: { name: 'discountRate', min: 8, max: 12, steps: 2 },
    })
    if (result.success) {
      const text = formatSensitivityMatrix(result.data)
      expect(text).toContain('Sensitivity Analysis Matrix')
      expect(text).toContain('growthRate')
      expect(text).toContain('discountRate')
    }
  })
})
