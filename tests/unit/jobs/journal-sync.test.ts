import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { syncJournals } from '@/jobs/journal-sync'
import { prisma } from '@/lib/db'
import { createFreeeClient } from '@/lib/integrations/freee/client'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'
import { auditLogger } from '@/lib/audit/audit-logger'

vi.mock('@/lib/db', () => ({
  prisma: {
    apiKey: {
      findFirst: vi.fn(),
    },
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    journal: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

const mockGetJournals = vi.fn()

vi.mock('@/lib/integrations/freee/client', () => ({
  createFreeeClient: vi.fn(() => ({ getJournals: mockGetJournals })),
}))

vi.mock('@/lib/integrations/slack/notifier', () => ({
  createAuditNotifier: vi.fn(),
}))

vi.mock('@/lib/audit/audit-logger', () => ({
  auditLogger: {
    logFreeeApiCall: vi.fn(),
  },
}))

const upsertMock = prisma.journal.upsert as unknown as Mock<
  (args?: { where: { freeeJournalId: string } }) => Promise<unknown>
>

function buildFreeeJournal(id: number, description: string) {
  return {
    id,
    issue_date: '2024-01-10',
    description,
    details: [
      {
        entry_side: 'debit',
        account_item_name: '現金',
        amount: 1000,
        vat: 100,
        vat_name: '課税売上',
      },
      {
        entry_side: 'credit',
        account_item_name: '売上',
        amount: 1000,
        vat: 100,
        vat_name: '課税売上',
      },
    ],
  }
}

describe('journal-sync bulk ingest (PERF-03-03)', () => {
  let mockNotifier: { notifySyncComplete: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetJournals.mockReset()

    mockNotifier = { notifySyncComplete: vi.fn() }
    vi.mocked(createAuditNotifier).mockReturnValue(
      mockNotifier as unknown as ReturnType<typeof createAuditNotifier>
    )
    vi.mocked(createFreeeClient).mockReturnValue({
      getJournals: mockGetJournals,
    } as unknown as ReturnType<typeof createFreeeClient>)

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      encryptedKey: 'enc-key',
    } as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({
      freeeCompanyId: '123',
    } as never)
    vi.mocked(prisma.journal.upsert).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses a single bulk existence probe per page instead of per-row findUnique', async () => {
    const freeeJournals = [buildFreeeJournal(100, 'sale'), buildFreeeJournal(200, 'cost')]
    mockGetJournals.mockResolvedValue({
      journals: freeeJournals,
      meta: { total_count: 2 },
    })

    // id 100 already exists; id 200 is new
    vi.mocked(prisma.journal.findMany).mockResolvedValue([{ freeeJournalId: '100' }] as never)

    const result = await syncJournals({ companyId: 'company-1' })

    // Exactly one probe query for the whole page
    expect(prisma.journal.findMany).toHaveBeenCalledTimes(1)
    expect(prisma.journal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { freeeJournalId: { in: ['100', '200'] } },
        select: { freeeJournalId: true },
      })
    )

    expect(result.totalSynced).toBe(2)
    expect(result.updatedJournals).toBe(1)
    expect(result.newJournals).toBe(1)
    expect(result.errors).toBe(0)
  })

  it('upserts each journal once (update path for known, create path for new)', async () => {
    const freeeJournals = [buildFreeeJournal(100, 'sale'), buildFreeeJournal(200, 'cost')]
    mockGetJournals.mockResolvedValue({
      journals: freeeJournals,
      meta: { total_count: 2 },
    })
    vi.mocked(prisma.journal.findMany).mockResolvedValue([{ freeeJournalId: '100' }] as never)

    await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).toHaveBeenCalledTimes(2)
    const calls = vi.mocked(prisma.journal.upsert).mock.calls
    const upsertedIds = calls.map(
      (c) => (c[0] as { where: { freeeJournalId: string } }).where.freeeJournalId
    )
    expect(upsertedIds).toEqual(['100', '200'])

    const first = calls[0]?.[0] as {
      where: { freeeJournalId: string }
      update: { freeeJournalId: string; companyId: string }
      create: { freeeJournalId: string; companyId: string }
    }
    expect(first.where.freeeJournalId).toBe('100')
    expect(first.update.freeeJournalId).toBe('100')
    expect(first.create.freeeJournalId).toBe('100')
    expect(first.update.companyId).toBe('company-1')
  })

  it('preserves per-row error isolation when an upsert fails', async () => {
    const freeeJournals = [
      buildFreeeJournal(100, 'sale'),
      buildFreeeJournal(200, 'cost'),
      buildFreeeJournal(300, 'fee'),
    ]
    mockGetJournals.mockResolvedValue({
      journals: freeeJournals,
      meta: { total_count: 3 },
    })
    vi.mocked(prisma.journal.findMany).mockResolvedValue([] as never)
    upsertMock.mockImplementation(async (args) => {
      const id = args?.where.freeeJournalId
      if (id === '200') throw new Error('write failed')
      return {} as never
    })

    const result = await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).toHaveBeenCalledTimes(3)
    expect(result.totalSynced).toBe(2)
    expect(result.newJournals).toBe(2)
    expect(result.errors).toBe(1)
  })

  it('skips a company that has no stored API key', async () => {
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null as never)

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).not.toHaveBeenCalled()
    expect(result.totalSynced).toBe(0)
  })
})

