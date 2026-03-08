import { z } from 'zod'
import type { AuthenticatedRequest } from '@/lib/api'
import type { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

export const CONFIG_VERSION = '1.0.0'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

/**
 * Execute an async operation with retry logic and exponential backoff
 * @param operation - The async operation to execute
 * @param config - Retry configuration options
 * @returns Result of the operation or throws the last error
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined
  let delay = config.initialDelayMs

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < config.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs)
      }
    }
  }

  throw lastError
}

/**
 * Sleep for a specified duration
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * Simple in-memory cache with TTL support
 */
export class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private maxSize: number

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize
  }

  /**
   * Get a value from cache
   * @param key - Cache key
   * @returns Cached value or undefined if expired/not found
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return undefined
    }
    return entry.data
  }

  /**
   * Set a value in cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttlMs - Time to live in milliseconds
   */
  set(key: string, data: T, ttlMs: number = 60000): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    })
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern - RegExp pattern to match keys
   */
  invalidate(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }
}

export interface ProposalCacheEntry {
  id: string
  documentId: string
  companyId: string
  status: string
  proposals: string
  aiProvider: string
  aiModel: string
  createdBy: string
  createdAt: Date
  reviewedBy: string | null
  reviewedAt: Date | null
}

export const proposalCache = new MemoryCache<ProposalCacheEntry>(50)

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
})

export const listQuerySchema = paginationSchema.extend({
  companyId: z.string().min(1),
  status: z.enum(['pending', 'proposed', 'approved', 'rejected']).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const uploadSchema = z.object({
  companyId: z.string().min(1),
})

export const analyzeSchema = z.object({
  receiptId: z.string().min(1),
  additionalContext: z.string().max(2000).optional(),
})

export const updateProposalSchema = z.object({
  entryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().max(200).optional(),
  amount: z.number().nonnegative().optional(),
})

export const approveSchema = z.object({
  reviewerNotes: z.string().max(1000).optional(),
})

export const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
})

export type ListQuery = z.infer<typeof listQuerySchema>
export type UploadInput = z.infer<typeof uploadSchema>
export type AnalyzeInput = z.infer<typeof analyzeSchema>
export type UpdateProposalInput = z.infer<typeof updateProposalSchema>
export type ApproveInput = z.infer<typeof approveSchema>
export type RejectInput = z.infer<typeof rejectSchema>

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * Create a standardized error response
 * @param code - Error code identifier
 * @param message - User-friendly error message
 * @param details - Additional error details (optional)
 * @returns API error response object
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, details },
  }
}

/**
 * Create a standardized success response
 * @param data - Response data
 * @returns API success response object
 */
export function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data }
}

/**
 * Verify that the authenticated user has access to the specified company
 * @param req - Authenticated request object
 * @param companyId - Company ID to check access for
 * @returns true if user has access, false otherwise
 */
export async function verifyCompanyAccess(
  req: AuthenticatedRequest,
  companyId: string
): Promise<boolean> {
  if (!req.user.companyId) return false
  return req.user.companyId === companyId || req.user.role === 'SUPER_ADMIN'
}

export interface CachedProposalData {
  proposal: ProposalCacheEntry & { document: { id: string; originalName: string } }
  document: { id: string; originalName: string }
}

/**
 * Retrieve a proposal with authorization check
 * @param proposalId - Proposal ID to retrieve
 * @param req - Authenticated request for authorization
 * @param prisma - Prisma client instance
 * @returns Proposal and document if found and authorized, null otherwise
 */
export async function getProposalWithAuth(
  proposalId: string,
  req: AuthenticatedRequest,
  prisma: PrismaClient
): Promise<CachedProposalData | null> {
  const cacheKey = `proposal:${proposalId}`
  const cached = proposalCache.get(cacheKey)
  if (cached) {
    const hasAccess = await verifyCompanyAccess(req, cached.companyId)
    if (!hasAccess) return null
    return {
      proposal: cached as CachedProposalData['proposal'],
      document: { id: cached.documentId, originalName: '' },
    }
  }

  const proposal = await prisma.journalProposal.findUnique({
    where: { id: proposalId },
    include: {
      document: {
        select: { id: true, originalName: true },
      },
      company: true,
    },
  })

  if (!proposal) return null

  const hasAccess = await verifyCompanyAccess(req, proposal.companyId)
  if (!hasAccess) return null

  const cacheEntry: ProposalCacheEntry = {
    id: proposal.id,
    documentId: proposal.documentId,
    companyId: proposal.companyId,
    status: proposal.status,
    proposals: proposal.proposals,
    aiProvider: proposal.aiProvider,
    aiModel: proposal.aiModel,
    createdBy: proposal.createdBy,
    createdAt: proposal.createdAt,
    reviewedBy: proposal.reviewedBy,
    reviewedAt: proposal.reviewedAt,
  }

  proposalCache.set(cacheKey, cacheEntry, 30000)

  return {
    proposal: { ...cacheEntry, document: proposal.document },
    document: proposal.document,
  }
}

export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

export const MAX_FILE_SIZE = 10 * 1024 * 1024

/**
 * Validate uploaded file type and size
 * @param file - File to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    }
  }

  return { valid: true }
}

/**
 * Generate SHA-256 hash of file buffer
 * @param buffer - File buffer to hash
 * @returns Hex-encoded hash string
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

const SENSITIVE_KEYS = ['password', 'apiKey', 'token', 'secret', 'credential', 'authorization']

/**
 * Sanitize object for safe logging by redacting sensitive fields
 * @param obj - Object to sanitize
 * @returns Sanitized copy with sensitive values redacted
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}

/**
 * Sanitize user input string
 * @param input - Input string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return (
    input
      // eslint-disable-next-line no-control-regex -- Remove control characters for security (XSS/injection prevention)
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, maxLength)
      .trim()
  )
}
