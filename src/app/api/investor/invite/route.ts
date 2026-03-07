import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { createInvitation } from '@/services/investor/invitation-service'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
})

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const user = await validateSession(token)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
    }

    if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email } = inviteSchema.parse(body)

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'

    const result = await createInvitation({
      email,
      invitedBy: user.id,
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    const inviteUrl = `${baseUrl}/investor/accept?token=${result.token}`

    return NextResponse.json({
      success: true,
      invitationId: result.invitationId,
      inviteUrl,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Invite error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
