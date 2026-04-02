import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectPII,
  maskPII,
  hasPII,
  warnOnPII,
  sanitizeForAI,
  validateNoPII,
} from '@/lib/security/pii-detector'

vi.mock('@/lib/utils/secure-logger', () => ({
  secureLogger: {
    security: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

describe('PII Detector', () => {
  describe('detectPII', () => {
    it('should detect email addresses', function () {
      const result = detectPII('Contact us at user@example.com for details')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'email'
        })
      ).toBe(true)
      expect(result.summary.email).toBe(1)
    })

    it('should detect multiple emails', function () {
      const result = detectPII('user1@test.com and user2@test.com are here')
      expect(result.summary.email).toBe(2)
    })

    it('should detect Japanese phone numbers', function () {
      const result = detectPII('電話番号: 090-1234-5678')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'phone_jp'
        })
      ).toBe(true)
    })

    it('should detect international phone numbers', function () {
      const result = detectPII('Call +1-555-123-4567 now')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'phone_intl'
        })
      ).toBe(true)
    })

    it('should detect credit card numbers', function () {
      const result = detectPII('Card: 4111 1111 1111 1111')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'credit_card'
        })
      ).toBe(true)
      expect(result.detections[0].severity).toBe('critical')
    })

    it('should detect My Number', function () {
      const result = detectPII('マイナンバー: 123 4567 8901')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'my_number'
        })
      ).toBe(true)
    })

    it('should detect Japanese postal codes', function () {
      const result = detectPII('〒100-0001')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'postal_code_jp'
        })
      ).toBe(true)
    })

    it('should detect URLs', function () {
      const result = detectPII('Visit https://example.com/path')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'url'
        })
      ).toBe(true)
    })

    it('should detect IP addresses', function () {
      const result = detectPII('Server at 192.168.1.1 is down')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'ip_address'
        })
      ).toBe(true)
    })

    it('should detect Japanese company names', function () {
      const result = detectPII('株式会社サンプルは東京都にあります')
      expect(result.hasPII).toBe(true)
      expect(
        result.detections.some(function (d) {
          return d.category === 'company_name_jp'
        })
      ).toBe(true)
    })

    it('should return no PII for clean content', function () {
      const result = detectPII('This is a clean string with no PII data.')
      expect(result.hasPII).toBe(false)
      expect(result.detections).toHaveLength(0)
      expect(result.riskScore).toBe(0)
    })

    it('should calculate risk score based on severity', function () {
      const result = detectPII('Card: 4111 1111 1111 1111 and email@test.com')
      expect(result.riskScore).toBeGreaterThan(0)
    })

    it('should produce masked content', function () {
      const result = detectPII('Email: test@example.com end')
      expect(result.maskedContent).not.toContain('test@example.com')
    })

    it('should include detection indices', function () {
      const result = detectPII('user@example.com')
      expect(result.detections[0].startIndex).toBeGreaterThanOrEqual(0)
      expect(result.detections[0].endIndex).toBeGreaterThan(result.detections[0].startIndex)
    })
  })

  describe('maskPII', function () {
    it('should return masked string', function () {
      const masked = maskPII('Contact: user@example.com')
      expect(masked).not.toContain('user@example.com')
    })

    it('should preserve non-PII text', function () {
      const masked = maskPII('Hello world')
      expect(masked).toBe('Hello world')
    })
  })

  describe('hasPII', function () {
    it('should return true when PII exists', function () {
      expect(hasPII('user@example.com')).toBe(true)
    })

    it('should return false when no PII', function () {
      expect(hasPII('Hello world')).toBe(false)
    })
  })

  describe('warnOnPII', function () {
    it('should return result and log for PII content', function () {
      const result = warnOnPII('user@example.com', 'test-context')
      expect(result.hasPII).toBe(true)
    })

    it('should return result without logging for clean content', function () {
      const result = warnOnPII('clean content', 'test-context')
      expect(result.hasPII).toBe(false)
    })
  })

  describe('sanitizeForAI', function () {
    it('should return masked content for low-risk PII', function () {
      const result = sanitizeForAI('Visit https://example.com')
      expect(result).not.toContain('https://example.com')
    })

    it('should throw for high-risk PII content', function () {
      expect(function () {
        sanitizeForAI(
          'Card1: 4111 1111 1111 1111 Card2: 4222 2222 2222 2222 email1@test.com email2@test.com'
        )
      }).toThrow('Content contains too much PII')
    })

    it('should pass through clean content', function () {
      expect(sanitizeForAI('clean content')).toBe('clean content')
    })
  })

  describe('validateNoPII', function () {
    it('should pass for clean content', function () {
      expect(function () {
        validateNoPII('clean content')
      }).not.toThrow()
    })

    it('should throw when PII detected', function () {
      expect(function () {
        validateNoPII('user@example.com')
      }).toThrow('PII detected')
    })

    it('should allow low risk when option is set', function () {
      expect(function () {
        validateNoPII('Visit https://example.com', { allowLowRisk: true })
      }).not.toThrow()
    })

    it('should block non-low-risk even with allowLowRisk', function () {
      expect(function () {
        validateNoPII('user@example.com', { allowLowRisk: true })
      }).toThrow('PII detected')
    })
  })
})
