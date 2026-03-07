import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { auditLogger } from '@/lib/audit/audit-logger'
import { z } from 'zod'

const accessLogSchema = z.object({
  action: z.string().min(1),
  resourceId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
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

    if (user.role !== 'INVESTOR') {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { action, resourceId, details } = accessLogSchema.parse(body)

    await auditLogger.log({
      userId: user.id,
      action: `INVESTOR_${action.toUpperCase()}`,
      resource: 'investor_portal',
      resourceId,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: {
        ...details,
        investorEmail: user.email,
      },
      result: 'SUCCESS',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Access log error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
