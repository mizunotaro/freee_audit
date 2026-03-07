import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest'
import {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  constantTimeCompare,
  dpapi,
  type EncryptedData,
} from '@/lib/crypto/encryption'

describe('Encryption', () => {
  const originalKey = process.env.ENCRYPTION_KEY

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(() => {
    process.env.ENCRYPTION_KEY = originalKey
  })

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'sensitive data'
      const encrypted = encrypt(plaintext)

      expect(encrypted).not.toBe(plaintext)
      expect(() => JSON.parse(encrypted)).not.toThrow()
      const parsed = JSON.parse(encrypted) as EncryptedData
      expect(parsed).toHaveProperty('ciphertext')
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('authTag')
      expect(parsed).toHaveProperty('salt')

      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertext for same plaintext (due to random IV/salt)', () => {
      const plaintext = 'test'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      expect(encrypted1).not.toBe(encrypted2)

      const parsed1 = JSON.parse(encrypted1) as EncryptedData
      const parsed2 = JSON.parse(encrypted2) as EncryptedData
      expect(parsed1.iv).not.toBe(parsed2.iv)
      expect(parsed1.salt).not.toBe(parsed2.salt)
    })

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted data format')
    })

    it('should throw error for malformed JSON', () => {
      expect(() => decrypt('{not valid json')).toThrow('Invalid encrypted data format')
    })

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set')
    })

    it('should throw error for invalid key length (too short)', () => {
      process.env.ENCRYPTION_KEY = 'short'
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 32-byte hex string')
    })

    it('should throw error for invalid key length (too long)', () => {
      process.env.ENCRYPTION_KEY =
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefextra'
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be a 32-byte hex string')
    })

    it('should handle empty string', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('should handle unicode characters', () => {
      const plaintext = '日本語テスト 🔐 crypto'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000)
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('should throw error for invalid auth tag during decryption', () => {
      const plaintext = 'test'
      const encrypted = encrypt(plaintext)
      const parsed = JSON.parse(encrypted) as EncryptedData
      parsed.authTag = '0'.repeat(32)
      expect(() => decrypt(JSON.stringify(parsed))).toThrow()
    })

    it('should throw error for missing properties in encrypted data', () => {
      expect(() => decrypt(JSON.stringify({ ciphertext: 'abc' }))).toThrow()
    })
  })

  describe('hashPassword/verifyPassword', () => {
    it('should hash password', async () => {
      const password = 'myPassword123'
      const hash = await hashPassword(password)

      expect(hash).not.toBe(password)
      expect(hash.length).toBe(128)
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true)
    })

    it('should verify correct password', async () => {
      const password = 'myPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'myPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('wrongPassword', hash)
      expect(isValid).toBe(false)
    })

    it('should produce consistent hashes for same password', async () => {
      const password = 'testPassword'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)

      expect(hash1).toBe(hash2)
    })

    it('should handle empty password', async () => {
      const hash = await hashPassword('')
      expect(hash.length).toBe(128)
      const isValid = await verifyPassword('', hash)
      expect(isValid).toBe(true)
    })

    it('should handle special characters in password', async () => {
      const password = 'p@$$w0rd!#$%^&*()'
      const hash = await hashPassword(password)
      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })
  })

  describe('generateSecureToken', () => {
    it('should generate token of default length (32 bytes = 64 hex chars)', () => {
      const token = generateSecureToken()
      expect(token.length).toBe(64)
      expect(/^[a-f0-9]+$/.test(token)).toBe(true)
    })

    it('should generate token of custom length', () => {
      const token = generateSecureToken(16)
      expect(token.length).toBe(32)
    })

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken()
      const token2 = generateSecureToken()
      expect(token1).not.toBe(token2)
    })

    it('should generate multiple unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateSecureToken())
      }
      expect(tokens.size).toBe(100)
    })

    it('should handle length of 1', () => {
      const token = generateSecureToken(1)
      expect(token.length).toBe(2)
    })
  })

  describe('constantTimeCompare', () => {
    it('should return true for equal strings', () => {
      expect(constantTimeCompare('test', 'test')).toBe(true)
    })

    it('should return false for different strings', () => {
      expect(constantTimeCompare('test1', 'test2')).toBe(false)
    })

    it('should throw for strings of different lengths', () => {
      expect(() => constantTimeCompare('short', 'longer')).toThrow()
    })

    it('should handle empty strings', () => {
      expect(constantTimeCompare('', '')).toBe(true)
    })

    it('should be case sensitive', () => {
      expect(constantTimeCompare('Test', 'test')).toBe(false)
    })
  })

  describe('DPAPIWrapper', () => {
    it('should protect data', async () => {
      const data = 'sensitive information'
      const protected_data = await dpapi.protect(data)

      expect(protected_data).not.toBe(data)
      expect(() => JSON.parse(protected_data)).not.toThrow()
    })

    it('should unprotect data', async () => {
      const data = 'sensitive information'
      const protected_data = await dpapi.protect(data)
      const unprotected = await dpapi.unprotect(protected_data)

      expect(unprotected).toBe(data)
    })

    it('should handle unicode in protect/unprotect', async () => {
      const data = '日本語データ 🔐'
      const protected_data = await dpapi.protect(data)
      const unprotected = await dpapi.unprotect(protected_data)

      expect(unprotected).toBe(data)
    })
  })
})
