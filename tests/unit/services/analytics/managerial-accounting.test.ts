import { describe, it, expect } from 'vitest'
import {
  classifyCostBehavior,
  buildCVPAggregateFromProfitLoss,
  calculateContributionMargin,
  calculateBreakEvenPoint,
  analyzeCVP,
  analyzeSegmentProfitability,
} from '@/services/analytics/managerial-accounting'
import type {
  CVPAggregate,
  CVPUnitInput,
  SegmentInput,
} from '@/services/analytics/managerial-accounting'
import { ERROR_CODES } from '@/types/result'
import type { ProfitLoss as DomainProfitLoss } from '@/types'

// Hand-computed fixtures (currency in JPY).
const AGG: CVPAggregate = { revenue: 20_000_000, variableCosts: 12_000_000, fixedCosts: 4_000_000 }
// CM = 8,000,000 ; CMR = 0.4 ; BE sales = 4,000,000 / 0.4 = 10,000,000

function unwrap<T>(r: { success: true; data: T } | { success: false; error: unknown }): T {
  if (!r.success) throw new Error(`expected success, got error: ${JSON.stringify(r.error)}`)
  return r.data
}

describe('managerial-accounting — cost-behavior split', () => {
  it('classifies 5xx as variable, 6xx/7xx as fixed by default', () => {
    const lines = [
      { accountCode: '5110', accountName: '売上原価', amount: 12_000_000 },
      { accountCode: '6210', accountName: '給料手当', amount: 3_000_000 },
      { accountCode: '7110', accountName: '広告宣伝費', amount: 500_000 },
      { accountCode: '9999', accountName: '不明費目', amount: 100_000 }, // unrecognized
    ]
    const out = unwrap(classifyCostBehavior(lines))
    expect(out.map((x) => [x.accountCode, x.behavior])).toEqual([
      ['5110', 'variable'],
      ['6210', 'fixed'],
      ['7110', 'fixed'],
      ['9999', 'fixed'], // conservative default for unrecognized codes
    ])
  })

  it('applies per-code overrides', () => {
    const out = unwrap(
      classifyCostBehavior([{ accountCode: '7110', accountName: '広告宣伝費', amount: 500_000 }], {
        overrides: { '7110': 'variable' },
      })
    )
    expect(out[0].behavior).toBe('variable')
  })

  it('returns VALIDATION_ERROR on non-finite amounts', () => {
    const r = classifyCostBehavior([{ accountCode: '5110', accountName: 'x', amount: NaN }])
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })
})

describe('managerial-accounting — buildCVPAggregateFromProfitLoss', () => {
  it('maps COGS→variable, SGA→fixed, sums revenue', () => {
    const pl: Partial<DomainProfitLoss> = {
      revenue: [{ code: '4110', name: '売上高', amount: 20_000_000 }],
      costOfSales: [{ code: '5110', name: '売上原価', amount: 12_000_000 }],
      sgaExpenses: [{ code: '6210', name: '販売費及び一般管理費', amount: 4_000_000 }],
    }
    const out = unwrap(buildCVPAggregateFromProfitLoss(pl))
    expect(out).toEqual({ revenue: 20_000_000, variableCosts: 12_000_000, fixedCosts: 4_000_000 })
  })

  it('tolerates empty arrays (missing period data) yielding zeros', () => {
    const out = unwrap(
      buildCVPAggregateFromProfitLoss({ revenue: [], costOfSales: [], sgaExpenses: [] })
    )
    expect(out).toEqual({ revenue: 0, variableCosts: 0, fixedCosts: 0 })
  })

  it('returns VALIDATION_ERROR on a non-object input', () => {
    const r = buildCVPAggregateFromProfitLoss(null)
    expect(r.success).toBe(false)
  })
})

