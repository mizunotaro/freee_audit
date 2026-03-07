import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  saveToken,
  getToken,
  deleteToken,
  isTokenExpired,
  hasValidToken,
  getValidAccessToken,
  parseTokenResponse,
} from '@/lib/integrations/freee/token-store'

const mockUpsert = vi.fn()
const mockFindUnique = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    freeeToken: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}))

vi.mock('@/lib/crypto/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted_', '')),
}))

describe('Freee Token Store', () => {
  const companyId = 'company-123'
  const mockTokenResponse = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'Bearer',
    scope: 'read write',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.ENCRYPTION_KEY
  })

  describe('saveToken', () => {
    it('should save and encrypt token', async () => {
      mockUpsert.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: 'read write',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await saveToken(companyId, mockTokenResponse)

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { companyId },
        create: expect.objectContaining({
          companyId,
          accessToken: 'encrypted_test-access-token',
          refreshToken: 'encrypted_test-refresh-token',
          tokenType: 'Bearer',
          scope: 'read write',
        }),
        update: expect.objectContaining({
          accessToken: 'encrypted_test-access-token',
          refreshToken: 'encrypted_test-refresh-token',
          tokenType: 'Bearer',
          scope: 'read write',
        }),
      })
    })

    it('should update existing token', async () => {
      mockUpsert.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_new-access-token',
        refreshToken: 'encrypted_new-refresh-token',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: 'read write',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const newToken = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      await saveToken(companyId, newToken)

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId },
          update: expect.objectContaining({
            accessToken: 'encrypted_new-access-token',
            refreshToken: 'encrypted_new-refresh-token',
          }),
        })
      )
    })

    it('should calculate expiry with buffer', async () => {
      const now = Date.now()
      mockUpsert.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: new Date(now + 3600 * 1000),
        tokenType: 'Bearer',
        scope: 'read write',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await saveToken(companyId, mockTokenResponse)

      const call = mockUpsert.mock.calls[0][0]
      const expectedExpiry = new Date(now + (3600 - 300) * 1000)
      const actualExpiry = call.create.expiresAt

      expect(actualExpiry.getTime()).toBeGreaterThanOrEqual(expectedExpiry.getTime() - 100)
      expect(actualExpiry.getTime()).toBeLessThanOrEqual(expectedExpiry.getTime() + 100)
    })
  })

  describe('getToken', () => {
    it('should return null for non-existent token', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const token = await getToken('non-existent-company')

      expect(token).toBeNull()
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { companyId: 'non-existent-company' },
      })
    })

    it('should decrypt and return token', async () => {
      const expiresAt = new Date(Date.now() + 3600 * 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt,
        tokenType: 'Bearer',
        scope: 'read write',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const token = await getToken(companyId)

      expect(token).not.toBeNull()
      expect(token?.accessToken).toBe('test-access-token')
      expect(token?.refreshToken).toBe('test-refresh-token')
      expect(token?.tokenType).toBe('Bearer')
      expect(token?.scope).toBe('read write')
    })

    it('should return null on decryption error', async () => {
      const { decrypt } = await import('@/lib/crypto/encryption')
      vi.mocked(decrypt).mockImplementationOnce(() => {
        throw new Error('Decryption failed')
      })

      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'invalid-encrypted',
        refreshToken: 'invalid-encrypted',
        expiresAt: new Date(),
        tokenType: 'Bearer',
        scope: 'read write',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const token = await getToken(companyId)

      expect(token).toBeNull()
    })

    it('should handle null scope', async () => {
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: new Date(),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const token = await getToken(companyId)

      expect(token).not.toBeNull()
      expect(token?.scope).toBeUndefined()
    })
  })

  describe('deleteToken', () => {
    it('should delete token', async () => {
      mockDelete.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted',
        refreshToken: 'encrypted',
        expiresAt: new Date(),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await deleteToken(companyId)

      expect(mockDelete).toHaveBeenCalledWith({
        where: { companyId },
      })
    })
  })

  describe('isTokenExpired', () => {
    it('should return true for expired token', async () => {
      const pastDate = new Date(Date.now() - 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: pastDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const expired = await isTokenExpired(companyId)

      expect(expired).toBe(true)
    })

    it('should return false for valid token', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: futureDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const expired = await isTokenExpired(companyId)

      expect(expired).toBe(false)
    })

    it('should return true for non-existent token', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const expired = await isTokenExpired('non-existent')

      expect(expired).toBe(true)
    })

    it('should return true when decryption fails', async () => {
      const { decrypt } = await import('@/lib/crypto/encryption')
      vi.mocked(decrypt).mockImplementationOnce(() => {
        throw new Error('Decryption failed')
      })

      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'invalid',
        refreshToken: 'invalid',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const expired = await isTokenExpired(companyId)

      expect(expired).toBe(true)
    })
  })

  describe('hasValidToken', () => {
    it('should return true for valid token with buffer', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: futureDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const hasValid = await hasValidToken(companyId)

      expect(hasValid).toBe(true)
    })

    it('should return false for expired token', async () => {
      const pastDate = new Date(Date.now() - 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: pastDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const hasValid = await hasValidToken(companyId)

      expect(hasValid).toBe(false)
    })

    it('should return false for token within buffer', async () => {
      const nearFutureDate = new Date(Date.now() + 100 * 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: nearFutureDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const hasValid = await hasValidToken(companyId)

      expect(hasValid).toBe(false)
    })

    it('should return false for non-existent token', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const hasValid = await hasValidToken('non-existent')

      expect(hasValid).toBe(false)
    })

    it('should return false when decryption fails', async () => {
      const { decrypt } = await import('@/lib/crypto/encryption')
      vi.mocked(decrypt).mockImplementationOnce(() => {
        throw new Error('Decryption failed')
      })

      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'invalid',
        refreshToken: 'invalid',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const hasValid = await hasValidToken(companyId)

      expect(hasValid).toBe(false)
    })
  })

  describe('getValidAccessToken', () => {
    it('should return access token for valid token', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: futureDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const accessToken = await getValidAccessToken(companyId)

      expect(accessToken).toBe('test-access-token')
    })

    it('should return null for non-existent token', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const accessToken = await getValidAccessToken('non-existent')

      expect(accessToken).toBeNull()
    })

    it('should return null for expired token', async () => {
      const pastDate = new Date(Date.now() - 1000)
      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'encrypted_test-access-token',
        refreshToken: 'encrypted_test-refresh-token',
        expiresAt: pastDate,
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const accessToken = await getValidAccessToken(companyId)

      expect(accessToken).toBeNull()
    })

    it('should return null when decryption fails', async () => {
      const { decrypt } = await import('@/lib/crypto/encryption')
      vi.mocked(decrypt).mockImplementationOnce(() => {
        throw new Error('Decryption failed')
      })

      mockFindUnique.mockResolvedValueOnce({
        id: 'token-1',
        companyId,
        accessToken: 'invalid',
        refreshToken: 'invalid',
        expiresAt: new Date(Date.now() + 3600 * 1000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const accessToken = await getValidAccessToken(companyId)

      expect(accessToken).toBeNull()
    })
  })

  describe('parseTokenResponse', () => {
    it('should parse valid token response', () => {
      const response = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read write',
        created_at: 1234567890,
      }

      const result = parseTokenResponse(response)

      expect(result).toEqual({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'read write',
        created_at: 1234567890,
      })
    })

    it('should return null for null input', () => {
      const result = parseTokenResponse(null)
      expect(result).toBeNull()
    })

    it('should return null for undefined input', () => {
      const result = parseTokenResponse(undefined)
      expect(result).toBeNull()
    })

    it('should return null for non-object input', () => {
      expect(parseTokenResponse('string')).toBeNull()
      expect(parseTokenResponse(123)).toBeNull()
      expect(parseTokenResponse(true)).toBeNull()
    })

    it('should return null for missing required fields', () => {
      expect(parseTokenResponse({})).toBeNull()
      expect(parseTokenResponse({ access_token: 'test' })).toBeNull()
      expect(
        parseTokenResponse({
          access_token: 'test',
          refresh_token: 'test',
        })
      ).toBeNull()
    })

    it('should return null for wrong types', () => {
      expect(
        parseTokenResponse({
          access_token: 123,
          refresh_token: 'test',
          expires_in: 3600,
          token_type: 'Bearer',
        })
      ).toBeNull()

      expect(
        parseTokenResponse({
          access_token: 'test',
          refresh_token: 'test',
          expires_in: '3600',
          token_type: 'Bearer',
        })
      ).toBeNull()
    })

    it('should handle optional fields', () => {
      const response = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      const result = parseTokenResponse(response)

      expect(result).toEqual({
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: undefined,
        created_at: undefined,
      })
    })

    it('should only accept string for optional scope field', () => {
      const response = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 123,
      }

      const result = parseTokenResponse(response)

      expect(result?.scope).toBeUndefined()
    })

    it('should only accept number for optional created_at field', () => {
      const response = {
        access_token: 'test-access',
        refresh_token: 'test-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        created_at: '123456',
      }

      const result = parseTokenResponse(response)

      expect(result?.created_at).toBeUndefined()
    })
  })
})
