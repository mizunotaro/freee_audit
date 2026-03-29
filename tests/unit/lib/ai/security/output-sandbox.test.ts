import { describe, it, expect } from 'vitest'
import { validateOutput } from '@/lib/ai/security/output-sandbox'

describe('OutputSandbox', () => {
  describe('validateOutput', () => {
    it('should pass clean output', () => {
      const result = validateOutput('売上高は前年同期比5%増加しました。')
      expect(result.valid).toBe(true)
      expect(result.violations).toHaveLength(0)
    })

    it('should remove script tags and mark as invalid', () => {
      const result = validateOutput('<script>alert("xss")</script>分析結果です。')
      expect(result.valid).toBe(false)
      expect(result.sanitizedOutput).not.toContain('<script>')
      expect(result.violations.some((v) => v.type === 'script_injection')).toBe(true)
    })

    it('should redact email addresses', () => {
      const result = validateOutput('担当者: user@example.com に連絡してください')
      expect(result.sanitizedOutput).toContain('[EMAIL REDACTED]')
      expect(result.sanitizedOutput).not.toContain('user@example.com')
      expect(result.violations.some((v) => v.type === 'pii_leak')).toBe(true)
    })

    it('should redact credit card numbers', () => {
      const result = validateOutput('カード番号: 4111-1111-1111-1111')
      expect(result.sanitizedOutput).toContain('[CC REDACTED]')
      expect(result.violations.some((v) => v.type === 'pii_leak')).toBe(true)
    })

    it('should remove SQL injection patterns', () => {
      const result = validateOutput('UNION ALL SELECT * FROM users')
      expect(result.sanitizedOutput).toContain('[REMOVED: sql]')
      expect(result.violations.some((v) => v.type === 'sql_injection')).toBe(true)
    })

    it('should detect path traversal patterns', () => {
      const result = validateOutput('../../../etc/passwd content')
      expect(result.violations.some((v) => v.type === 'path_traversal')).toBe(true)
    })

    it('should flag URLs in output', () => {
      const result = validateOutput('詳細は https://example.com/report を参照')
      expect(result.violations.some((v) => v.type === 'unauthorized_url')).toBe(true)
    })

    it('should redact Japanese bank account info', () => {
      const result = validateOutput('口座番号：1234567')
      expect(result.sanitizedOutput).toContain('[BANK_ACCOUNT REDACTED]')
    })

    it('should truncate excessive length output', () => {
      const result = validateOutput('a'.repeat(60000), { maxLength: 50000 })
      expect(result.sanitizedOutput.length).toBeLessThanOrEqual(50000)
      expect(result.violations.some((v) => v.type === 'excessive_length')).toBe(true)
    })

    it('should return invalid for null/undefined input', () => {
      const result = validateOutput(null as any)
      expect(result.valid).toBe(false)
      expect(result.sanitizedOutput).toBe('')
    })

    it('should include metadata', () => {
      const result = validateOutput('テストデータ')
      expect(result.metadata).toHaveProperty('originalLength')
      expect(result.metadata).toHaveProperty('sanitizedLength')
      expect(result.metadata).toHaveProperty('checkDurationMs')
      expect(result.metadata.checkDurationMs).toBeGreaterThanOrEqual(0)
    })

    it('should handle clean Japanese financial text', () => {
      const result = validateOutput(
        '当期の売上高は1億円、経費は5,000万円でした。法人税率23.2%を適用しています。'
      )
      expect(result.valid).toBe(true)
    })

    it('should remove event handler attributes', () => {
      const result = validateOutput('<div onclick="alert(1)">テスト</div>')
      expect(result.sanitizedOutput).not.toContain('onclick')
      expect(result.violations.some((v) => v.type === 'html_injection')).toBe(true)
    })
  })
})