describe('managerial-accounting — contribution margin', () => {
  it('golden: CM = 8,000,000, CMR = 0.4', () => {
    const out = unwrap(calculateContributionMargin(AGG))
    expect(out.contributionMargin).toBe(8_000_000)
    expect(out.contributionMarginRatio).toBeCloseTo(0.4, 10)
  })

  it('property: contributionMargin + variableCosts === revenue', () => {
    const out = unwrap(calculateContributionMargin(AGG))
    expect(out.contributionMargin + out.variableCosts).toBe(out.revenue)
  })

  it('edge: zero revenue → CMR null (undefined ratio)', () => {
    const out = unwrap(
      calculateContributionMargin({ revenue: 0, variableCosts: 0, fixedCosts: 5_000 })
    )
    expect(out.contributionMarginRatio).toBeNull()
    expect(out.contributionMargin).toBe(0)
  })

  it('edge: negative contribution margin (VC > revenue)', () => {
    const out = unwrap(
      calculateContributionMargin({ revenue: 1_000, variableCosts: 1_500, fixedCosts: 0 })
    )
    expect(out.contributionMargin).toBe(-500)
    expect(out.contributionMarginRatio).toBeCloseTo(-0.5, 10)
  })
})

describe('managerial-accounting — break-even (sales amount)', () => {
  it('golden: BE sales = 10,000,000', () => {
    const out = unwrap(calculateBreakEvenPoint(AGG))
    expect(out.defined).toBe(true)
    expect(out.breakEvenSales).toBeCloseTo(10_000_000, 2)
  })

  it('edge: fixedCosts = 0 → BE sales = 0', () => {
    const out = unwrap(calculateBreakEvenPoint({ revenue: 10, variableCosts: 4, fixedCosts: 0 }))
    expect(out.defined).toBe(true)
    expect(out.breakEvenSales).toBe(0)
  })

  it('edge: revenue = 0 → undefined (CMR null)', () => {
    const out = unwrap(calculateBreakEvenPoint({ revenue: 0, variableCosts: 0, fixedCosts: 5_000 }))
    expect(out.defined).toBe(false)
    expect(out.breakEvenSales).toBeNull()
    expect(out.reason).toContain('undefined')
  })

  it('edge: CMR exactly 0 (revenue == variableCosts) → no finite break-even', () => {
    const out = unwrap(
      calculateBreakEvenPoint({ revenue: 10_000, variableCosts: 10_000, fixedCosts: 5_000 })
    )
    expect(out.defined).toBe(false)
    expect(out.breakEvenSales).toBeNull()
    expect(out.contributionMarginRatio).toBe(0)
  })

  it('edge: CMR negative (VC > revenue) → no finite break-even', () => {
    const out = unwrap(
      calculateBreakEvenPoint({ revenue: 1_000, variableCosts: 2_000, fixedCosts: 5_000 })
    )
    expect(out.defined).toBe(false)
  })

  it('returns VALIDATION_ERROR on non-finite input', () => {
    const r = calculateBreakEvenPoint({ revenue: Infinity, variableCosts: 1, fixedCosts: 1 })
    expect(r.success).toBe(false)
  })
})