describe('syncJournals coverage (happy path, edges, fail-safe)', () => {
  let mockNotifier: { notifySyncComplete: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetJournals.mockReset()

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    mockNotifier = { notifySyncComplete: vi.fn().mockResolvedValue(true) }
    vi.mocked(createAuditNotifier).mockReturnValue(
      mockNotifier as unknown as ReturnType<typeof createAuditNotifier>
    )
    vi.mocked(createFreeeClient).mockReturnValue({
      getJournals: mockGetJournals,
    } as unknown as ReturnType<typeof createFreeeClient>)

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({ encryptedKey: 'enc-key' } as never)
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ freeeCompanyId: '123' } as never)
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: 'company-1' }] as never)
    vi.mocked(prisma.journal.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.journal.upsert).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const firstCreate = (): Record<string, unknown> =>
    (vi.mocked(prisma.journal.upsert).mock.calls[0]?.[0] as { create: Record<string, unknown> })
      .create

  it('paginates across multiple pages and accumulates counts across the whole run', async () => {
    const total = 150
    const all = Array.from({ length: total }, (_, i) => buildFreeeJournal(i + 1, `entry-${i + 1}`))
    mockGetJournals.mockImplementation(async (_c, _s, _e, _l, off = 0) => ({
      journals: all.slice(off, off + 100),
      meta: { total_count: total },
    }))

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).toHaveBeenCalledTimes(2)
    expect(mockGetJournals.mock.calls.map((c) => c[4])).toEqual([0, 100])
    expect(prisma.journal.findMany).toHaveBeenCalledTimes(2)
    expect(result.totalSynced).toBe(150)
    expect(result.newJournals).toBe(150)
    expect(result.errors).toBe(0)
  })

  it('stops after a single page when total_count exactly equals the page limit (boundary)', async () => {
    const full = Array.from({ length: 100 }, (_, i) => buildFreeeJournal(i + 1, `e-${i + 1}`))
    mockGetJournals.mockImplementation(async (_c, _s, _e, _l, off = 0) => ({
      journals: full.slice(off, off + 100),
      meta: { total_count: 100 },
    }))

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).toHaveBeenCalledTimes(1)
    expect(result.totalSynced).toBe(100)
  })

  it('fetches a second partial page when total_count is limit + 1 (off-by-one boundary)', async () => {
    const all = Array.from({ length: 101 }, (_, i) => buildFreeeJournal(i + 1, `e-${i + 1}`))
    mockGetJournals.mockImplementation(async (_c, _s, _e, _l, off = 0) => ({
      journals: all.slice(off, off + 100),
      meta: { total_count: 101 },
    }))

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).toHaveBeenCalledTimes(2)
    expect(mockGetJournals.mock.calls.map((c) => c[4])).toEqual([0, 100])
    expect(result.totalSynced).toBe(101)
  })

  it('handles an empty journals array as a safe no-op', async () => {
    mockGetJournals.mockResolvedValue({ journals: [], meta: { total_count: 0 } })

    const result = await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).not.toHaveBeenCalled()
    expect(result.totalSynced).toBe(0)
    expect(result.newJournals).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('treats a missing journals property as empty (fail-safe)', async () => {
    mockGetJournals.mockResolvedValue({ meta: { total_count: 0 } })

    const result = await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).not.toHaveBeenCalled()
    expect(result.totalSynced).toBe(0)
    expect(result.errors).toBe(0)
  })

  it('skips a company that has no freeeCompanyId configured', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ freeeCompanyId: null } as never)
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'x')],
      meta: { total_count: 1 },
    })

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).not.toHaveBeenCalled()
    expect(result.totalSynced).toBe(0)
  })

  it('skips a company whose stored API key has no encryptedKey', async () => {
    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({ encryptedKey: null } as never)

    const result = await syncJournals({ companyId: 'company-1' })

    expect(mockGetJournals).not.toHaveBeenCalled()
    expect(prisma.company.findUnique).not.toHaveBeenCalled()
    expect(result.totalSynced).toBe(0)
  })

  it('iterates every company when no companyId is supplied', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: 'c-a' }, { id: 'c-b' }] as never)
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'a')],
      meta: { total_count: 1 },
    })

    const result = await syncJournals()

    expect(prisma.company.findMany).toHaveBeenCalledWith({ select: { id: true } })
    expect(mockGetJournals).toHaveBeenCalledTimes(2)
    expect(result.totalSynced).toBe(2)
  })

  it('audits each successful freee API call with status 200', async () => {
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'x')],
      meta: { total_count: 1 },
    })

    await syncJournals({ companyId: 'company-1' })

    expect(auditLogger.logFreeeApiCall).toHaveBeenCalledTimes(1)
    expect(auditLogger.logFreeeApiCall).toHaveBeenCalledWith(
      '/api/1/journals',
      'GET',
      200,
      expect.any(Number),
      'company-1'
    )
  })

  it('counts the company as errored and still resolves when getJournals rejects (fail-safe)', async () => {
    mockGetJournals.mockRejectedValue(new Error('freee 5xx'))

    const result = await syncJournals({ companyId: 'company-1' })

    expect(result.errors).toBe(1)
    expect(result.totalSynced).toBe(0)
    expect(auditLogger.logFreeeApiCall).not.toHaveBeenCalled()
  })

  it('continues syncing the next company after one company fails (fail-safe)', async () => {
    vi.mocked(prisma.company.findMany).mockResolvedValue([{ id: 'c-bad' }, { id: 'c-ok' }] as never)
    vi.mocked(prisma.company.findUnique)
      .mockResolvedValueOnce({ freeeCompanyId: '111' } as never)
      .mockResolvedValueOnce({ freeeCompanyId: '222' } as never)
    mockGetJournals.mockImplementation(async (cid) => {
      if (cid === 111) throw new Error('freee down for 111')
      return { journals: [buildFreeeJournal(9, 'ok')], meta: { total_count: 1 } }
    })

    const result = await syncJournals()

    expect(mockGetJournals).toHaveBeenCalledTimes(2)
    expect(result.errors).toBe(1)
    expect(result.totalSynced).toBe(1)
    expect(result.newJournals).toBe(1)
  })

  it('notifies on completion with count and date range when journals were synced', async () => {
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'x')],
      meta: { total_count: 1 },
    })

    await syncJournals({
      companyId: 'company-1',
      startDate: '2024-03-01',
      endDate: '2024-03-31',
      notifyOnComplete: true,
    })

    expect(mockNotifier.notifySyncComplete).toHaveBeenCalledTimes(1)
    expect(mockNotifier.notifySyncComplete).toHaveBeenCalledWith(1, {
      start: '2024-03-01',
      end: '2024-03-31',
    })
  })

  it('suppresses the completion notification when nothing was synced', async () => {
    mockGetJournals.mockResolvedValue({ journals: [], meta: { total_count: 0 } })

    await syncJournals({ companyId: 'company-1', notifyOnComplete: true })

    expect(mockNotifier.notifySyncComplete).not.toHaveBeenCalled()
  })

  it('suppresses the completion notification when notifyOnComplete is false', async () => {
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'x')],
      meta: { total_count: 1 },
    })

    await syncJournals({ companyId: 'company-1', notifyOnComplete: false })

    expect(mockNotifier.notifySyncComplete).not.toHaveBeenCalled()
  })

  it('maps a credit-only journal to safe defaults (missing debit detail)', async () => {
    const journal = {
      id: 555,
      issue_date: '2024-05-05',
      description: 'credit only',
      details: [
        {
          entry_side: 'credit',
          account_item_name: '売上',
          amount: 5000,
          vat: 500,
          vat_name: '課税売上',
        },
      ],
    }
    mockGetJournals.mockResolvedValue({ journals: [journal], meta: { total_count: 1 } })

    await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).toHaveBeenCalledTimes(1)
    expect(firstCreate()).toEqual(
      expect.objectContaining({
        companyId: 'company-1',
        freeeJournalId: '555',
        debitAccount: '',
        creditAccount: '売上',
        amount: 0,
        taxAmount: 500,
        taxType: '課税売上',
        description: 'credit only',
        entryDate: new Date('2024-05-05'),
      })
    )
  })

  it('maps a journal with no details and no description to safe defaults', async () => {
    const journal = { id: 666, issue_date: '2024-06-06' }
    mockGetJournals.mockResolvedValue({ journals: [journal], meta: { total_count: 1 } })

    await syncJournals({ companyId: 'company-1' })

    expect(prisma.journal.upsert).toHaveBeenCalledTimes(1)
    expect(firstCreate()).toEqual(
      expect.objectContaining({
        freeeJournalId: '666',
        debitAccount: '',
        creditAccount: '',
        amount: 0,
        taxAmount: 0,
        taxType: null,
        description: '',
        entryDate: new Date('2024-06-06'),
      })
    )
  })

  it('parses freeeCompanyId to a number and forwards the requested date range', async () => {
    mockGetJournals.mockResolvedValue({
      journals: [buildFreeeJournal(1, 'x')],
      meta: { total_count: 1 },
    })

    await syncJournals({
      companyId: 'company-1',
      startDate: '2024-03-01',
      endDate: '2024-03-31',
    })

    expect(mockGetJournals).toHaveBeenCalledWith(123, '2024-03-01', '2024-03-31', 100, 0)
  })
})
