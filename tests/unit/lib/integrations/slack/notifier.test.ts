import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditNotifier, createAuditNotifier } from '@/lib/integrations/slack/notifier'
import type { AuditSummary, ValidationIssue } from '@/types/audit'

describe('AuditNotifier', () => {
  let notifier: AuditNotifier
  let mockSendMessage: ReturnType<typeof vi.fn>
  let mockSendError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockSendMessage = vi.fn().mockResolvedValue(true)
    mockSendError = vi.fn().mockResolvedValue(true)

    const mockSlackClient = {
      sendMessage: mockSendMessage,
      sendError: mockSendError,
    }

    notifier = new AuditNotifier(mockSlackClient as unknown as undefined)
    vi.clearAllMocks()
  })

  describe('notifyAuditComplete', () => {
    const mockIssue: ValidationIssue = {
      field: 'amount',
      severity: 'warning',
      message: '金額が不一致です',
      messageEn: 'Amount mismatch',
    }

    const mockSummary: AuditSummary = {
      date: '2024-01-15',
      totalCount: 100,
      passedCount: 95,
      failedCount: 5,
      skippedCount: 0,
      errorCount: 0,
      issues: [
        {
          journalId: 'journal-1',
          description: 'Test journal',
          issues: [mockIssue],
        },
      ],
    }

    it('should send audit complete notification', async () => {
      const result = await notifier.notifyAuditComplete(mockSummary)

      expect(result).toBe(true)
      expect(mockSendMessage).toHaveBeenCalled()
    })

    it('should include success emoji for all passed', async () => {
      const successSummary: AuditSummary = {
        ...mockSummary,
        failedCount: 0,
      }

      await notifier.notifyAuditComplete(successSummary)

      const call = mockSendMessage.mock.calls[0]
      expect(call[0]).toContain('white_check_mark')
    })

    it('should include warning emoji for failures', async () => {
      await notifier.notifyAuditComplete(mockSummary)

      const call = mockSendMessage.mock.calls[0]
      expect(call[0]).toContain('warning')
    })

    it('should include issue details in notification', async () => {
      await notifier.notifyAuditComplete(mockSummary)

      const call = mockSendMessage.mock.calls[0]
      const blocks = call[1] as unknown[]
      expect(blocks.length).toBeGreaterThan(0)
    })

    it('should handle errors in summary', async () => {
      const errorSummary: AuditSummary = {
        ...mockSummary,
        errorCount: 2,
      }

      await notifier.notifyAuditComplete(errorSummary)

      const call = mockSendMessage.mock.calls[0]
      const blocks = call[1] as unknown[]
      expect(blocks.some((b: unknown) => JSON.stringify(b).includes('エラー'))).toBe(true)
    })

    it('should limit issues displayed to 5', async () => {
      const manyIssuesSummary: AuditSummary = {
        ...mockSummary,
        issues: Array(10)
          .fill(null)
          .map((_, i) => ({
            journalId: `journal-${i}`,
            description: `Test journal ${i}`,
            issues: [
              {
                field: 'test',
                message: `Issue ${i}`,
                severity: 'warning' as const,
                messageEn: `Issue ${i}`,
              },
            ],
          })),
      }

      await notifier.notifyAuditComplete(manyIssuesSummary)

      const call = mockSendMessage.mock.calls[0]
      const blocks = call[1] as unknown[]
      const issuesBlock = blocks.find((b: unknown) => JSON.stringify(b).includes('要確認項目'))
      expect(issuesBlock).toBeDefined()
    })
  })

  describe('notifyAuditError', () => {
    it('should send error notification', async () => {
      const error = new Error('Test error')
      const result = await notifier.notifyAuditError(error)

      expect(result).toBe(true)
      expect(mockSendError).toHaveBeenCalledWith('監査処理エラー / Audit Process Error', error)
    })

    it('should include context in error notification', async () => {
      const error = new Error('Test error')
      await notifier.notifyAuditError(error, 'Processing journals')

      expect(mockSendError).toHaveBeenCalledWith('監査処理エラー: Processing journals', error)
    })
  })

  describe('notifySyncComplete', () => {
    it('should send sync complete notification', async () => {
      const result = await notifier.notifySyncComplete(50, {
        start: '2024-01-01',
        end: '2024-01-31',
      })

      expect(result).toBe(true)
      expect(mockSendMessage).toHaveBeenCalled()
    })

    it('should include sync count in notification', async () => {
      await notifier.notifySyncComplete(100, {
        start: '2024-01-01',
        end: '2024-01-31',
      })

      const call = mockSendMessage.mock.calls[0]
      expect(call[0]).toContain('100')
    })

    it('should include date range in notification', async () => {
      await notifier.notifySyncComplete(50, {
        start: '2024-01-01',
        end: '2024-01-31',
      })

      const call = mockSendMessage.mock.calls[0]
      const blocks = call[1] as unknown[]
      expect(
        blocks.some(
          (b: unknown) =>
            JSON.stringify(b).includes('2024-01-01') && JSON.stringify(b).includes('2024-01-31')
        )
      ).toBe(true)
    })
  })
})

describe('createAuditNotifier', () => {
  it('should create notifier with provided client', () => {
    const mockSendMessage = vi.fn()
    const mockSendError = vi.fn()
    const mockClient = {
      sendMessage: mockSendMessage,
      sendError: mockSendError,
    }
    const notifier = createAuditNotifier(mockClient as unknown as undefined)

    expect(notifier).toBeInstanceOf(AuditNotifier)
  })
})
