const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12
const SALT_LENGTH = 16
const ITERATIONS = 100000

export interface SecureStorageOptions {
  encryptionKey?: string
}

export interface EncryptedData {
  ciphertext: string
  iv: string
  salt: string
  authTag: string
}

function getEncryptionKey(): string {
  if (typeof window === 'undefined') {
    return process.env.SECURE_STORAGE_KEY ?? 'default-server-key-change-in-production'
  }

  let key = sessionStorage.getItem('__secure_key')
  if (!key) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    key = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem('__secure_key', key)
  }
  return key
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}

export async function encrypt(data: string, password?: string): Promise<EncryptedData> {
  const key = password ?? getEncryptionKey()
  const encoder = new TextEncoder()

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const cryptoKey = await deriveKey(key, salt)

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    encoder.encode(data)
  )

  const ciphertext = encryptedBuffer.slice(0, encryptedBuffer.byteLength - 16)
  const authTag = encryptedBuffer.slice(encryptedBuffer.byteLength - 16)

  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    authTag: arrayBufferToBase64(authTag),
  }
}

export async function decrypt(encryptedData: EncryptedData, password?: string): Promise<string> {
  const key = password ?? getEncryptionKey()

  const salt = new Uint8Array(base64ToArrayBuffer(encryptedData.salt))
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv))
  const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedData.ciphertext))
  const authTag = new Uint8Array(base64ToArrayBuffer(encryptedData.authTag))

  const combinedBuffer = new Uint8Array(ciphertext.length + authTag.length)
  combinedBuffer.set(ciphertext, 0)
  combinedBuffer.set(authTag, ciphertext.length)

  const cryptoKey = await deriveKey(key, salt)

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    cryptoKey,
    combinedBuffer
  )

  const decoder = new TextDecoder()
  return decoder.decode(decryptedBuffer)
}

export class SecureStorage {
  private prefix: string

  constructor(prefix = '__secure_') {
    this.prefix = prefix
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined') return

    const json = JSON.stringify(value)
    const encrypted = await encrypt(json)
    localStorage.setItem(this.getKey(key), JSON.stringify(encrypted))
  }

  async getItem<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null

    const stored = localStorage.getItem(this.getKey(key))
    if (!stored) return null

    try {
      const encryptedData: EncryptedData = JSON.parse(stored)
      const decrypted = await decrypt(encryptedData)
      return JSON.parse(decrypted) as T
    } catch {
      return null
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(this.getKey(key))
  }

  clear(): void {
    if (typeof window === 'undefined') return

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(this.prefix)) {
        keysToRemove.push(k)
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k))
  }
}

export const secureStorage = new SecureStorage()

export type { SecureStorage as SecureStorageClass }