describe('managerial-accounting — CVP (unit volume)', () => {
  // price 1,000/unit ; varCost 600/unit ; fixed 4,000,000 ; volume 20,000 ; target 2,000,000
  const UNIT: CVPUnitInput = {
    sellingPricePerUnit: 1_000,
    variableCostPerUnit: 600,
    fixedCosts: 4_000_000,
    volume: 20_000,
    targetProfit: 2_000_000,
  }

  it('golden: CM/unit 400, CMR 0.4, BE volume 10,000, BE sales 10,000,000', () => {
    const out = unwrap(analyzeCVP(UNIT))
    expect(out.contributionMarginPerUnit).toBe(400)
    expect(out.contributionMarginRatio).toBeCloseTo(0.4, 10)
    expect(out.breakEvenVolume).toBe(10_000)
    expect(out.breakEvenSales).toBe(10_000_000)
  })

  it('golden: target-profit volume = (FC + target)/CM = 15,000 units', () => {
    const out = unwrap(analyzeCVP(UNIT))
    expect(out.targetProfitVolume).toBe(15_000)
  })

  it('golden: actualSales 20,000,000, OI 4,000,000, MoS amount 10,000,000, MoS ratio 0.5, DOL 2.0', () => {
    const out = unwrap(analyzeCVP(UNIT))
    expect(out.actualSales).toBe(20_000_000)
    expect(out.operatingIncome).toBe(4_000_000)
    expect(out.marginOfSafetyAmount).toBe(10_000_000)
    expect(out.marginOfSafetyRatio).toBeCloseTo(0.5, 10)
    expect(out.degreeOfOperatingLeverage).toBeCloseTo(2.0, 10)
  })

  it('property: at targetProfitVolume, operatingIncome === targetProfit', () => {
    const out = unwrap(analyzeCVP(UNIT))
    const tpv = out.targetProfitVolume!
    const oiAtTarget = out.contributionMarginPerUnit * tpv - UNIT.fixedCosts
    expect(oiAtTarget).toBeCloseTo(UNIT.targetProfit!, 6)
  })

  it('property: DOL predicts %ΔNOI for a %Δsales (10% sales rise → 20% NOI rise)', () => {
    const base = unwrap(analyzeCVP(UNIT))
    const risen = unwrap(analyzeCVP({ ...UNIT, volume: UNIT.volume! * 1.1 }))
    const noiGrowthPct = (risen.operatingIncome! - base.operatingIncome!) / base.operatingIncome!
    const salesGrowthPct = (risen.actualSales! - base.actualSales!) / base.actualSales!
    expect(noiGrowthPct / salesGrowthPct).toBeCloseTo(base.degreeOfOperatingLeverage!, 6)
  })

  it('edge: operating at break-even volume → DOL null (undefined)', () => {
    const out = unwrap(analyzeCVP({ ...UNIT, volume: 10_000 }))
    expect(out.operatingIncome).toBe(0)
    expect(out.degreeOfOperatingLeverage).toBeNull()
    expect(out.marginOfSafetyAmount).toBe(0)
  })

  it('edge: volume below break-even → negative margin of safety', () => {
    const out = unwrap(analyzeCVP({ ...UNIT, volume: 6_000 }))
    expect(out.defined).toBe(true)
    expect(out.marginOfSafetyAmount!).toBeLessThan(0)
    expect(out.operatingIncome!).toBeLessThan(0)
  })

  it('edge: CM/unit == 0 (price == varCost) → undefined break-even, null target volume', () => {
    const out = unwrap(
      analyzeCVP({
        sellingPricePerUnit: 1_000,
        variableCostPerUnit: 1_000,
        fixedCosts: 4_000,
        targetProfit: 100,
      })
    )
    expect(out.defined).toBe(false)
    expect(out.breakEvenVolume).toBeNull()
    expect(out.targetProfitVolume).toBeNull()
  })

  it('edge: CM/unit < 0 (price < varCost) → undefined break-even', () => {
    const out = unwrap(
      analyzeCVP({ sellingPricePerUnit: 500, variableCostPerUnit: 600, fixedCosts: 4_000 })
    )
    expect(out.defined).toBe(false)
  })

  it('edge: targetProfit omitted → targetProfitVolume null even when defined', () => {
    const out = unwrap(
      analyzeCVP({ sellingPricePerUnit: 1_000, variableCostPerUnit: 600, fixedCosts: 4_000 })
    )
    expect(out.defined).toBe(true)
    expect(out.targetProfitVolume).toBeNull()
  })

  it('returns VALIDATION_ERROR on negative volume', () => {
    const r = analyzeCVP({
      sellingPricePerUnit: 1,
      variableCostPerUnit: 0,
      fixedCosts: 0,
      volume: -1,
    })
    expect(r.success).toBe(false)
  })
})

