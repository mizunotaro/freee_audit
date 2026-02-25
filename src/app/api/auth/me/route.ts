import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
  }

  const user = await validateSession(token)

  if (!user) {
    const response = NextResponse.json(
      { success: false, error: 'Invalid or expired session' },
      { status: 401 }
    )
    response.cookies.delete('session')
    return response
  }

  return NextResponse.json({
    success: true,
    user,
  })
}
