import * as bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { prisma } from './db'
import type { Session } from '@prisma/client'

function getRequiredEnvVar(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`)
  }
  return value
}

const JWT_SECRET = getRequiredEnvVar('JWT_SECRET')
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
const SESSION_DURATION_HOURS = 24

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  companyId: string | null
}

export interface LoginResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function generateToken(
  userId: string,
  sessionId: string,
  role: string,
  companyId: string | null
): Promise<string> {
  return jwt.sign(
    {
      userId,
      sessionId,
      role,
      companyId,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    {
      expiresIn: `${SESSION_DURATION_HOURS}h`,
      issuer: 'freee_audit',
      audience: 'freee_audit_users',
    }
  )
}

export function verifyToken(
  token: string
): { userId: string; sessionId: string; role: string; companyId: string | null } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'freee_audit',
      audience: 'freee_audit_users',
    }) as { userId: string; sessionId: string; role: string; companyId: string | null }
    return decoded
  } catch {
    return null
  }
}

export function constantTimeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  userId: string,
  role: string,
  companyId: string | null
): Promise<{ token: string; session: Session }> {
  const sessionId = crypto.randomUUID()
  const token = await generateToken(userId, sessionId, role, companyId)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000)

  const session = await prisma.session.create({
    data: {
      userId,
      token: hashToken(token),
      expiresAt,
    },
  })

  return { token, session }
}

export async function validateSession(token: string): Promise<AuthUser | null> {
  const decoded = verifyToken(token)
  if (!decoded) return null

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    return null
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    companyId: session.user.companyId,
  }
}

const DUMMY_HASH = '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const LOCKOUT_MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000

const memoryLockout = new Map<string, { count: number; lockedUntil: number }>()

function getLockoutKey(email: string, ip: string): string {
  return `${email}:${ip}`
}

async function isAccountLocked(email: string, ip: string): Promise<boolean> {
  try {
    const record = await prisma.loginAttempt.findUnique({
      where: { email_ipAddress: { email, ipAddress: ip } },
    })
    if (!record) return false
    if (record.lockedUntil && new Date() < record.lockedUntil) return true
    if (record.lockedUntil && new Date() >= record.lockedUntil) {
      await prisma.loginAttempt.delete({
        where: { email_ipAddress: { email, ipAddress: ip } },
      })
      return false
    }
    return false
  } catch {
    const key = getLockoutKey(email, ip)
    const record = memoryLockout.get(key)
    if (!record) return false
    if (record.lockedUntil && Date.now() < record.lockedUntil) return true
    return false
  }
}

async function recordFailedAttempt(email: string, ip: string): Promise<void> {
  try {
    const record = await prisma.loginAttempt.upsert({
      where: { email_ipAddress: { email, ipAddress: ip } },
      create: { email, ipAddress: ip, attemptCount: 1 },
      update: { attemptCount: { increment: 1 } },
    })
    if (record.attemptCount >= LOCKOUT_MAX_ATTEMPTS) {
      await prisma.loginAttempt.update({
        where: { email_ipAddress: { email, ipAddress: ip } },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) },
      })
    }
  } catch {
    const key = getLockoutKey(email, ip)
    const record = memoryLockout.get(key) ?? { count: 0, lockedUntil: 0 }
    record.count++
    if (record.count >= LOCKOUT_MAX_ATTEMPTS) {
      record.lockedUntil = Date.now() + LOCKOUT_DURATION_MS
    }
    memoryLockout.set(key, record)
  }
}

async function clearFailedAttempts(email: string, ip: string): Promise<void> {
  try {
    await prisma.loginAttempt.delete({
      where: { email_ipAddress: { email, ipAddress: ip } },
    })
  } catch {
    memoryLockout.delete(getLockoutKey(email, ip))
  }
}

export async function login(email: string, password: string, ip?: string): Promise<LoginResult> {
  const clientIp = ip ?? 'unknown'

  if (await isAccountLocked(email, clientIp)) {
    return { success: false, error: 'Account temporarily locked due to too many failed attempts' }
  }

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.passwordHash) {
    await verifyPassword(password, DUMMY_HASH)
    await recordFailedAttempt(email, clientIp)
    return { success: false, error: 'Invalid credentials' }
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    await recordFailedAttempt(email, clientIp)
    return { success: false, error: 'Invalid credentials' }
  }

  await clearFailedAttempts(email, clientIp)

  const { token, session: _session } = await createSession(user.id, user.role, user.companyId)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
    token,
  }
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token: hashToken(token) } })
}

export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole)
}
