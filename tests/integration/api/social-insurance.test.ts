import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const serviceMocks = vi.hoisted(() => ({
  ScheduleManager: {
    getSchedules: vi.fn(),
    createSchedule: vi.fn(),
  },
  PaymentChecker: {
    getPayments: vi.fn(),
    createPayment: vi.fn(),
  },
}))
vi.mock('@/services/social-insurance', () => serviceMocks)

import {
  GET as getSchedules,
  POST as postSchedule,
} from '@/app/api/social-insurance/schedules/route'
import { GET as getPayments, POST as postPayment } from '@/app/api/social-insurance/payments/route'
import type { AuthUser } from '@/lib/auth'

const user: AuthUser = {
  id: 'user-1',
  email: 'analyst@example.com',
  name: 'Analyst',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

function buildRequest(
  url: string,
  method: 'GET' | 'POST',
  cookie: string | undefined,
  body?: unknown
): NextRequest {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  const init: { method: string; headers: Record<string, string>; body?: string } = {
    method,
    headers,
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  }
  return new NextRequest(url, init)
}

describe('GET /api/social-insurance/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await getSchedules(
      buildRequest('http://localhost/api/social-insurance/schedules', 'GET', undefined)
    )

    expect(response.status).toBe(401)
    expect(serviceMocks.ScheduleManager.getSchedules).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid insuranceType filter', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await getSchedules(
      buildRequest(
        'http://localhost/api/social-insurance/schedules?insuranceType=bogus',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.ScheduleManager.getSchedules).not.toHaveBeenCalled()
  })

  it('returns schedules filtered by status and type', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const schedules = [{ id: 's1', insuranceType: 'health', status: 'PENDING' }]
    serviceMocks.ScheduleManager.getSchedules.mockResolvedValue(schedules)

    const response = await getSchedules(
      buildRequest(
        'http://localhost/api/social-insurance/schedules?insuranceType=health&status=OVERDUE',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(schedules)
    expect(serviceMocks.ScheduleManager.getSchedules).toHaveBeenCalledWith('company-1', {
      insuranceType: 'health',
      status: 'OVERDUE',
    })
  })
})

describe('POST /api/social-insurance/schedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postSchedule(
      buildRequest(
        'http://localhost/api/social-insurance/schedules',
        'POST',
        'session=valid-token',
        {
          insuranceType: 'health',
          dueDate: '2024-05-01',
        }
      )
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.ScheduleManager.createSchedule).not.toHaveBeenCalled()
  })

  it('creates a schedule and returns 201', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.ScheduleManager.createSchedule.mockResolvedValue({
      id: 's1',
      insuranceType: 'health',
      taskName: 'Pay health',
    })

    const response = await postSchedule(
      buildRequest(
        'http://localhost/api/social-insurance/schedules',
        'POST',
        'session=valid-token',
        {
          insuranceType: 'health',
          taskName: 'Pay health',
          dueDate: '2024-05-01',
          notes: 'note',
        }
      )
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe('s1')
    expect(serviceMocks.ScheduleManager.createSchedule).toHaveBeenCalledWith({
      companyId: 'company-1',
      insuranceType: 'health',
      taskName: 'Pay health',
      dueDate: expect.any(Date),
      notes: 'note',
    })
  })
})

describe('GET /api/social-insurance/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns payments filtered by year and month', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    const payments = [{ id: 'p1', insuranceType: 'pension', year: 2024, month: 4 }]
    serviceMocks.PaymentChecker.getPayments.mockResolvedValue(payments)

    const response = await getPayments(
      buildRequest(
        'http://localhost/api/social-insurance/payments?year=2024&month=4',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(payments)
    expect(serviceMocks.PaymentChecker.getPayments).toHaveBeenCalledWith('company-1', {
      insuranceType: undefined,
      year: 2024,
      month: 4,
    })
  })

  it('returns 400 for an out-of-range year', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await getPayments(
      buildRequest(
        'http://localhost/api/social-insurance/payments?year=1800',
        'GET',
        'session=valid-token'
      )
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.PaymentChecker.getPayments).not.toHaveBeenCalled()
  })
})

describe('POST /api/social-insurance/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when required fields are missing', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)

    const response = await postPayment(
      buildRequest(
        'http://localhost/api/social-insurance/payments',
        'POST',
        'session=valid-token',
        {
          insuranceType: 'pension',
          year: 2024,
          month: 4,
        }
      )
    )

    expect(response.status).toBe(400)
    expect(serviceMocks.PaymentChecker.createPayment).not.toHaveBeenCalled()
  })

  it('creates a payment and returns 201', async () => {
    const { validateSession } = await import('@/lib/auth')
    vi.mocked(validateSession).mockResolvedValue(user)
    serviceMocks.PaymentChecker.createPayment.mockResolvedValue({
      id: 'p1',
      insuranceType: 'pension',
      year: 2024,
      month: 4,
    })

    const response = await postPayment(
      buildRequest(
        'http://localhost/api/social-insurance/payments',
        'POST',
        'session=valid-token',
        {
          insuranceType: 'pension',
          year: 2024,
          month: 4,
          expectedAmount: 1000,
          actualAmount: 950,
          dueDate: '2024-04-10',
        }
      )
    )

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.id).toBe('p1')
    expect(serviceMocks.PaymentChecker.createPayment).toHaveBeenCalledWith({
      companyId: 'company-1',
      insuranceType: 'pension',
      year: 2024,
      month: 4,
      expectedAmount: 1000,
      actualAmount: 950,
      dueDate: expect.any(Date),
      journalEntryId: undefined,
      paymentDate: undefined,
      notes: undefined,
    })
  })
})
