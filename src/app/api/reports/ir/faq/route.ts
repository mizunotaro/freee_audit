import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { FAQItem } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const FAQSchema = z.object({
  question: z.object({
    ja: z.string().min(1).max(500),
    en: z.string().min(1).max(500),
  }),
  answer: z.object({
    ja: z.string().min(1).max(5000),
    en: z.string().min(1).max(5000),
  }),
  category: z.string().max(100).optional(),
  order: z.number().int().min(0).optional(),
})

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 100 })

const faqStore: Map<string, FAQItem[]> = new Map()

function getFAQs(companyId: string): FAQItem[] {
  return faqStore.get(companyId) || []
}

function saveFAQs(companyId: string, faqs: FAQItem[]): void {
  faqStore.set(companyId, faqs)
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await limiter(request)
  if (limited) return limited

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const user = await requireAuth(request)
    if (user instanceof NextResponse) return user

    const companyId = getCompanyId(user)
    if (!companyId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 })
      )
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    let faqs = getFAQs(companyId)

    if (category) {
      faqs = faqs.filter((f) => f.category === category)
    }

    faqs.sort((a, b) => a.order - b.order)

    return addSecurityHeaders(NextResponse.json({ success: true, data: faqs }))
  } catch (error) {
    console.error('FAQ GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch FAQs' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = await limiter(request)
  if (limited) return limited

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const user = await requireAuth(request)
    if (user instanceof NextResponse) return user

    const companyId = getCompanyId(user)
    if (!companyId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 })
      )
    }

    const body = await request.json()
    const parseResult = FAQSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const faqs = getFAQs(companyId)
    const newFAQ: FAQItem = {
      id: generateId(),
      question: parseResult.data.question,
      answer: parseResult.data.answer,
      category: parseResult.data.category,
      order: parseResult.data.order ?? faqs.length,
    }

    faqs.push(newFAQ)
    saveFAQs(companyId, faqs)

    return addSecurityHeaders(NextResponse.json({ success: true, data: newFAQ }, { status: 201 }))
  } catch (error) {
    console.error('FAQ POST error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to create FAQ' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
