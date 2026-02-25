import { prisma } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto/encryption'
import type { FreeeToken, FreeeTokenResponse } from './types'

const TOKEN_BUFFER_SECONDS = 5 * 60

export async function saveToken(
  companyId: string,
  tokenResponse: FreeeTokenResponse
): Promise<void> {
  const expiresAt = new Date(Date.now() + (tokenResponse.expires_in - TOKEN_BUFFER_SECONDS) * 1000)

  const encryptedAccessToken = encrypt(tokenResponse.access_token)
  const encryptedRefreshToken = encrypt(tokenResponse.refresh_token)

  await prisma.freeeToken.upsert({
    where: { companyId },
    create: {
      companyId,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt,
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope,
    },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt,
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope,
    },
  })
}

export async function getToken(companyId: string): Promise<FreeeToken | null> {
  const tokenRecord = await prisma.freeeToken.findUnique({
    where: { companyId },
  })

  if (!tokenRecord) {
    return null
  }

  try {
    const accessToken = decrypt(tokenRecord.accessToken)
    const refreshToken = decrypt(tokenRecord.refreshToken)

    return {
      accessToken,
      refreshToken,
      expiresAt: tokenRecord.expiresAt,
      tokenType: tokenRecord.tokenType,
      scope: tokenRecord.scope ?? undefined,
    }
  } catch (error) {
    console.error('Failed to decrypt token:', error)
    return null
  }
}

export async function deleteToken(companyId: string): Promise<void> {
  await prisma.freeeToken.delete({
    where: { companyId },
  })
}

export async function isTokenExpired(companyId: string): Promise<boolean> {
  const token = await getToken(companyId)
  if (!token) return true

  return new Date() >= token.expiresAt
}

export async function getValidAccessToken(companyId: string): Promise<string | null> {
  const token = await getToken(companyId)
  if (!token) return null

  if (new Date() >= token.expiresAt) {
    return null
  }

  return token.accessToken
}

export function parseTokenResponse(response: unknown): FreeeTokenResponse | null {
  if (!response || typeof response !== 'object') return null

  const data = response as Record<string, unknown>

  if (
    typeof data.access_token !== 'string' ||
    typeof data.refresh_token !== 'string' ||
    typeof data.expires_in !== 'number' ||
    typeof data.token_type !== 'string'
  ) {
    return null
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    token_type: data.token_type,
    scope: typeof data.scope === 'string' ? data.scope : undefined,
    created_at: typeof data.created_at === 'number' ? data.created_at : undefined,
  }
}

export async function hasValidToken(companyId: string): Promise<boolean> {
  const token = await getToken(companyId)
  if (!token) return false

  const bufferTime = TOKEN_BUFFER_SECONDS * 1000
  return Date.now() < token.expiresAt.getTime() - bufferTime
}
