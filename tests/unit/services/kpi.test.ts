import { describe, it, expect } from 'vitest'
import {
  calculateROE,
  calculateROA,
  calculateROS,
  calculateGrossMargin,
  calculateEBITDA,
  calculateEBITDAMargin,
  calculateCurrentRatio,
  calculateQuickRatio,
  calculateDERatio,
  calculateEquityRatio,
  calculateRunway,
  calculateRunwayKPI,
} from '@/services/analytics/kpi'

describe('KPI Service', () => {
  describe('Profitability Ratios', () => {
    describe('calculateROE', () => {
      it('should calculate ROE correctly', () => {
        const result = calculateROE(1000000, 5000000)
        expect(result.value).toBe(20)
        expect(result.format).toBe('percentage')
      })

      it('should return 0 when equity is 0', () => {
        const result = calculateROE(1000000, 0)
        expect(result.value).toBe(0)
      })
    })

    describe('calculateROA', () => {
      it('should calculate ROA correctly', () => {
        const result = calculateROA(1000000, 10000000)
        expect(result.value).toBe(10)
      })
    })

    describe('calculateROS', () => {
      it('should calculate ROS correctly', () => {
        const result = calculateROS(500000, 5000000)
        expect(result.value).toBe(10)
      })
    })

    describe('calculateGrossMargin', () => {
      it('should calculate gross margin correctly', () => {
        const result = calculateGrossMargin(3000000, 5000000)
        expect(result.value).toBe(60)
      })
    })

    describe('calculateEBITDA', () => {
      it('should calculate EBITDA correctly', () => {
        const result = calculateEBITDA(1000000, 200000, 50000)
        expect(result).toBe(1250000)
      })
    })

    describe('calculateEBITDAMargin', () => {
      it('should calculate EBITDA margin correctly', () => {
        const result = calculateEBITDAMargin(1250000, 5000000)
        expect(result.value).toBe(25)
      })
    })
  })

  describe('Safety Ratios', () => {
    describe('calculateCurrentRatio', () => {
      it('should calculate current ratio correctly', () => {
        const result = calculateCurrentRatio(3000000, 2000000)
        expect(result.value).toBe(150)
      })

      it('should handle zero liabilities', () => {
        const result = calculateCurrentRatio(3000000, 0)
        expect(result.value).toBe(0)
      })
    })

    describe('calculateQuickRatio', () => {
      it('should calculate quick ratio correctly', () => {
        const result = calculateQuickRatio(3000000, 500000, 2000000)
        expect(result.value).toBe(125)
      })
    })

    describe('calculateDERatio', () => {
      it('should calculate D/E ratio correctly', () => {
        const result = calculateDERatio(4000000, 6000000)
        expect(result.value).toBeCloseTo(0.67, 2)
        expect(result.format).toBe('ratio')
      })
    })

    describe('calculateEquityRatio', () => {
      it('should calculate equity ratio correctly', () => {
        const result = calculateEquityRatio(6000000, 10000000)
        expect(result.value).toBe(60)
      })
    })
  })

  describe('Runway Calculation', () => {
    describe('calculateRunway', () => {
      it('should calculate runway correctly for positive burn rate', () => {
        const result = calculateRunway(15000000, 3000000, 5000000)

        expect(result.monthlyBurnRate).toBe(2000000)
        expect(result.runwayMonths).toBe(7)
        expect(result.currentCash).toBe(15000000)
      })

      it('should return Infinity for negative burn rate', () => {
        const result = calculateRunway(15000000, 5000000, 3000000)

        expect(result.monthlyBurnRate).toBe(-2000000)
        expect(result.runwayMonths).toBe(Infinity)
      })

      it('should return 0 for zero cash', () => {
        const result = calculateRunway(0, 3000000, 5000000)

        expect(result.runwayMonths).toBe(0)
      })
    })

    describe('calculateRunwayKPI', () => {
      it('should convert runway to KPI format', () => {
        const runway = calculateRunway(15000000, 3000000, 5000000)
        const kpi = calculateRunwayKPI(runway)

        expect(kpi.name).toBe('Runway')
        expect(kpi.value).toBe(7)
        expect(kpi.format).toBe('months')
      })

      it('should cap Infinity at 999', () => {
        const runway = calculateRunway(15000000, 5000000, 3000000)
        const kpi = calculateRunwayKPI(runway)

        expect(kpi.value).toBe(999)
      })
    })
  })
})
