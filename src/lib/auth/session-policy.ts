import { prisma } from '@/lib/db'

const VERSION = '1.0.0'

export interface SessionPolicyConfig {
  maxConcurrentSessions: number
  sessionMaxAgeMs: number
  idleTimeoutMs: number
  refreshWindowMs: number
  enforceSingleSession: boolean
}

const DEFAULT_POLICY: SessionPolicyConfig = {
  maxConcurrentSessions: 5,
  sessionMaxAgeMs: 24 * 60 * 60 * 1000,
  idleTimeoutMs: 4 * 60 * 60 * 1000,
  refreshWindowMs: 30 * 60 * 1000,
  enforceSingleSession: false,
}

function getConfig(): SessionPolicyConfig {
  return {
    maxConcurrentSessions: parseInt(
      process.env.SESSION_MAX_CONCURRENT ?? String(DEFAULT_POLICY.maxConcurrentSessions),
      10
    ),
    sessionMaxAgeMs: parseInt(
      process.env.SESSION_MAX_AGE_MS ?? String(DEFAULT_POLICY.sessionMaxAgeMs),
      10
    ),
    idleTimeoutMs: parseInt(
      process.env.SESSION_IDLE_TIMEOUT_MS ?? String(DEFAULT_POLICY.idleTimeoutMs),
      10
    ),
    refreshWindowMs: parseInt(
      process.env.SESSION_REFRESH_WINDOW_MS ?? String(DEFAULT_POLICY.refreshWindowMs),
      10
    ),
    enforceSingleSession: process.env.SESSION_ENFORCE_SINGLE === 'true',
  }
}

export interface SessionValidationResult {
  valid: boolean
  reason?: string
  shouldRefresh?: boolean
  shouldTerminate?: boolean
}

export function validateSessionPolicy(
  session: {
    createdAt: Date
    expiresAt: Date
    lastActivity?: Date | null
  },
  config?: SessionPolicyConfig
): SessionValidationResult {
  const policy = config ?? getConfig()
  const now = Date.now()

  if (session.expiresAt.getTime() < now) {
    return { valid: false, reason: 'session_expired', shouldTerminate: true }
  }

  const sessionAge = now - session.createdAt.getTime()
  if (sessionAge > policy.sessionMaxAgeMs) {
    return { valid: false, reason: 'max_age_exceeded', shouldTerminate: true }
  }

  if (session.lastActivity) {
    const idleTime = now - session.lastActivity.getTime()
    if (idleTime > policy.idleTimeoutMs) {
      return { valid: false, reason: 'idle_timeout', shouldTerminate: true }
    }
  }

  const timeUntilExpiry = session.expiresAt.getTime() - now
  if (timeUntilExpiry < policy.refreshWindowMs) {
    return { valid: true, shouldRefresh: true }
  }

  return { valid: true }
}

export async function enforceConcurrentSessionLimit(
  userId: string,
  config?: SessionPolicyConfig
): Promise<number> {
  const policy = config ?? getConfig()

  if (policy.enforceSingleSession) {
    const result = await prisma.session.deleteMany({ where: { userId } })
    return result.count
  }

  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (sessions.length >= policy.maxConcurrentSessions) {
    const toDelete = sessions.slice(0, sessions.length - policy.maxConcurrentSessions + 1)
    if (toDelete.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: toDelete.map((s) => s.id) } },
      })
    }
    return toDelete.length
  }

  return 0
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}

export function getPolicyConfig(): SessionPolicyConfig {
  return { ...getConfig() }
}

export { VERSION, DEFAULT_POLICY }
