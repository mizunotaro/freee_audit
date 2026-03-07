import { NextRequest, NextResponse } from 'next/server'
import { acceptInvitation, validateInvitationToken } from '@/services/investor/invitation-service'
import { z } from 'zod'
import { login } from '@/lib/auth'
import { withRateLimit } from '@/lib/security'

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
})

async function postHandler(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, name, password } = acceptSchema.parse(body)

    const result = await acceptInvitation(token, name, password)

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    const validation = await validateInvitationToken(token)
    if (!validation.valid || !validation.invitation) {
      return NextResponse.json(
        { success: false, error: 'Invalid token after acceptance' },
        { status: 500 }
      )
    }

    const loginResult = await login(validation.invitation.email, password)
    if (!loginResult.success || !loginResult.token) {
      return NextResponse.json({ success: true, userId: result.userId }, { status: 201 })
    }

    const response = NextResponse.json({
      success: true,
      userId: result.userId,
      user: loginResult.user,
    })

    response.cookies.set('session', loginResult.token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
      domain: process.env.COOKIE_DOMAIN || undefined,
    })

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Accept invitation error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

async function getHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }

    const result = await validateInvitationToken(token)

    if (!result.valid) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      invitation: {
        email: result.invitation!.email,
        expiresAt: result.invitation!.expiresAt,
      },
    })
  } catch (error) {
    console.error('Validate token error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export const POST = withRateLimit(postHandler, {
  windowMs: 900000,
  maxRequests: 5,
})

export const GET = withRateLimit(getHandler, {
  windowMs: 900000,
  maxRequests: 10,
})
