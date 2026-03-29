import crypto from 'crypto'
import { MemoryCache } from '@/lib/cache/memory-cache'

const VERSION = '1.0.0'

export interface KeyMetadata {
  keyId: string
  version: number
  algorithm: string
  createdAt: number
  expiresAt: number | null
  status: 'active' | 'rotating' | 'deprecated' | 'revoked'
  rotatedFrom?: string
}

export interface KeyRotationResult {
  success: boolean
  oldKeyId: string
  newKeyId: string
  version: number
}

interface StoredKey {
  metadata: KeyMetadata
  key: Buffer
}

const KEY_CACHE = new MemoryCache<StoredKey>(3600000)
const MAX_KEY_AGE_MS = 90 * 24 * 60 * 60 * 1000
const ROTATION_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

function getMasterKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 64) {
    throw new Error('ENCRYPTION_KEY must be set and at least 64 hex characters')
  }
  return key
}

function deriveKey(keyId: string, version: number): Buffer {
  const masterKey = getMasterKey()
  const info = `freee_audit_key_v${version}_${keyId}`
  return crypto.createHmac('sha256', masterKey).update(info).digest()
}

function generateKeyId(): string {
  return `key_${crypto.randomBytes(8).toString('hex')}_${Date.now().toString(36)}`
}

class KeyManager {
  private currentVersion = 1
  private keys = new Map<string, StoredKey>()

  constructor() {
    this.initializeDefaultKey()
  }

  private initializeDefaultKey(): void {
    const keyId = generateKeyId()
    const key = deriveKey(keyId, 1)

    const metadata: KeyMetadata = {
      keyId,
      version: 1,
      algorithm: 'aes-256-gcm',
      createdAt: Date.now(),
      expiresAt: null,
      status: 'active',
    }

    const stored: StoredKey = { metadata, key }
    this.keys.set(keyId, stored)
    KEY_CACHE.set('current', stored)
  }

  getCurrentKey(): StoredKey {
    const cached = KEY_CACHE.get('current')
    if (cached) return cached

    for (const [, stored] of this.keys) {
      if (stored.metadata.status === 'active') {
        KEY_CACHE.set('current', stored)
        return stored
      }
    }

    throw new Error('No active encryption key available')
  }

  getKeyById(keyId: string): StoredKey | null {
    return this.keys.get(keyId) ?? null
  }

  rotateKey(): KeyRotationResult {
    const current = this.getCurrentKey()
    const newVersion = this.currentVersion + 1
    const newKeyId = generateKeyId()
    const newKey = deriveKey(newKeyId, newVersion)

    current.metadata.status = 'deprecated'
    current.metadata.expiresAt = Date.now() + ROTATION_GRACE_PERIOD_MS

    const newMetadata: KeyMetadata = {
      keyId: newKeyId,
      version: newVersion,
      algorithm: 'aes-256-gcm',
      createdAt: Date.now(),
      expiresAt: null,
      status: 'active',
      rotatedFrom: current.metadata.keyId,
    }

    const newStored: StoredKey = { metadata: newMetadata, key: newKey }
    this.keys.set(newKeyId, newStored)
    KEY_CACHE.set('current', newStored)

    this.currentVersion = newVersion

    this.cleanupRevokedKeys()

    return {
      success: true,
      oldKeyId: current.metadata.keyId,
      newKeyId,
      version: newVersion,
    }
  }

  deprecateKey(keyId: string): boolean {
    const stored = this.keys.get(keyId)
    if (!stored) return false
    if (stored.metadata.status === 'active') return false

    stored.metadata.status = 'deprecated'
    stored.metadata.expiresAt = Date.now() + ROTATION_GRACE_PERIOD_MS
    return true
  }

  revokeKey(keyId: string): boolean {
    const stored = this.keys.get(keyId)
    if (!stored) return false
    if (stored.metadata.status === 'active') return false

    stored.metadata.status = 'revoked'
    stored.metadata.expiresAt = Date.now()
    return true
  }

  getAllKeyMetadata(): KeyMetadata[] {
    return Array.from(this.keys.values()).map((s) => ({ ...s.metadata }))
  }

  private cleanupRevokedKeys(): void {
    const now = Date.now()
    for (const [keyId, stored] of this.keys) {
      if (
        stored.metadata.status === 'revoked' &&
        stored.metadata.expiresAt &&
        stored.metadata.expiresAt < now - MAX_KEY_AGE_MS
      ) {
        this.keys.delete(keyId)
      }
    }
  }
}

let keyManagerInstance: KeyManager | null = null

export function getKeyManager(): KeyManager {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager()
  }
  return keyManagerInstance
}

export function resetKeyManager(): void {
  keyManagerInstance = null
  KEY_CACHE.clear()
}

export { VERSION, MAX_KEY_AGE_MS, ROTATION_GRACE_PERIOD_MS }
