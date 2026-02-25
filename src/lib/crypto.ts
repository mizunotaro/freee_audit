import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'hex')
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  authTag: string
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  const result: EncryptedData = {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  }

  return Buffer.from(JSON.stringify(result)).toString('base64')
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey()

  const decoded = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8')) as EncryptedData

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(decoded.iv, 'hex'))

  decipher.setAuthTag(Buffer.from(decoded.authTag, 'hex'))

  let decrypted = decipher.update(decoded.ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

export function hashSHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
