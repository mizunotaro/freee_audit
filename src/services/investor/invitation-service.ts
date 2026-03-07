import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { auditLogger } from '@/lib/audit/audit-logger'

export const INVITATION_TOKEN_BYTES = 32
export const INVITATION_EXPIRY_DAYS = 7

export interface CreateInvitationInput {
  email: string
  invitedBy: string
}

export interface InvitationResult {
  success: boolean
  token?: string
  invitationId?: string
  error?: string
}

export interface ValidateTokenResult {
  valid: boolean
  invitation?: {
    id: string
    email: string
    token: string
    status: string
    expiresAt: Date
  }
  error?: string
}

export interface AcceptInvitationResult {
  success: boolean
  userId?: string
  error?: string
}

export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES).toString('hex')
}

export function calculateExpiryDate(): Date {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)
  return expiresAt
}

export async function createInvitation(input: CreateInvitationInput): Promise<InvitationResult> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    })

    if (existingUser) {
      return { success: false, error: 'User with this email already exists' }
    }

    const existingPending = await prisma.investorInvitation.findFirst({
      where: {
        email: input.email,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    })

    if (existingPending) {
      return { success: false, error: 'Pending invitation already exists for this email' }
    }

    const token = generateInvitationToken()
    const expiresAt = calculateExpiryDate()

    const invitation = await prisma.investorInvitation.create({
      data: {
        email: input.email,
        token,
        invitedBy: input.invitedBy,
        expiresAt,
        status: 'pending',
      },
    })

    await auditLogger.log({
      userId: input.invitedBy,
      action: 'CREATE_INVESTOR_INVITATION',
      resource: 'investor_invitation',
      resourceId: invitation.id,
      details: { email: input.email },
      result: 'SUCCESS',
    })

    return {
      success: true,
      token,
      invitationId: invitation.id,
    }
  } catch (error) {
    console.error('Failed to create invitation:', error)
    return { success: false, error: 'Failed to create invitation' }
  }
}

export async function validateInvitationToken(token: string): Promise<ValidateTokenResult> {
  try {
    const invitation = await prisma.investorInvitation.findUnique({
      where: { token },
    })

    if (!invitation) {
      return { valid: false, error: 'Invalid invitation token' }
    }

    if (invitation.status !== 'pending') {
      return { valid: false, error: `Invitation already ${invitation.status}` }
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.investorInvitation.update({
        where: { id: invitation.id },
        data: { status: 'expired' },
      })
      return { valid: false, error: 'Invitation has expired' }
    }

    return {
      valid: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        token: invitation.token,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    }
  } catch (error) {
    console.error('Failed to validate invitation token:', error)
    return { valid: false, error: 'Failed to validate token' }
  }
}

export async function acceptInvitation(
  token: string,
  name: string,
  password: string
): Promise<AcceptInvitationResult> {
  try {
    const validation = await validateInvitationToken(token)
    if (!validation.valid || !validation.invitation) {
      return { success: false, error: validation.error }
    }

    const { invitation } = validation

    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    })

    if (existingUser) {
      return { success: false, error: 'User already exists' }
    }

    const { hashPassword } = await import('@/lib/auth')
    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email: invitation.email,
        name,
        passwordHash,
        role: 'INVESTOR',
      },
    })

    await prisma.investorInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'accepted',
        userId: user.id,
        acceptedAt: new Date(),
      },
    })

    await auditLogger.log({
      userId: user.id,
      action: 'ACCEPT_INVESTOR_INVITATION',
      resource: 'investor_invitation',
      resourceId: invitation.id,
      details: { email: invitation.email },
      result: 'SUCCESS',
    })

    return { success: true, userId: user.id }
  } catch (error) {
    console.error('Failed to accept invitation:', error)
    return { success: false, error: 'Failed to accept invitation' }
  }
}

export async function getInvitationByToken(token: string) {
  return prisma.investorInvitation.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  })
}

export async function revokeInvitation(invitationId: string, revokedBy: string): Promise<boolean> {
  try {
    const invitation = await prisma.investorInvitation.findUnique({
      where: { id: invitationId },
    })

    if (!invitation) {
      return false
    }

    if (invitation.status !== 'pending') {
      return false
    }

    await prisma.investorInvitation.update({
      where: { id: invitationId },
      data: { status: 'revoked' },
    })

    await auditLogger.log({
      userId: revokedBy,
      action: 'REVOKE_INVESTOR_INVITATION',
      resource: 'investor_invitation',
      resourceId: invitationId,
      details: { email: invitation.email },
      result: 'SUCCESS',
    })

    return true
  } catch (error) {
    console.error('Failed to revoke invitation:', error)
    return false
  }
}

export async function listPendingInvitations() {
  return prisma.investorInvitation.findMany({
    where: { status: 'pending' },
    orderBy: { invitedAt: 'desc' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  })
}

export async function cleanupExpiredInvitations(): Promise<number> {
  try {
    const result = await prisma.investorInvitation.updateMany({
      where: {
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired' },
    })
    return result.count
  } catch (error) {
    console.error('Failed to cleanup expired invitations:', error)
    return 0
  }
}
