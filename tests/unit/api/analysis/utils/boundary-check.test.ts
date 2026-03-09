import { checkBoundaryLimits, checkInputSize } from '@/app/api/analysis/utils/boundary-check'

describe('Boundary Check Utility', () => {
  describe('checkInputSize', () => {
    it('should pass for small input', () => {
      const input = { data: 'small' }

      const result = checkInputSize(input)

      expect(result.success).toBe(true)
    })

    it('should fail for very large input', () => {
      const largeData = 'x'.repeat(20 * 1024 * 1024)
      const input = { data: largeData }

      const result = checkInputSize(input)

      expect(result.success).toBe(false)
    })
  })

  describe('checkBoundaryLimits', () => {
    it('should pass for valid shallow object', () => {
      const input = {
        name: 'test',
        value: 100,
      }

      const result = checkBoundaryLimits(input)

      expect(result.success).toBe(true)
    })

    it('should handle null values', () => {
      const input = {
        value: null,
      }

      const result = checkBoundaryLimits(input)

      expect(result.success).toBe(true)
    })

    it('should handle array values', () => {
      const input = {
        items: [1, 2, 3],
      }

      const result = checkBoundaryLimits(input)

      expect(result.success).toBe(true)
    })

    it('should handle primitive values', () => {
      const input = {
        string: 'test',
        number: 123,
        boolean: true,
      }

      const result = checkBoundaryLimits(input)

      expect(result.success).toBe(true)
    })
  })
})
