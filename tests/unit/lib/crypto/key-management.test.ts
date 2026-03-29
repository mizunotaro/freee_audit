import { describe, it, expect, beforeEach } from 'vitest'
import { getKeyManager, resetKeyManager } from '@/lib/crypto/key-management'

describe('KeyManagement', () => {
  beforeEach(() => {
    resetKeyManager()
  })

  describe('getCurrentKey', () => {
    it('should return a valid active key on initialization', () => {
      const manager = getKeyManager()
      const key = manager.getCurrentKey()
      expect(key.metadata.status).toBe('active')
      expect(key.metadata.keyId).toBeDefined()
      expect(key.key).toBeInstanceOf(Buffer)
      expect(key.key.length).toBe(32)
    })
  })

  describe('rotateKey', () => {
    it('should rotate to a new key version', () => {
      const manager = getKeyManager()
      const oldKey = manager.getCurrentKey()
      const result = manager.rotateKey()

      expect(result.success).toBe(true)
      expect(result.oldKeyId).toBe(oldKey.metadata.keyId)
      expect(result.newKeyId).not.toBe(result.oldKeyId)
      expect(result.version).toBe(2)

      const newKey = manager.getCurrentKey()
      expect(newKey.metadata.keyId).toBe(result.newKeyId)
      expect(newKey.metadata.status).toBe('active')
      expect(newKey.metadata.rotatedFrom).toBe(result.oldKeyId)
    })

    it('should deprecate old key after rotation', () => {
      const manager = getKeyManager()
      const oldKey = manager.getCurrentKey()
      manager.rotateKey()

      const oldKeyCheck = manager.getKeyById(oldKey.metadata.keyId)
      expect(oldKeyCheck?.metadata.status).toBe('deprecated')
    })

    it('should return false for revoking unknown key', () => {
      const manager = getKeyManager()
      const result = manager.revokeKey('nonexistent-key')
      expect(result).toBe(false)
    })
  })

  describe('getAllKeyMetadata', () => {
    it('should return all key metadata', () => {
      const manager = getKeyManager()
      manager.rotateKey()

      const all = manager.getAllKeyMetadata()
      expect(all.length).toBe(2)
      expect(all.filter((k) => k.status === 'active').length).toBe(1)
      expect(all.filter((k) => k.status === 'deprecated').length).toBe(1)
    })
  })

  describe('getKeyById', () => {
    it('should return null for unknown key', () => {
      const manager = getKeyManager()
      const result = manager.getKeyById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('revokeKey', () => {
    it('should not allow revoking active key', () => {
      const manager = getKeyManager()
      const active = manager.getCurrentKey()
      const result = manager.revokeKey(active.metadata.keyId)
      expect(result).toBe(false)
    })

    it('should revoke deprecated key', () => {
      const manager = getKeyManager()
      const old = manager.getCurrentKey()
      manager.rotateKey()

      const revoked = manager.revokeKey(old.metadata.keyId)
      expect(revoked).toBe(true)

      const check = manager.getKeyById(old.metadata.keyId)
      expect(check?.metadata.status).toBe('revoked')
    })
  })
})
