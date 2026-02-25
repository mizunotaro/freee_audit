import { NextRequest, NextResponse } from 'next/server'
import { logout, validateSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (token) {
    const user = await validateSession(token)
    if (user) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'logout',
          resource: 'auth',
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          result: 'SUCCESS',
        },
      })
    }

    await logout(token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete('session')

  return response
}
