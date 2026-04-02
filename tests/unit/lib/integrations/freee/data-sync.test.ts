import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  syncJournalsToDatabase,
  syncTrialBalanceToDatabase,
  syncAllFinancialData,
} from '@/lib/integrations/freee/data-sync'

const mockGetJournals = vi.fn()
const mockGetTrialBalance = vi.fn()

vi.mock('@/lib/integrations/freee/client', () => ({
  FreeeClient: vi.fn().mockImplementation(function () {
    return {
      getJournals: mockGetJournals,
      getTrialBalance: mockGetTrialBalance,
    }
  }),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    monthlyBalance: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('syncJournalsToDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should sync journals successfully', async () => {
    mockGetJournals.mockResolvedValue({
      data: [
        {
          id: 1,
          issue_date: '2024-01-15',
          description: 'Test journal',
          details: [
            { entry_side: 'debit', account_item_name: 'Cash', amount: 10000, vat: 1000 },
            { entry_side: 'credit', account_item_name: 'Revenue', amount: 10000, vat: null },
          ],
        },
      ],
    })

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 1)

    expect(result.success).toBe(true)
    expect(result.journalsCount).toBe(1)
  })

  it('should return error on failure', async () => {
    mockGetJournals.mockRejectedValue(new Error('API error'))

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('API error')
  })

  it('should handle empty journal response', async () => {
    mockGetJournals.mockResolvedValue({ data: [] })

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 1)

    expect(result.success).toBe(true)
    expect(result.journalsCount).toBe(0)
  })

  it('should handle null journal response', async () => {
    mockGetJournals.mockResolvedValue(null)

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 1)

    expect(result.success).toBe(true)
    expect(result.journalsCount).toBe(0)
  })

  it('should iterate over multiple months', async () => {
    mockGetJournals.mockResolvedValue({
      data: [
        {
          id: 1,
          issue_date: '2024-01-15',
          description: 'Jan entry',
          details: [{ entry_side: 'debit', account_item_name: 'Cash', amount: 5000 }],
        },
      ],
    })

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 3)

    expect(mockGetJournals).toHaveBeenCalledTimes(3)
    expect(result.journalsCount).toBe(3)
  })

  it('should handle non-Error thrown objects', async () => {
    mockGetJournals.mockRejectedValue('string error')

    const result = await syncJournalsToDatabase('company1', 'token', 123, 2024, 1, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

describe('syncTrialBalanceToDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should sync trial balance successfully', async () => {
    mockGetTrialBalance.mockResolvedValue({
      trial_balance: {
        company_id: 123,
        fiscal_year: 2024,
        start_month: 1,
        end_month: 1,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        account_items: [
          {
            account_item_id: 150,
            account_item_name: 'Cash',
            hierarchy_level: 1,
            opening_balance: 100000,
            closing_balance: 110000,
            closing_dr_balance: 110000,
            closing_cr_balance: 0,
          },
          {
            account_item_id: 350,
            account_item_name: 'Accounts Payable',
            hierarchy_level: 1,
            opening_balance: 50000,
            closing_balance: 55000,
            closing_dr_balance: 0,
            closing_cr_balance: 55000,
          },
        ],
      },
    })

    const result = await syncTrialBalanceToDatabase('company1', 'token', 123, 2024, 1)

    expect(result.success).toBe(true)
    expect(result.balancesCount).toBe(2)
  })

  it('should return error when no trial balance data', async () => {
    mockGetTrialBalance.mockResolvedValue(null)

    const result = await syncTrialBalanceToDatabase('company1', 'token', 123, 2024, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('No trial balance data received')
  })

  it('should return error when trial_balance is missing', async () => {
    mockGetTrialBalance.mockResolvedValue({})

    const result = await syncTrialBalanceToDatabase('company1', 'token', 123, 2024, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('No trial balance data received')
  })

  it('should handle API error', async () => {
    mockGetTrialBalance.mockRejectedValue(new Error('Network error'))

    const result = await syncTrialBalanceToDatabase('company1', 'token', 123, 2024, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })

  it('should handle non-Error thrown objects', async () => {
    mockGetTrialBalance.mockRejectedValue({ message: 'custom error' })

    const result = await syncTrialBalanceToDatabase('company1', 'token', 123, 2024, 1)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Unknown error')
  })
})

describe('syncAllFinancialData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should sync both journals and balances', async () => {
    mockGetJournals.mockResolvedValue({
      data: [
        {
          id: 1,
          issue_date: '2024-01-15',
          description: 'Test',
          details: [{ entry_side: 'debit', account_item_name: 'Cash', amount: 1000 }],
        },
      ],
    })
    mockGetTrialBalance.mockResolvedValue({
      trial_balance: {
        company_id: 123,
        fiscal_year: 2024,
        start_month: 1,
        end_month: 1,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        account_items: [
          {
            account_item_id: 100,
            account_item_name: 'Cash',
            hierarchy_level: 1,
            opening_balance: 100000,
            closing_balance: 110000,
            closing_dr_balance: 110000,
            closing_cr_balance: 0,
          },
        ],
      },
    })

    const result = await syncAllFinancialData('company1', 'token', 123, 2024)

    expect(result.journals.success).toBe(true)
    expect(result.balances).toHaveLength(12)
    expect(mockGetJournals).toHaveBeenCalled()
    expect(mockGetTrialBalance).toHaveBeenCalled()
  })

  it('should handle partial failures', async () => {
    mockGetJournals.mockRejectedValue(new Error('Journals failed'))
    mockGetTrialBalance.mockResolvedValue({
      trial_balance: {
        company_id: 123,
        fiscal_year: 2024,
        start_month: 1,
        end_month: 1,
        start_date: '2024-01-01',
        end_date: '2024-01-31',
        account_items: [],
      },
    })

    const result = await syncAllFinancialData('company1', 'token', 123, 2024)

    expect(result.journals.success).toBe(false)
    expect(result.balances).toHaveLength(12)
  })
})
