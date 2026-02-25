import { describe, it, expect } from 'vitest'
import {
  encrypt,
  decrypt,
  hashSHA256,
  generateSecureToken,
  constantTimeCompare,
} from '@/lib/crypto'

describe('Crypto Module', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'sensitive-api-key-12345'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'same-value'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should produce base64 encoded output', () => {
      const plaintext = 'test-data'
      const encrypted = encrypt(plaintext)

      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow()
    })

    it('should handle empty string', () => {
      const plaintext = ''
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters', () => {
      const plaintext = '日本語テスト 🔐'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('hashSHA256', () => {
    it('should produce consistent SHA256 hash', () => {
      const data = 'test-data'
      const hash1 = hashSHA256(data)
      const hash2 = hashSHA256(data)

      expect(hash1).toBe(hash2)
    })

    it('should produce 64 character hex string', () => {
      const hash = hashSHA256('test')

      expect(hash).toHaveLength(64)
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashSHA256('input1')
      const hash2 = hashSHA256('input2')

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('generateSecureToken', () => {
    it('should generate token of specified length', () => {
      const token = generateSecureToken(32)
      // 32 bytes = 64 hex characters
      expect(token).toHaveLength(64)
    })

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken()
      const token2 = generateSecureToken()

      expect(token1).not.toBe(token2)
    })

    it('should default to 32 bytes', () => {
      const token = generateSecureToken()
      expect(token).toHaveLength(64)
    })
  })

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      const result = constantTimeCompare('test-value', 'test-value')
      expect(result).toBe(true)
    })

    it('should return false for different strings', () => {
      const result = constantTimeCompare('test-value', 'different')
      expect(result).toBe(false)
    })

    it('should return false for strings of different lengths', () => {
      const result = constantTimeCompare('short', 'longer-string')
      expect(result).toBe(false)
    })
  })
})
