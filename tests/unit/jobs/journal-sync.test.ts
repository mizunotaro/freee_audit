import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { syncJournals } from '@/jobs/journal-sync'
import { prisma } from '@/lib/db'
import { createFreeeClient } from '@/lib/integrations/freee/client'
import { createAuditNotifier } from '@/lib/integrations/slack/notifier'

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
