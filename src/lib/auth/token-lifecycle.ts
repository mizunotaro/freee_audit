import crypto from 'crypto'
import { prisma } from '@/lib/db'

const VERSION = '1.0.0'

export interface TokenLifecycleConfig {
  accessTokenExpiryMs: number
  refreshTokenExpiryMs: number
  rotationEnabled: boolean
}

const DEFAULT_CONFIG: TokenLifecycleConfig = {
  accessTokenExpiryMs: 15 * 60 * 1000,
  refreshTokenExpiryMs: 7 * 24 * 60 * 60 * 1000,
  rotationEnabled: true,
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}

export interface TokenRotationResult {
  rotated: boolean
  tokenPair?: TokenPair
  reason?: string
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateSecureToken(): string {
  return crypto.randomBytes(48).toString('base64url')
}

export function createTokenPair(): TokenPair {
  const now = Date.now()
  const config = DEFAULT_CONFIG

  return {
    accessToken: generateSecureToken(),
    refreshToken: generateSecureToken(),
    accessExpiresAt: new Date(now + config.accessTokenExpiryMs),
    refreshExpiresAt: new Date(now + config.refreshTokenExpiryMs),
  }
}

export async function storeRefreshToken(
  userId: string,
  refreshToken: string,
  expiresAt: Date
): Promise<void> {
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(refreshToken),
      expiresAt,
    },
  })
}

export async function rotateRefreshToken(oldRefreshToken: string): Promise<TokenRotationResult> {
  if (!DEFAULT_CONFIG.rotationEnabled) {
    return { rotated: false, reason: 'Token rotation is disabled' }
  }

  const hashedOld = hashToken(oldRefreshToken)
  const existingSession = await prisma.session.findUnique({
    where: { token: hashedOld },
  })

  if (!existingSession) {
    return { rotated: false, reason: 'Invalid refresh token' }
  }

  if (existingSession.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: existingSession.id } })
    return { rotated: false, reason: 'Refresh token expired' }
  }

  const newPair = createTokenPair()

  await prisma.session.update({
    where: { id: existingSession.id },
    data: {
      token: hashToken(newPair.refreshToken),
      expiresAt: newPair.refreshExpiresAt,
    },
  })

  return {
    rotated: true,
    tokenPair: newPair,
  }
}

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const hashed = hashToken(refreshToken)
  const result = await prisma.session.deleteMany({
    where: { token: hashed },
  })
  return result.count > 0
}

export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId },
  })
  return result.count
}

export async function validateRefreshToken(
  refreshToken: string
): Promise<{ valid: boolean; userId?: string }> {
  const hashed = hashToken(refreshToken)
  const session = await prisma.session.findUnique({
    where: { token: hashed },
    select: { userId: true, expiresAt: true },
  })

  if (!session) return { valid: false }
  if (session.expiresAt < new Date()) {
    await prisma.session.deleteMany({ where: { token: hashed } })
    return { valid: false }
  }

  return { valid: true, userId: session.userId }
}

export { VERSION, DEFAULT_CONFIG }
