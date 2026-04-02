import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import {
  hashPasswordV2,
  verifyPasswordV2,
  encryptV2,
  decryptV2,
  encryptForCache,
  decryptFromCache,
  constantTimeCompare,
  generateSecureToken,
  generateSecureId,
  EncryptionError,
} from '@/lib/crypto/encryption-v2'

const VALID_ENCRYPTION_KEY = 'a'.repeat(64)

describe('Encryption V2', () => {
  beforeEach(function () {
    process.env.ENCRYPTION_KEY = VALID_ENCRYPTION_KEY
  })

  describe('EncryptionError', function () {
    it('should have correct name', function () {
      const err = new EncryptionError('CODE', 'msg')
      expect(err.name).toBe('EncryptionError')
      expect(err.code).toBe('CODE')
      expect(err.message).toBe('msg')
    })

    it('should accept cause', function () {
      const cause = new Error('original')
      const err = new EncryptionError('CODE', 'msg', cause)
      expect(err.cause).toBe(cause)
    })
  })

  describe('hashPasswordV2 and verifyPasswordV2', function () {
    beforeEach(function () {
      vi.spyOn(crypto, 'scrypt').mockImplementation(function (
        password: any,
        salt: any,
        keylen: any,
        ...rest: any[]
      ) {
        const callback = rest[rest.length - 1] as (err: Error | null, derivedKey: Buffer) => void
        const pBuf = Buffer.isBuffer(password) ? password : Buffer.from(String(password))
        const sBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt))
        const hash = crypto
          .createHash('sha256')
          .update(Buffer.concat([pBuf, sBuf]))
          .digest()
        const result = Buffer.alloc(keylen as number)
        for (let i = 0; i < result.length; i++) {
          result[i] = hash[i % hash.length]
        }
        callback(null, result)
      })
    })

    afterEach(function () {
      vi.restoreAllMocks()
    })

    it('should hash and verify password', async function () {
      const hashed = await hashPasswordV2('password123')
      expect(hashed.version).toBe('v2')
      expect(hashed.algorithm).toBe('scrypt')
      expect(hashed.hash).toBeDefined()
      expect(hashed.salt).toBeDefined()
      expect(hashed.iterations).toBeGreaterThan(0)
      expect(hashed.createdAt).toBeDefined()

      const isValid = await verifyPasswordV2('password123', hashed)
      expect(isValid).toBe(true)
    })

    it('should reject wrong password', async function () {
      const hashed = await hashPasswordV2('correct-pass')
      const isValid = await verifyPasswordV2('wrong-pass', hashed)
      expect(isValid).toBe(false)
    })

    it('should reject empty password', async function () {
      await expect(hashPasswordV2('')).rejects.toThrow()
    })

    it('should reject short password', async function () {
      await expect(hashPasswordV2('short')).rejects.toThrow()
    })

    it('should reject too long password', async function () {
      await expect(hashPasswordV2('x'.repeat(129))).rejects.toThrow()
    })

    it('should reject non-string password', async function () {
      await expect(hashPasswordV2(null as any)).rejects.toThrow()
    })

    it('should reject unsupported version', async function () {
      const fake = {
        version: 'v1' as const,
        hash: 'x',
        salt: 'x',
        iterations: 1,
        algorithm: 'scrypt' as const,
        createdAt: '',
      }
      await expect(verifyPasswordV2('test', fake as any)).rejects.toThrow()
    })

    it('should reject unsupported algorithm', async function () {
      const fake = {
        version: 'v2' as const,
        hash: 'x',
        salt: 'x',
        iterations: 1,
        algorithm: 'argon2id' as const,
        createdAt: '',
      }
      await expect(verifyPasswordV2('test', fake)).rejects.toThrow()
    })

    it('should reject unsupported algorithm', async function () {
      const fake = {
        version: 'v2' as const,
        hash: 'x',
        salt: 'x',
        iterations: 1,
        algorithm: 'argon2id' as const,
        createdAt: '',
      }
      await expect(verifyPasswordV2('test', fake)).rejects.toThrow()
    })
  })

  describe('encryptV2 and decryptV2', function () {
    it('should encrypt and decrypt', function () {
      const encrypted = encryptV2('hello world')
      expect(encrypted.version).toBe('2.0')
      expect(encrypted.ciphertext).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(encrypted.authTag).toBeDefined()
      expect(encrypted.keyId).toBe('default')
      expect(encrypted.algorithm).toBe('aes-256-gcm')

      const decrypted = decryptV2(encrypted)
      expect(decrypted).toBe('hello world')
    })

    it('should use custom keyId', function () {
      const encrypted = encryptV2('data', { keyId: 'custom-key' })
      expect(encrypted.keyId).toBe('custom-key')
    })

    it('should support AAD', function () {
      const encrypted = encryptV2('secret', { aad: 'additional-data' })
      expect(encrypted.aad).toBe('additional-data')
      const decrypted = decryptV2(encrypted)
      expect(decrypted).toBe('secret')
    })

    it('should throw for empty plaintext', function () {
      expect(function () {
        encryptV2('')
      }).toThrow()
    })

    it('should throw for non-string plaintext', function () {
      expect(function () {
        encryptV2(null as any)
      }).toThrow()
    })

    it('should throw without ENCRYPTION_KEY', function () {
      delete process.env.ENCRYPTION_KEY
      expect(function () {
        encryptV2('test')
      }).toThrow()
    })

    it('should throw for invalid ENCRYPTION_KEY length', function () {
      process.env.ENCRYPTION_KEY = 'short'
      expect(function () {
        encryptV2('test')
      }).toThrow()
    })

    it('should throw for wrong version on decrypt', function () {
      const encrypted = encryptV2('test')
      const modified = { ...encrypted, version: '1.0' as any }
      expect(function () {
        decryptV2(modified)
      }).toThrow()
    })

    it('should throw for disallowed algorithm on decrypt', function () {
      const encrypted = encryptV2('test')
      const modified = { ...encrypted, algorithm: 'rc4' as any }
      expect(function () {
        decryptV2(modified)
      }).toThrow()
    })

    it('should fail to decrypt tampered ciphertext', function () {
      const encrypted = encryptV2('test')
      const modified = { ...encrypted, ciphertext: 'aabbccdd' }
      expect(function () {
        decryptV2(modified)
      }).toThrow()
    })
  })

  describe('encryptForCache and decryptFromCache', function () {
    it('should round-trip through cache', function () {
      const encrypted = encryptForCache('cache-data')
      expect(typeof encrypted).toBe('string')
      const decrypted = decryptFromCache(encrypted)
      expect(decrypted).toBe('cache-data')
    })

    it('should throw for invalid cache string', function () {
      expect(function () {
        decryptFromCache('not-json')
      }).toThrow()
    })
  })

  describe('constantTimeCompare', function () {
    it('should return true for equal strings', function () {
      expect(constantTimeCompare('abc', 'abc')).toBe(true)
    })

    it('should return false for different strings', function () {
      expect(constantTimeCompare('abc', 'def')).toBe(false)
    })

    it('should return false for different lengths', function () {
      expect(constantTimeCompare('abc', 'abcd')).toBe(false)
    })
  })

  describe('generateSecureToken', function () {
    it('should generate token of correct length', function () {
      const token = generateSecureToken(32)
      expect(token.length).toBe(64)
    })

    it('should throw for too short', function () {
      expect(function () {
        generateSecureToken(8)
      }).toThrow()
    })

    it('should throw for too long', function () {
      expect(function () {
        generateSecureToken(300)
      }).toThrow()
    })

    it('should generate unique tokens', function () {
      const t1 = generateSecureToken(32)
      const t2 = generateSecureToken(32)
      expect(t1).not.toBe(t2)
    })
  })

  describe('generateSecureId', function () {
    it('should generate an id', function () {
      const id = generateSecureId()
      expect(id).toBeDefined()
      expect(id).toContain('-')
    })

    it('should generate unique ids', function () {
      const id1 = generateSecureId()
      const id2 = generateSecureId()
      expect(id1).not.toBe(id2)
    })
  })
})
