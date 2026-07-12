import { describe, it, expect } from 'vitest'
import type {
  PeriodRange,
  ComparisonData,
  TrendData,
  ChartDataPoint,
  StatusBadge,
} from '@/types/reports/common'

describe('src/types/reports/common', () => {
  describe('PeriodRange', () => {
    it('constructs with a start and end date', () => {
      const startDate = new Date('2026-01-01T00:00:00.000Z')
      const endDate = new Date('2026-12-31T23:59:59.999Z')
      const range: PeriodRange = { startDate, endDate }

      expect(range.startDate).toBe(startDate)
      expect(range.endDate).toBe(endDate)
      expect(range.startDate).toBeInstanceOf(Date)
      expect(range.endDate).toBeInstanceOf(Date)
    })

    it('supports a zero-length range (start equals end)', () => {
      const same = new Date('2026-07-12T00:00:00.000Z')
      const range: PeriodRange = { startDate: same, endDate: same }

      expect(range.startDate.getTime()).toBe(range.endDate.getTime())
    })

    it('preserves a reversed range as-is (end before start is plain data)', () => {
      const range: PeriodRange = {
        startDate: new Date('2026-12-31T00:00:00.000Z'),
        endDate: new Date('2026-01-01T00:00:00.000Z'),
      }

      expect(range.endDate.getTime()).toBeLessThan(range.startDate.getTime())
    })

    it('holds epoch and far-past/far-future date boundaries', () => {
      const epoch: PeriodRange = { startDate: new Date(0), endDate: new Date(0) }
      const extremes: PeriodRange = {
        startDate: new Date(-8.64e15),
        endDate: new Date(8.64e15),
      }

      expect(epoch.startDate.getTime()).toBe(0)
      expect(extremes.startDate.getTime()).toBeLessThanOrEqual(extremes.endDate.getTime())
    })

    it('has exactly startDate and endDate, both Date', () => {
      const range: PeriodRange = {
        startDate: new Date(0),
        endDate: new Date(1),
      }

      expect(Object.keys(range).sort()).toEqual(['endDate', 'startDate'])
      expectTypeOf(range.startDate).toEqualTypeOf<Date>()
      expectTypeOf(range.endDate).toEqualTypeOf<Date>()
      expectTypeOf<PeriodRange>().toEqualTypeOf<{
        startDate: Date
        endDate: Date
      }>()
    })
  })

  describe('ComparisonData', () => {
    it('represents positive growth', () => {
      const data: ComparisonData = {
        current: 150,
        previous: 100,
        change: 50,
        changePercent: 50,
      }

      expect(data.change).toBe(data.current - data.previous)
      expect(data.changePercent).toBe(50)
    })

    it('represents a decline (negative change and percent)', () => {
      const data: ComparisonData = {
        current: 80,
        previous: 100,
        change: -20,
        changePercent: -20,
      }

      expect(data.change).toBeLessThan(0)
      expect(data.changePercent).toBeLessThan(0)
    })

    it('represents no change', () => {
      const data: ComparisonData = {
        current: 100,
        previous: 100,
        change: 0,
        changePercent: 0,
      }

      expect(data.change).toBe(0)
      expect(data.changePercent).toBe(0)
    })

    it('accepts numeric boundaries (0, MAX_VALUE, MIN_VALUE, Infinity, NaN)', () => {
      const boundaries: ComparisonData[] = [
        { current: 0, previous: 0, change: 0, changePercent: 0 },
        {
          current: Number.MAX_VALUE,
          previous: Number.MAX_VALUE,
          change: 0,
          changePercent: 0,
        },
        {
          current: Number.MIN_VALUE,
          previous: 0,
          change: Number.MIN_VALUE,
          changePercent: 100,
        },
        {
          current: Infinity,
          previous: -Infinity,
          change: Infinity,
          changePercent: NaN,
        },
      ]

      for (const data of boundaries) {
        expect(data.current).toBeTypeOf('number')
        expect(data.previous).toBeTypeOf('number')
        expect(data.change).toBeTypeOf('number')
        expect(data.changePercent).toBeTypeOf('number')
      }

      expect(boundaries[3].changePercent).toBeNaN()
    })

    it('has exactly four numeric fields', () => {
      const data: ComparisonData = {
        current: 1,
        previous: 2,
        change: 3,
        changePercent: 4,
      }

      expect(Object.keys(data).sort()).toEqual(['change', 'changePercent', 'current', 'previous'])
      expectTypeOf<ComparisonData>().toEqualTypeOf<{
        current: number
        previous: number
        change: number
        changePercent: number
      }>()
    })
  })

  describe('TrendData', () => {
    it('constructs a typical trend entry', () => {
      const trend: TrendData = {
        category: 'Liquidity',
        score: 88,
        status: 'healthy',
        summary: 'Strong cash position',
      }

      expect(trend.category).toBe('Liquidity')
      expect(trend.score).toBe(88)
      expect(trend.status).toBe('healthy')
      expect(trend.summary).toBe('Strong cash position')
    })

    it('accepts a zero and a negative score', () => {
      const zero: TrendData = {
        category: 'x',
        score: 0,
        status: 'none',
        summary: '',
      }
      const negative: TrendData = {
        category: 'y',
        score: -5,
        status: 'bad',
        summary: 's',
      }

      expect(zero.score).toBe(0)
      expect(negative.score).toBeLessThan(0)
    })

    it('accepts empty strings for every text field', () => {
      const trend: TrendData = {
        category: '',
        score: 1,
        status: '',
        summary: '',
      }

      expect(trend.category).toHaveLength(0)
      expect(trend.status).toHaveLength(0)
      expect(trend.summary).toHaveLength(0)
    })

    it('accepts fractional and large score values', () => {
      const fractional: TrendData = {
        category: 'a',
        score: 99.5,
        status: 'good',
        summary: 'a',
      }
      const huge: TrendData = {
        category: 'b',
        score: Number.MAX_VALUE,
        status: 'good',
        summary: 'b',
      }

      expect(fractional.score).toBe(99.5)
      expect(huge.score).toBe(Number.MAX_VALUE)
    })

    it('matches the declared field types exactly', () => {
      const trend: TrendData = {
        category: 'a',
        score: 1,
        status: 'b',
        summary: 'c',
      }

      expectTypeOf(trend.category).toBeString()
      expectTypeOf(trend.score).toBeNumber()
      expectTypeOf(trend.status).toBeString()
      expectTypeOf(trend.summary).toBeString()
      expectTypeOf<TrendData>().toEqualTypeOf<{
        category: string
        score: number
        status: string
        summary: string
      }>()
    })
  })

  describe('ChartDataPoint', () => {
    it('constructs with all fields populated', () => {
      const point: ChartDataPoint = {
        name: 'Revenue',
        value: 1000,
        previousValue: 900,
        color: '#22c55e',
      }

      expect(point.value).toBe(1000)
      expect(point.previousValue).toBe(900)
      expect(point.color).toBe('#22c55e')
    })

    it('omits optional previousValue and color', () => {
      const point: ChartDataPoint = { name: 'Revenue', value: 1000 }

      expect(point.previousValue).toBeUndefined()
      expect(point.color).toBeUndefined()
      expect(Object.keys(point).sort()).toEqual(['name', 'value'])
    })

    it('accepts a zero value and empty name', () => {
      const point: ChartDataPoint = { name: '', value: 0 }

      expect(point.value).toBe(0)
      expect(point.name).toHaveLength(0)
    })

    it('keeps previousValue numeric and color a string when present', () => {
      const point: ChartDataPoint = {
        name: 'x',
        value: 1,
        previousValue: NaN,
        color: '',
      }

      expect(point.previousValue).toBeTypeOf('number')
      expect(point.color).toBeTypeOf('string')
    })

    it('makes previousValue and color genuinely optional', () => {
      // Minimal object without optionals is a valid ChartDataPoint...
      const minimal = { name: 'n', value: 0 }
      expectTypeOf(minimal).toMatchTypeOf<ChartDataPoint>()

      // ...and the full declaration matches exactly (optionals included).
      expectTypeOf<ChartDataPoint>().toEqualTypeOf<{
        name: string
        value: number
        previousValue?: number
        color?: string
      }>()
    })

    it('rejects objects missing the required name field at the type level', () => {
      // An object without `name` is NOT a ChartDataPoint — required fields are enforced.
      expectTypeOf<{
        value: number
        previousValue?: number
        color?: string
      }>().not.toMatchTypeOf<ChartDataPoint>()
    })
  })

  describe('StatusBadge', () => {
    const STATUSES = ['good', 'warning', 'bad'] as const

    it.each(STATUSES)('accepts status "%s"', (status) => {
      const badge: StatusBadge = { status, label: `label-${status}` }

      expect(badge.status).toBe(status)
      expect(badge.label).toBe(`label-${status}`)
    })

    it('accepts an empty label', () => {
      const badge: StatusBadge = { status: 'good', label: '' }

      expect(badge.label).toHaveLength(0)
    })

    it('restricts status to exactly the good | warning | bad union', () => {
      const good: StatusBadge = { status: 'good', label: 'a' }
      const warning: StatusBadge = { status: 'warning', label: 'b' }
      const bad: StatusBadge = { status: 'bad', label: 'c' }

      expect([good.status, warning.status, bad.status]).toEqual([...STATUSES])
      expectTypeOf<StatusBadge['status']>().toEqualTypeOf<'good' | 'warning' | 'bad'>()
    })

    it('rejects out-of-union status values at the type level (safe state)', () => {
      // Unknown literal is not assignable to the status union...
      expectTypeOf<'unknown'>().not.toMatchTypeOf<StatusBadge['status']>()
      // ...and neither is a wider type like number.
      expectTypeOf<number>().not.toMatchTypeOf<StatusBadge['status']>()
    })

    it('matches the declared shape exactly', () => {
      const badge: StatusBadge = { status: 'good', label: 'ok' }

      expectTypeOf(badge.label).toBeString()
      expectTypeOf<StatusBadge>().toEqualTypeOf<{
        status: 'good' | 'warning' | 'bad'
        label: string
      }>()
    })
  })

  describe('module surface', () => {
    it('exposes all five report-common interfaces as resolvable type contracts', () => {
      // These are type-only exports (no runtime values). The fact that the file
      // compiles and each name resolves is the contract; assert via expectTypeOf.
      expectTypeOf<PeriodRange>().not.toBeAny()
      expectTypeOf<ComparisonData>().not.toBeAny()
      expectTypeOf<TrendData>().not.toBeAny()
      expectTypeOf<ChartDataPoint>().not.toBeAny()
      expectTypeOf<StatusBadge>().not.toBeAny()
    })
  })
})
