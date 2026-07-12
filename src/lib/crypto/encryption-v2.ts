/**
 * Encryption V2 - 強化版暗号化モジュール
 *
 * 機能:
 * - パスワードハッシュ（ランダムSalt、scrypt）
 * - データ暗号化（AES-256-GCM、バージョニング）
 * - キーバージョニング対応
 * - タイミングセーフ比較
 *
 * @module lib/crypto/encryption-v2
 */

import crypto from 'crypto'

export type HashAlgorithm = 'scrypt' | 'argon2id'
export type SymmetricAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305'

export interface HashedPasswordV2 {
  version: 'v2'
  hash: string
  salt: string
  iterations: number
  algorithm: HashAlgorithm
  memoryCost?: number
  parallelism?: number
  createdAt: string
}

export interface EncryptedDataV2 {
  version: '2.0'
  keyId: string
  algorithm: SymmetricAlgorithm
  ciphertext: string
  iv: string
  authTag: string
  salt: string
  iterations: number
  timestamp: string
  aad?: string
}

const DEFAULT_ALGORITHM: SymmetricAlgorithm = 'aes-256-gcm'
const DEFAULT_ITERATIONS = 100000
const DEFAULT_SALT_LENGTH = 32
const DEFAULT_IV_LENGTH = 12
const DEFAULT_KEY_LENGTH = 32
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 128

class EncryptionError extends Error {
  constructor(
    public code: string,
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = 'EncryptionError'
  }
}

function getMasterKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new EncryptionError(
      'ENCRYPTION_KEY_MISSING',
      'ENCRYPTION_KEY environment variable is not set'
    )
  }
  if (key.length !== 64) {
    throw new EncryptionError(
      'ENCRYPTION_KEY_INVALID',
      'ENCRYPTION_KEY must be a 32-byte hex string (64 characters)'
    )
  }
  return Buffer.from(key, 'hex')
}

function deriveKey(
  masterKey: Buffer,
  salt: Buffer,
  iterations: number = DEFAULT_ITERATIONS
): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, iterations, DEFAULT_KEY_LENGTH, 'sha256')
}

function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new EncryptionError('PASSWORD_REQUIRED', 'Password is required')
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new EncryptionError(
      'PASSWORD_TOO_SHORT',
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    )
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new EncryptionError(
      'PASSWORD_TOO_LONG',
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters`
    )
  }
}

export async function hashPasswordV2(password: string): Promise<HashedPasswordV2> {
  validatePassword(password)

  const algorithm: HashAlgorithm = 'scrypt'
  const iterations = DEFAULT_ITERATIONS
  const salt = crypto.randomBytes(DEFAULT_SALT_LENGTH)

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      DEFAULT_KEY_LENGTH,
      {
        N: iterations,
        r: 8,
        p: 1,
        maxmem: 128 * iterations * 2,
      },
      (err, derivedKey) => {
        if (err) {
          reject(new EncryptionError('HASH_FAILED', 'Failed to hash password', err))
          return
        }

        resolve({
          version: 'v2',
          hash: derivedKey.toString('hex'),
          salt: salt.toString('hex'),
          iterations,
          algorithm,
          createdAt: new Date().toISOString(),
        })
      }
    )
  })
}

export async function verifyPasswordV2(
  password: string,
  stored: HashedPasswordV2
): Promise<boolean> {
  if (stored.version !== 'v2') {
    throw new EncryptionError('UNSUPPORTED_VERSION', 'Unsupported password hash version')
  }

  if (stored.algorithm !== 'scrypt') {
    throw new EncryptionError('UNSUPPORTED_ALGORITHM', `Unsupported algorithm: ${stored.algorithm}`)
  }

  const salt = Buffer.from(stored.salt, 'hex')
  const storedHash = Buffer.from(stored.hash, 'hex')

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      storedHash.length,
      {
        N: stored.iterations,
        r: 8,
        p: 1,
        maxmem: 128 * stored.iterations * 2,
      },
      (err, derivedKey) => {
        if (err) {
          reject(new EncryptionError('VERIFICATION_FAILED', 'Failed to verify password', err))
          return
        }

        try {
          const match = crypto.timingSafeEqual(derivedKey, storedHash)
          resolve(match)
        } catch {
          resolve(false)
        }
      }
    )
  })
}

export function encryptV2(
  plaintext: string,
  options?: {
    keyId?: string
    algorithm?: SymmetricAlgorithm
    aad?: string
  }
): EncryptedDataV2 {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new EncryptionError('INVALID_PLAINTEXT', 'Plaintext must be a non-empty string')
  }

  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM
  const keyId = options?.keyId ?? 'default'
  const masterKey = getMasterKey()
  const salt = crypto.randomBytes(DEFAULT_SALT_LENGTH)
  const derivedKey = deriveKey(masterKey, salt)
  const iv = crypto.randomBytes(DEFAULT_IV_LENGTH)

  const cipher = crypto.createCipheriv(algorithm, derivedKey, iv) as crypto.CipherGCM

  if (options?.aad) {
    cipher.setAAD(Buffer.from(options.aad, 'utf8'))
  }

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return {
    version: '2.0',
    keyId,
    algorithm,
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
    iterations: DEFAULT_ITERATIONS,
    timestamp: new Date().toISOString(),
    aad: options?.aad,
  }
}

export function decryptV2(encrypted: EncryptedDataV2): string {
  if (encrypted.version !== '2.0') {
    throw new EncryptionError(
      'UNSUPPORTED_VERSION',
      `Unsupported encryption version: ${encrypted.version}`
    )
  }

  const allowedAlgorithms: SymmetricAlgorithm[] = [
    'aes-256-gcm',
    'aes-256-cbc',
    'chacha20-poly1305',
  ]
  if (!allowedAlgorithms.includes(encrypted.algorithm)) {
    throw new EncryptionError(
      'ALGORITHM_NOT_ALLOWED',
      `Algorithm not allowed: ${encrypted.algorithm}`
    )
  }

  const masterKey = getMasterKey()
  const salt = Buffer.from(encrypted.salt, 'hex')
  const derivedKey = deriveKey(masterKey, salt, encrypted.iterations)
  const iv = Buffer.from(encrypted.iv, 'hex')
  const authTag = Buffer.from(encrypted.authTag, 'hex')

  const decipher = crypto.createDecipheriv(
    encrypted.algorithm,
    derivedKey,
    iv
  ) as crypto.DecipherGCM
  decipher.setAuthTag(authTag)

  if (encrypted.aad) {
    decipher.setAAD(Buffer.from(encrypted.aad, 'utf8'))
  }

  try {
    let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    throw new EncryptionError('DECRYPTION_FAILED', 'Failed to decrypt data', err as Error)
  }
}

export function encryptForCache(plaintext: string): string {
  const encrypted = encryptV2(plaintext, { keyId: 'cache' })
  return JSON.stringify(encrypted)
}

export function decryptFromCache(encryptedString: string): string {
  try {
    const encrypted: EncryptedDataV2 = JSON.parse(encryptedString)
    return decryptV2(encrypted)
  } catch (err) {
    throw new EncryptionError(
      'CACHE_DECRYPTION_FAILED',
      'Failed to decrypt cached data',
      err as Error
    )
  }
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

export function generateSecureToken(length: number = 32): string {
  if (length < 16 || length > 256) {
    throw new EncryptionError(
      'INVALID_TOKEN_LENGTH',
      'Token length must be between 16 and 256 bytes'
    )
  }
  return crypto.randomBytes(length).toString('hex')
}

export function generateSecureId(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(8).toString('hex')
  return `${timestamp}-${random}`
}

export { EncryptionError }
