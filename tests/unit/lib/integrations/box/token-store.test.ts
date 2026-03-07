import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  saveToken,
  getToken,
  deleteToken,
  isTokenExpired,
  hasValidToken,
  parseTokenResponse,
} from '@/lib/integrations/box/token-store'
import type { BoxTokenResponse } from '@/lib/integrations/box/types'

vi.mock('@/lib/db', () => ({
  prisma: {
    boxToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted_${text}`),
  decrypt: vi.fn((text: string) => text.replace('encrypted_', '')),
}))

describe('Box Token Store', () => {
  let mockUpsert: ReturnType<typeof vi.fn>
  let mockFindUnique: ReturnType<typeof vi.fn>
  let mockDelete: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()
    const { prisma } = await import('@/lib/db')
    mockUpsert = prisma.boxToken.upsert as ReturnType<typeof vi.fn>
    mockFindUnique = prisma.boxToken.findUnique as ReturnType<typeof vi.fn>
    mockDelete = prisma.boxToken.delete as ReturnType<typeof vi.fn>
  })

  describe('saveToken', () => {
    it('should encrypt and save token', async () => {
      const tokenResponse: BoxTokenResponse = {
        access_token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'root_readwrite',
      }

      await saveToken('company_123', tokenResponse)

      expect(mockUpsert).toHaveBeenCalledWith({
        where: { companyId: 'company_123' },
        create: expect.objectContaining({
          companyId: 'company_123',
          accessToken: 'encrypted_test_access_token',
          refreshToken: 'encrypted_test_refresh_token',
          tokenType: 'Bearer',
          scope: 'root_readwrite',
        }),
        update: expect.objectContaining({
          accessToken: 'encrypted_test_access_token',
          refreshToken: 'encrypted_test_refresh_token',
          tokenType: 'Bearer',
          scope: 'root_readwrite',
        }),
      })
    })
  })

  describe('getToken', () => {
    it('should decrypt and return token', async () => {
      const mockTokenRecord = {
        id: 'token_id',
        companyId: 'company_123',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: 'root_readwrite',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockTokenRecord)

      const result = await getToken('company_123')

      expect(result).toEqual({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        expiresAt: mockTokenRecord.expiresAt,
        tokenType: 'Bearer',
        scope: 'root_readwrite',
      })
    })

    it('should return null when token not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const result = await getToken('nonexistent_company')

      expect(result).toBeNull()
    })
  })

  describe('deleteToken', () => {
    it('should delete token', async () => {
      await deleteToken('company_123')

      expect(mockDelete).toHaveBeenCalledWith({
        where: { companyId: 'company_123' },
      })
    })
  })

  describe('isTokenExpired', () => {
    it('should return true when no token exists', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const result = await isTokenExpired('company_123')

      expect(result).toBe(true)
    })

    it('should return true when token is expired', async () => {
      const mockTokenRecord = {
        id: 'token_id',
        companyId: 'company_123',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() - 1000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockTokenRecord)

      const result = await isTokenExpired('company_123')

      expect(result).toBe(true)
    })

    it('should return false when token is valid', async () => {
      const mockTokenRecord = {
        id: 'token_id',
        companyId: 'company_123',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 3600000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockTokenRecord)

      const result = await isTokenExpired('company_123')

      expect(result).toBe(false)
    })
  })

  describe('hasValidToken', () => {
    it('should return false when no token exists', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const result = await hasValidToken('company_123')

      expect(result).toBe(false)
    })

    it('should return true when token has buffer time remaining', async () => {
      const mockTokenRecord = {
        id: 'token_id',
        companyId: 'company_123',
        accessToken: 'encrypted_access_token',
        refreshToken: 'encrypted_refresh_token',
        expiresAt: new Date(Date.now() + 600000),
        tokenType: 'Bearer',
        scope: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFindUnique.mockResolvedValueOnce(mockTokenRecord)

      const result = await hasValidToken('company_123')

      expect(result).toBe(true)
    })
  })

  describe('parseTokenResponse', () => {
    it('should parse valid token response', () => {
      const response = {
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'root_readwrite',
      }

      const result = parseTokenResponse(response)

      expect(result).toEqual({
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'root_readwrite',
      })
    })

    it('should return null for invalid response', () => {
      const response = {
        access_token: 'test',
      }

      const result = parseTokenResponse(response)

      expect(result).toBeNull()
    })

    it('should return null for non-object response', () => {
      expect(parseTokenResponse(null)).toBeNull()
      expect(parseTokenResponse('string')).toBeNull()
      expect(parseTokenResponse(123)).toBeNull()
    })

    it('should handle missing optional fields', () => {
      const response = {
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      }

      const result = parseTokenResponse(response)

      expect(result).toEqual({
        access_token: 'test_access',
        refresh_token: 'test_refresh',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: undefined,
      })
    })
  })
})
