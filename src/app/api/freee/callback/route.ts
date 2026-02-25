import { NextRequest, NextResponse } from 'next/server'
import { FreeeClient } from '@/lib/integrations/freee/client'
import { saveToken } from '@/lib/integrations/freee/token-store'
import { prisma } from '@/lib/db'

const client = new FreeeClient()

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      return NextResponse.redirect(
        new URL(
          `/settings/freee?error=${encodeURIComponent(errorDescription || error)}`,
          request.url
        )
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/settings/freee?error=missing_parameters', request.url))
    }

    const storedState = request.cookies.get('freee_oauth_state')?.value
    const [companyId, stateToken] = state.split(':')

    if (!storedState || storedState !== stateToken) {
      return NextResponse.redirect(new URL('/settings/freee?error=invalid_state', request.url))
    }

    const tokenResponse = await client.exchangeCodeForToken(code)

    let targetCompanyId = companyId
    if (targetCompanyId === 'default') {
      let company = await prisma.company.findFirst()
      if (!company) {
        company = await prisma.company.create({
          data: {
            name: 'Default Company',
            fiscalYearStart: 1,
          },
        })
      }
      targetCompanyId = company.id
    }

    await saveToken(targetCompanyId, tokenResponse)

    const response = NextResponse.redirect(new URL('/settings/freee?connected=true', request.url))

    response.cookies.delete('freee_oauth_state')

    return response
  } catch (error) {
    console.error('Failed to handle freee callback:', error)
    return NextResponse.redirect(
      new URL('/settings/freee?error=authentication_failed', request.url)
    )
  }
}
