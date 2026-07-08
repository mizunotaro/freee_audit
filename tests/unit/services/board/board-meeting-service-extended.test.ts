import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@prisma/client', () => {
  const mockPrisma = {
    boardMeeting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    agendaItem: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }

  return {
    PrismaClient: vi.fn(function () {
      return mockPrisma
    }),
  }
})

import { BoardMeetingService } from '@/services/board/board-meeting-service'
import { PrismaClient } from '@prisma/client'

describe('BoardMeetingServiceExtended', () => {
  const mockAgendaItemId = 'agenda-1'

  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = new PrismaClient()
  })

  describe('deleteAgendaItem', () => {
    it('should delete the agenda item by id and return it', async () => {
      const deleted = {
        id: mockAgendaItemId,
        boardMeetingId: 'meeting-1',
        title: '不要議題',
        category: 'discussion',
        decisionType: 'discussion',
      }
      mockPrisma.agendaItem.delete.mockResolvedValue(deleted)

      const result = await BoardMeetingService.deleteAgendaItem(mockAgendaItemId)

      expect(mockPrisma.agendaItem.delete).toHaveBeenCalledWith({ where: { id: mockAgendaItemId } })
      expect(result).toEqual(deleted)
    })
  })

  describe('analyzeAgendaItemWithAI — decisionType variants', () => {
    const baseAgenda = (overrides: Record<string, unknown> = {}) => ({
      id: mockAgendaItemId,
      boardMeetingId: 'meeting-1',
      title: '新規事業の方向性協議',
      description: '次年度の事業戦略について',
      category: 'discussion',
      decisionType: 'discussion',
      requiredByLaw: false,
      legalBasis: null,
      boardMeeting: {
        id: 'meeting-1',
        companyId: 'company-1',
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: null,
        status: 'SCHEDULED',
      },
      ...overrides,
    })

    it('should render discussion-type guidance for a discussion agenda item', async () => {
      mockPrisma.agendaItem.findUnique.mockResolvedValue(baseAgenda())
      mockPrisma.agendaItem.update.mockResolvedValue({})

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(mockAgendaItemId, {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: false,
      })

      // discussion 分岐（resolution / report は既存テストで網羅済み）
      expect(result).toContain('協議事項')
      expect(mockPrisma.agendaItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockAgendaItemId },
          data: expect.objectContaining({ aiAnalysis: result }),
        })
      )
    })

    it('should omit the legal-deadline action when the item is not required by law', async () => {
      mockPrisma.agendaItem.findUnique.mockResolvedValue(baseAgenda({ requiredByLaw: false }))
      mockPrisma.agendaItem.update.mockResolvedValue({})

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(mockAgendaItemId, {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: false,
      })

      expect(result).not.toContain('法的期限を守って')
    })

    it('should note investor impact without agreement clause when investors lack an agreement', async () => {
      // hasInvestors && category=financial を満たしつつ investmentAgreement 未設定 ->
      // 出資契約書の確認案内は出力されない（line 230 の false 分岐）
      mockPrisma.agendaItem.findUnique.mockResolvedValue(
        baseAgenda({
          title: '配当金の支払に関する決議',
          category: 'financial',
          decisionType: 'resolution',
          legalBasis: '会社法第459条',
        })
      )
      mockPrisma.agendaItem.update.mockResolvedValue({})

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(mockAgendaItemId, {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: true,
      })

      expect(result).toContain('投資家')
      expect(result).not.toContain('出資契約書')
    })
  })
})
