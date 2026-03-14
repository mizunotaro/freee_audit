import { MaterialityService } from '@/services/dd/materiality-service'

describe('MaterialityService', () => {
  let service: MaterialityService

  beforeEach(() => {
    service = new MaterialityService()
  })

  describe('calculate', () => {
    it('should calculate materiality based on revenue', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'REVENUE',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.basis).toBe('REVENUE')
        expect(result.data.percentage).toBe(0.5)
        expect(result.data.finalAmount).toBeGreaterThan(0)
      }
    })

    it('should calculate materiality based on total assets', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'TOTAL_ASSETS',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.basis).toBe('TOTAL_ASSETS')
        expect(result.data.percentage).toBe(1.0)
      }
    })

    it('should calculate materiality based on net income', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'NET_INCOME',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.basis).toBe('NET_INCOME')
        expect(result.data.percentage).toBe(5.0)
      }
    })

    it('should calculate materiality with custom basis', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'CUSTOM',
        customBasisAmount: 1000000000,
        percentage: 1.5,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.basis).toBe('CUSTOM')
        expect(result.data.basisAmount).toBe(1000000000)
        expect(result.data.percentage).toBe(1.5)
        expect(result.data.calculatedAmount).toBe(15000000)
      }
    })

    it('should enforce minimum threshold', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'CUSTOM',
        customBasisAmount: 1000000,
        percentage: 0.1,
        minimumThreshold: 10000000,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.finalAmount).toBe(10000000)
      }
    })

    it('should use custom percentage when provided', () => {
      const result = service.calculate({
        companyId: 'company-123',
        fiscalYear: 2024,
        basis: 'REVENUE',
        percentage: 0.75,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.percentage).toBe(0.75)
      }
    })
  })

  describe('calculatePerformanceMateriality', () => {
    it('should calculate overall, performance, and trivial materiality', () => {
      const result = service.calculatePerformanceMateriality(1000000000, 100000000, 500000000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.overall.basis).toBe('REVENUE')
        expect(result.data.performance.basis).toBe('NET_INCOME')
        expect(result.data.trivial).toBeGreaterThan(0)
        expect(result.data.trivial).toBeLessThan(result.data.overall.finalAmount)
      }
    })

    it('should calculate correct trivial threshold as 5% of lower materiality', () => {
      const result = service.calculatePerformanceMateriality(1000000000, 100000000, 500000000)

      expect(result.success).toBe(true)
      if (result.success) {
        const minMateriality = Math.min(
          result.data.overall.finalAmount,
          result.data.performance.finalAmount
        )
        expect(result.data.trivial).toBe(minMateriality * 0.05)
      }
    })
  })

  describe('calculateForMergersAndAcquisitions', () => {
    it('should calculate overall and deal materiality for M&A', () => {
      const result = service.calculateForMergersAndAcquisitions(1000000000, 200000000, 500000000)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.overall.basis).toBe('REVENUE')
        expect(result.data.deal.basis).toBe('TOTAL_ASSETS')
      }
    })
  })
})
