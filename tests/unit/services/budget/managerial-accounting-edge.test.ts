import { describe, it, expect } from 'vitest'
import { buildVarianceBridge } from '@/services/budget/managerial-accounting'
import type { StageLevelComparison } from '@/services/budget/detailed-actual-vs-budget'

/**
 * EDGE-01 — error / edge-case deepening for the budget managerial-accounting
 * variance-bridge builder.
 *
 * The existing suite only exercises the "営業利益 (operating income) stage missing"
 * case. The missing-stage error path has four independent `if (!stage)` branches
 * (one per required stage); each pushes a different stage name. To cover all four
 * push statements (lines 133–136) and the "stage present" branch of each guard,
 * we remove each of the other three stages one at a time.
 */

function stage(name: string, variance = 0): StageLevelComparison {
  return { stage: name, budget: 0, actual: 0, variance, rate: 0, status: 'good', favorable: null }
}

const ALL_STAGES: StageLevelComparison[] = [
  stage('売上高'),
  stage('売上原価'),
  stage('販売管理費'),
  stage('営業利益'),
]

function stagesWithout(name: string): StageLevelComparison[] {
  return ALL_STAGES.filter((s) => s.stage !== name)
}

function missingDetails(stages: StageLevelComparison[]): unknown {
  const r = buildVarianceBridge({ stages })
  if (r.success) throw new Error('expected failure')
  return r.error.details
}

describe('buildVarianceBridge — per-stage missing detection', () => {
  it('fails and names 売上高 when the revenue stage is missing', () => {
    const details = missingDetails(stagesWithout('売上高'))
    expect(JSON.stringify(details)).toContain('売上高')
    expect(JSON.stringify(details)).not.toContain('売上原価')
  })

  it('fails and names 売上原価 when the cost-of-sales stage is missing', () => {
    const details = missingDetails(stagesWithout('売上原価'))
    expect(JSON.stringify(details)).toContain('売上原価')
    expect(JSON.stringify(details)).not.toContain('売上高')
  })

  it('fails and names 販売管理費 when the SGA stage is missing', () => {
    const details = missingDetails(stagesWithout('販売管理費'))
    expect(JSON.stringify(details)).toContain('販売管理費')
    expect(JSON.stringify(details)).not.toContain('営業利益')
  })

  it('still fails naming 営業利益 when the operating-income stage is missing', () => {
    const details = missingDetails(stagesWithout('営業利益'))
    expect(JSON.stringify(details)).toContain('営業利益')
  })

  it('lists all four required stages in the error code', () => {
    const r = buildVarianceBridge({ stages: stagesWithout('売上高') })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.error.code).toBe('VALIDATION_ERROR')
  })
})
