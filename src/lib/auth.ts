import * as bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './db'
import type { Session } from '@prisma/client'

const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production'
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

export async function generateToken(userId: string): Promise<string> {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: `${SESSION_DURATION_HOURS}h` })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string }
    return decoded
  } catch {
    return null
  }
}

export async function createSession(userId: string): Promise<Session> {
  const token = await generateToken(userId)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000)

  return prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  })
}

export async function validateSession(token: string): Promise<AuthUser | null> {
  const decoded = verifyToken(token)
  if (!decoded) return null

  const session = await prisma.session.findUnique({
    where: { token },
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

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user || !user.passwordHash) {
    return { success: false, error: 'Invalid credentials' }
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    return { success: false, error: 'Invalid credentials' }
  }

  const session = await createSession(user.id)

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    },
    token: session.token,
  }
}

export async function logout(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } })
}

export function hasPermission(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole)
}