describe('managerial-accounting — segment profitability', () => {
  const SEGMENTS: SegmentInput[] = [
    {
      segmentId: 'A',
      segmentName: '製品A',
      revenue: 10_000_000,
      variableCosts: 4_000_000,
      traceableFixedCosts: 1_500_000,
    },
    {
      segmentId: 'B',
      segmentName: '製品B',
      revenue: 8_000_000,
      variableCosts: 4_800_000,
      traceableFixedCosts: 1_000_000,
    },
  ]
  // A: CM 6,000,000 CMR 0.6 segMargin 4,500,000 SMR 0.45
  // B: CM 3,200,000 CMR 0.4 segMargin 2,200,000 SMR 0.275
  // totals: rev 18,000,000 VC 8,800,000 CM 9,200,000 traceable 2,500,000 segMargin 6,700,000
  const COMMON = 1_200_000

  it('golden: per-segment margins', () => {
    const out = unwrap(
      analyzeSegmentProfitability({ segments: SEGMENTS, commonFixedCosts: COMMON })
    )
    const [a, b] = out.segments
    expect(a.contributionMargin).toBe(6_000_000)
    expect(a.contributionMarginRatio).toBeCloseTo(0.6, 10)
    expect(a.segmentMargin).toBe(4_500_000)
    expect(a.segmentMarginRatio).toBeCloseTo(0.45, 10)
    expect(b.contributionMargin).toBe(3_200_000)
    expect(b.segmentMargin).toBe(2_200_000)
    expect(b.segmentMarginRatio).toBeCloseTo(0.275, 10)
  })

  it('golden: totals and company NOI = 6,700,000 − 1,200,000 = 5,500,000', () => {
    const out = unwrap(
      analyzeSegmentProfitability({ segments: SEGMENTS, commonFixedCosts: COMMON })
    )
    expect(out.totals).toEqual({
      revenue: 18_000_000,
      variableCosts: 8_800_000,
      contributionMargin: 9_200_000,
      traceableFixedCosts: 2_500_000,
      segmentMargin: 6_700_000,
    })
    expect(out.companyNetOperatingIncome).toBe(5_500_000)
  })

  it('defaults commonFixedCosts to 0 when omitted', () => {
    const out = unwrap(analyzeSegmentProfitability({ segments: SEGMENTS }))
    expect(out.commonFixedCosts).toBe(0)
    expect(out.companyNetOperatingIncome).toBe(6_700_000)
  })

  it('property: Σ segment CM === totals CM; Σ segment margin === totals segment margin', () => {
    const out = unwrap(
      analyzeSegmentProfitability({ segments: SEGMENTS, commonFixedCosts: COMMON })
    )
    const sumCM = out.segments.reduce((s, x) => s + x.contributionMargin, 0)
    const sumSM = out.segments.reduce((s, x) => s + x.segmentMargin, 0)
    expect(sumCM).toBe(out.totals.contributionMargin)
    expect(sumSM).toBe(out.totals.segmentMargin)
  })

  it('property: each segmentMargin === CM − traceableFixedCosts', () => {
    const out = unwrap(
      analyzeSegmentProfitability({ segments: SEGMENTS, commonFixedCosts: COMMON })
    )
    for (const s of out.segments) {
      expect(s.segmentMargin).toBe(s.contributionMargin - s.traceableFixedCosts)
    }
  })

  it('property: companyNOI === totals.segmentMargin − commonFixedCosts', () => {
    const out = unwrap(
      analyzeSegmentProfitability({ segments: SEGMENTS, commonFixedCosts: COMMON })
    )
    expect(out.companyNetOperatingIncome).toBe(out.totals.segmentMargin - out.commonFixedCosts)
  })

  it('edge: missing-period segment (revenue 0) → ratios null, amounts computed', () => {
    const out = unwrap(
      analyzeSegmentProfitability({
        segments: [
          {
            segmentId: 'A',
            segmentName: '製品A',
            revenue: 0,
            variableCosts: 0,
            traceableFixedCosts: 500,
          },
        ],
      })
    )
    expect(out.segments[0].contributionMarginRatio).toBeNull()
    expect(out.segments[0].segmentMarginRatio).toBeNull()
    expect(out.segments[0].segmentMargin).toBe(-500)
    expect(out.companyNetOperatingIncome).toBe(-500)
  })

  it('edge: empty segments array → VALIDATION_ERROR', () => {
    const r = analyzeSegmentProfitability({ segments: [] })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.code).toBe(ERROR_CODES.VALIDATION_ERROR)
  })

  it('edge: non-finite segment field → VALIDATION_ERROR', () => {
    const r = analyzeSegmentProfitability({
      segments: [
        {
          segmentId: 'A',
          segmentName: '製品A',
          revenue: NaN,
          variableCosts: 0,
          traceableFixedCosts: 0,
        },
      ],
    })
    expect(r.success).toBe(false)
  })
})
