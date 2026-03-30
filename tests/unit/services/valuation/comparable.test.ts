import { describe, it, expect } from 'vitest'
import { calculateComparable } from '@/services/valuation/comparable'

describe('calculateComparable', () => {
  const comparableCompanies = [
    {
      name: 'Company A',
      ticker: 'A',
      marketCap: 50000,
      enterpriseValue: 55000,
      revenue: 10000,
      ebitda: 3000,
      netIncome: 2000,
      per: 25,
      pbr: 2.5,
      evEbitda: 18.3,
      evRevenue: 5.5,
      psr: 5.0,
    },
    {
      name: 'Company B',
      ticker: 'B',
      marketCap: 80000,
      enterpriseValue: 90000,
      revenue: 15000,
      ebitda: 5000,
      netIncome: 3500,
      per: 22.9,
      pbr: 3.0,
      evEbitda: 18.0,
      evRevenue: 6.0,
      psr: 5.3,
    },
  ]

  const baseInputs = {
    targetRevenue: 12000,
    targetEBITDA: 4000,
    targetNetIncome: 2500,
    targetBookValue: 15000,
    comparableData: comparableCompanies,
  }

  it('calculates with PE multiple', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valuations).toHaveLength(1)
      expect(result.data.valuations[0].multiple).toBe('PE')
      expect(result.data.valuations[0].value).toBeGreaterThan(0)
      expect(result.data.enterpriseValue).toBeGreaterThan(0)
    }
  })

  it('calculates with PB multiple', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PB'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valuations).toHaveLength(1)
      expect(result.data.valuations[0].multiple).toBe('PB')
    }
  })

  it('calculates with EV_EBITDA multiple', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['EV_EBITDA'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valuations[0].multipleUsed).toBeCloseTo(18.15, 1)
    }
  })

  it('calculates with EV_REVENUE multiple', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['EV_REVENUE'],
    })
    expect(result.success).toBe(true)
  })

  it('calculates with PS multiple', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PS'],
    })
    expect(result.success).toBe(true)
  })

  it('calculates with multiple multiples and averages', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE', 'EV_EBITDA'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valuations).toHaveLength(2)
      expect(result.data.steps.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('rejects empty selected multiples', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('multiple')
    }
  })

  it('rejects missing comparable data', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
      comparableData: undefined,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('Comparable company')
    }
  })

  it('rejects empty comparable data array', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
      comparableData: [],
    })
    expect(result.success).toBe(false)
  })

  it('skips multiples with zero target metric', () => {
    const result = calculateComparable({
      targetRevenue: 0,
      targetEBITDA: 4000,
      targetNetIncome: 2500,
      selectedMultiples: ['EV_REVENUE', 'EV_EBITDA'],
      comparableData: comparableCompanies,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.valuations).toHaveLength(1)
      expect(result.data.valuations[0].multiple).toBe('EV_EBITDA')
    }
  })

  it('fails when all valuations produce zero target metrics', () => {
    const result = calculateComparable({
      targetRevenue: 0,
      targetEBITDA: 0,
      targetNetIncome: 0,
      selectedMultiples: ['PE'],
      comparableData: comparableCompanies,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.message).toContain('No valid valuations')
    }
  })

  it('uses custom currency and unit', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
      currency: 'USD',
      unit: 'thousand',
    })
    if (result.success) {
      expect(result.data.currency).toBe('USD')
      expect(result.data.unit).toBe('thousand')
    }
  })

  it('includes metadata with method and version', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
    })
    if (result.success) {
      expect(result.data.metadata.method).toBe('comparable')
      expect(result.data.metadata.version).toBeDefined()
    }
  })

  it('handles single comparable company', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
      comparableData: [comparableCompanies[0]],
    })
    expect(result.success).toBe(true)
  })

  it('skips companies with zero or negative multiples', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE'],
      comparableData: [
        { ...comparableCompanies[0], per: 0 },
        { ...comparableCompanies[1], per: -5 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('calculates average value from multiple valuations', () => {
    const result = calculateComparable({
      ...baseInputs,
      selectedMultiples: ['PE', 'EV_EBITDA'],
    })
    if (result.success) {
      const sum = result.data.valuations.reduce((s, v) => s + v.value, 0)
      const avg = sum / result.data.valuations.length
      expect(result.data.enterpriseValue).toBe(Math.round(avg))
    }
  })
})
