import { describe, it, expect } from 'vitest'

import {
  cn,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatChange,
  formatMonth,
  formatFiscalYear,
  parseCsv,
  getFiscalYear,
  getPreviousMonth,
  getPreviousYearSameMonth,
  addMonths,
  roundToDecimal,
  safeDivide,
  sumValues,
  getMonthName,
  getMonthNameShort,
  calculateGrowthRate,
} from '@/lib/utils'

describe('cn', () => {
  it('should join class names', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('should let later tailwind utility classes win over earlier conflicting ones', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('should drop falsy values', () => {
    expect(cn('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  it('should return an empty string when given no inputs', () => {
    expect(cn()).toBe('')
  })
})

describe('formatNumber', () => {
  it('should format null and undefined as a dash', () => {
    expect(formatNumber(null)).toBe('-')
    expect(formatNumber(undefined)).toBe('-')
  })

  it('should group thousands using ja-JP grouping', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('should format zero as 0', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

describe('formatCurrency', () => {
  it('should format null and undefined as a dash', () => {
    expect(formatCurrency(null)).toBe('-')
    expect(formatCurrency(undefined)).toBe('-')
  })

  it('should prefix yen and group thousands for the default JPY currency', () => {
    expect(formatCurrency(1234)).toBe('¥1,234')
    expect(formatCurrency(1234567)).toBe('¥1,234,567')
  })

  it('should prefix dollars and drop fractions for USD', () => {
    expect(formatCurrency(1234, 'USD')).toBe('$1,234')
    expect(formatCurrency(99.9, 'USD')).toBe('$100')
  })
})

describe('formatPercent', () => {
  it('should format null and undefined as a dash', () => {
    expect(formatPercent(null)).toBe('-')
    expect(formatPercent(undefined)).toBe('-')
  })

  it('should round to one decimal by default', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
  })

  it('should honour a custom decimal count', () => {
    expect(formatPercent(12.345, 2)).toBe('12.35%')
  })

  it('should pad a whole number to the requested decimals', () => {
    expect(formatPercent(50)).toBe('50.0%')
  })
})

describe('formatChange', () => {
  it('should return a neutral dash when the previous value is undefined', () => {
    expect(formatChange(100, undefined)).toEqual({
      value: 0,
      formatted: '-',
      trend: 'neutral',
    })
  })

  it('should return a neutral dash when the previous value is zero', () => {
    expect(formatChange(100, 0)).toEqual({
      value: 0,
      formatted: '-',
      trend: 'neutral',
    })
  })

  it('should flag an upward change with a plus sign', () => {
    expect(formatChange(120, 100)).toEqual({
      value: 20,
      formatted: '+20.0%',
      trend: 'up',
    })
  })

  it('should flag a downward change without a plus sign', () => {
    expect(formatChange(80, 100)).toEqual({
      value: -20,
      formatted: '-20.0%',
      trend: 'down',
    })
  })

  it('should treat an equal current/previous as neutral', () => {
    expect(formatChange(100, 100)).toEqual({
      value: 0,
      formatted: '0.0%',
      trend: 'neutral',
    })
  })
})

describe('formatMonth / formatFiscalYear', () => {
  it('should append 月 to a month number', () => {
    expect(formatMonth(4)).toBe('4月')
  })

  it('should render a fiscal year and month in Japanese', () => {
    expect(formatFiscalYear(2024, 3)).toBe('2024年3月')
  })
})

describe('parseCsv', () => {
  it('should split simple comma-separated rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ])
  })

  it('should treat a quoted comma as part of the value', () => {
    expect(parseCsv('a,"b,c",d')).toEqual([['a', 'b,c', 'd']])
  })

  it('should trim surrounding whitespace from every value', () => {
    expect(parseCsv(' hello , world ')).toEqual([['hello', 'world']])
  })

  it('should produce a trailing empty row for a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b'], ['']])
  })
})

describe('getFiscalYear', () => {
  it('should return the same year when the month is on or after the default April start', () => {
    expect(getFiscalYear(new Date(2024, 5, 15))).toBe(2024)
  })

  it('should return the previous year for a month before the April start', () => {
    expect(getFiscalYear(new Date(2024, 0, 15))).toBe(2023)
  })

  it('should include the start month itself in the same fiscal year', () => {
    expect(getFiscalYear(new Date(2024, 3, 1))).toBe(2024)
  })

  it('should honour a custom start month', () => {
    expect(getFiscalYear(new Date(2024, 0, 15), 1)).toBe(2024)
  })
})

describe('getPreviousMonth', () => {
  it('should step back one month within the same fiscal year', () => {
    expect(getPreviousMonth(2024, 6)).toEqual({ fiscalYear: 2024, month: 5 })
  })

  it('should roll over from January to December of the prior fiscal year', () => {
    expect(getPreviousMonth(2024, 1)).toEqual({ fiscalYear: 2023, month: 12 })
  })
})

describe('getPreviousYearSameMonth', () => {
  it('should keep the month and step the fiscal year back by one', () => {
    expect(getPreviousYearSameMonth(2024, 6)).toEqual({ fiscalYear: 2023, month: 6 })
  })
})

describe('addMonths', () => {
  it('should add months within the same year', () => {
    const result = addMonths(new Date(2024, 5, 15), 1)
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(6)
    expect(result.getDate()).toBe(15)
  })

  it('should subtract months across a year boundary', () => {
    const result = addMonths(new Date(2024, 0, 15), -2)
    expect(result.getFullYear()).toBe(2023)
    expect(result.getMonth()).toBe(10)
  })

  it('should normalize an overflow day by rolling into the next month', () => {
    const result = addMonths(new Date(2024, 0, 31), 1)
    expect(result.getMonth()).toBe(2)
  })

  it('should not mutate the original date', () => {
    const original = new Date(2024, 5, 15)
    const originalTime = original.getTime()
    addMonths(original, 5)
    expect(original.getTime()).toBe(originalTime)
  })
})

describe('roundToDecimal', () => {
  it('should round to two decimals by default', () => {
    expect(roundToDecimal(1.2345)).toBe(1.23)
  })

  it('should round half away from zero for the requested precision', () => {
    expect(roundToDecimal(1.235, 2)).toBe(1.24)
  })

  it('should round to zero decimals', () => {
    expect(roundToDecimal(1.5, 0)).toBe(2)
  })

  it('should round negative numbers', () => {
    expect(roundToDecimal(-1.234, 2)).toBe(-1.23)
  })
})

describe('safeDivide', () => {
  it('should divide normally for a non-zero denominator', () => {
    expect(safeDivide(10, 2)).toBe(5)
  })

  it('should return zero for a zero denominator', () => {
    expect(safeDivide(10, 0)).toBe(0)
  })

  it('should return zero for a zero numerator', () => {
    expect(safeDivide(0, 5)).toBe(0)
  })
})

describe('sumValues', () => {
  it('should sum a list of numbers', () => {
    expect(sumValues([1, 2, 3])).toBe(6)
  })

  it('should return zero for an empty list', () => {
    expect(sumValues([])).toBe(0)
  })

  it('should treat null/undefined entries as zero', () => {
    expect(sumValues([1, null, undefined, 2] as unknown as number[])).toBe(3)
  })
})

describe('getMonthName', () => {
  it('should return the Japanese month name for a valid month', () => {
    expect(getMonthName(1)).toBe('1月')
    expect(getMonthName(12)).toBe('12月')
  })

  it('should return an empty string for an out-of-range month', () => {
    expect(getMonthName(0)).toBe('')
    expect(getMonthName(13)).toBe('')
  })
})

describe('getMonthNameShort', () => {
  it('should append 月 to the month number', () => {
    expect(getMonthNameShort(5)).toBe('5月')
  })
})

describe('calculateGrowthRate', () => {
  it('should return 100 when the previous value is zero and current is positive', () => {
    expect(calculateGrowthRate(100, 0)).toBe(100)
  })

  it('should return 0 when both current and previous are zero', () => {
    expect(calculateGrowthRate(0, 0)).toBe(0)
  })

  it('should return 0 when current is non-positive and previous is zero', () => {
    expect(calculateGrowthRate(-50, 0)).toBe(0)
  })

  it('should compute the percentage change for positive previous values', () => {
    expect(calculateGrowthRate(120, 100)).toBe(20)
  })

  it('should use the absolute value of a negative previous value', () => {
    expect(calculateGrowthRate(50, -100)).toBe(150)
  })
})
