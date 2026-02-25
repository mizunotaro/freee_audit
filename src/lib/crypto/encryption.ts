import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const SALT_LENGTH = 32
const ITERATIONS = 100000

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 characters)')
  }
  return Buffer.from(key, 'hex')
}

function deriveKey(salt: Buffer): Buffer {
  const key = getEncryptionKey()
  return crypto.pbkdf2Sync(key, salt, ITERATIONS, 32, 'sha256')
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  authTag: string
  salt: string
}

export function encrypt(plaintext: string): string {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(salt)
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  const encryptedData: EncryptedData = {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    salt: salt.toString('hex'),
  }

  return JSON.stringify(encryptedData)
}

export function decrypt(encryptedString: string): string {
  let encryptedData: EncryptedData

  try {
    encryptedData = JSON.parse(encryptedString)
  } catch {
    throw new Error('Invalid encrypted data format')
  }

  const { ciphertext, iv, authTag, salt } = encryptedData

  const saltBuffer = Buffer.from(salt, 'hex')
  const key = deriveKey(saltBuffer)
  const ivBuffer = Buffer.from(iv, 'hex')
  const authTagBuffer = Buffer.from(authTag, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer)
  decipher.setAuthTag(authTagBuffer)

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, 'salt', 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex'))
    })
  })
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, 'salt', 64, (err, derivedKey) => {
      if (err) reject(err)
      resolve(derivedKey.toString('hex') === hash)
    })
  })
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export function constantTimeCompare(a: string, b: string): boolean {
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

class DPAPIWrapper {
  private isWindows: boolean

  constructor() {
    this.isWindows = process.platform === 'win32'
  }

  async protect(data: string): Promise<string> {
    if (this.isWindows) {
      return encrypt(data)
    }
    return encrypt(data)
  }

  async unprotect(encryptedData: string): Promise<string> {
    if (this.isWindows) {
      return decrypt(encryptedData)
    }
    return decrypt(encryptedData)
  }
}

export const dpapi = new DPAPIWrapper()
