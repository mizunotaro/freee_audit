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

describe('BoardMeetingService', () => {
  const mockCompanyId = 'test-company-id'
  const mockMeetingId = 'meeting-1'
  const mockAgendaItemId = 'agenda-1'

  let mockPrisma: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = new PrismaClient()
  })

  describe('getBoardMeetings', () => {
    it('should retrieve all board meetings for a company', async () => {
      const mockMeetings = [
        {
          id: 'meeting-1',
          companyId: mockCompanyId,
          meetingDate: new Date('2024-06-30'),
          meetingType: 'regular',
          minutes: null,
          status: 'COMPLETED',
          agendaItems: [],
        },
        {
          id: 'meeting-2',
          companyId: mockCompanyId,
          meetingDate: new Date('2024-05-31'),
          meetingType: 'extraordinary',
          minutes: 'Meeting minutes...',
          status: 'COMPLETED',
          agendaItems: [],
        },
      ]

      mockPrisma.boardMeeting.findMany.mockResolvedValue(mockMeetings)

      const result = await BoardMeetingService.getBoardMeetings(mockCompanyId)

      expect(result).toHaveLength(2)
      expect(result[0].meetingType).toBe('regular')
      expect(result[1].meetingType).toBe('extraordinary')
    })

    it('should return empty array when no meetings exist', async () => {
      mockPrisma.boardMeeting.findMany.mockResolvedValue([])

      const result = await BoardMeetingService.getBoardMeetings(mockCompanyId)

      expect(result).toEqual([])
    })
  })

  describe('getBoardMeetingById', () => {
    it('should retrieve single board meeting by ID', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: 'Test minutes',
        status: 'COMPLETED',
        agendaItems: [
          {
            id: 'agenda-1',
            title: '決算報告の承認',
            description: '2024年度の決算報告について',
            category: 'financial',
            decisionType: 'resolution',
            requiredByLaw: true,
            legalBasis: '会社法第436条',
          },
        ],
      }

      mockPrisma.boardMeeting.findUnique.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.getBoardMeetingById(mockMeetingId)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(mockMeetingId)
    })

    it('should return null when meeting not found', async () => {
      mockPrisma.boardMeeting.findUnique.mockResolvedValue(null)

      const result = await BoardMeetingService.getBoardMeetingById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createBoardMeeting', () => {
    it('should create regular board meeting', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: null,
        status: 'SCHEDULED',
      }

      mockPrisma.boardMeeting.create.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.createBoardMeeting({
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
      })

      expect(result.meetingType).toBe('regular')
    })

    it('should create extraordinary board meeting', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-15'),
        meetingType: 'extraordinary',
        minutes: 'Emergency meeting',
        status: 'SCHEDULED',
      }

      mockPrisma.boardMeeting.create.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.createBoardMeeting({
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-15'),
        meetingType: 'extraordinary',
        minutes: 'Emergency meeting',
      })

      expect(result.meetingType).toBe('extraordinary')
      expect(result.minutes).toBe('Emergency meeting')
    })
  })

  describe('updateBoardMeeting', () => {
    it('should update meeting date', async () => {
      const newDate = new Date('2024-07-15')
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: newDate,
        meetingType: 'regular',
        minutes: null,
        status: 'SCHEDULED',
      }

      mockPrisma.boardMeeting.update.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.updateBoardMeeting(mockMeetingId, {
        meetingDate: newDate,
      })

      expect(result.meetingDate).toEqual(newDate)
    })

    it('should update meeting status', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: null,
        status: 'IN_PROGRESS',
      }

      mockPrisma.boardMeeting.update.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.updateBoardMeeting(mockMeetingId, {
        status: 'IN_PROGRESS',
      })

      expect(result.status).toBe('IN_PROGRESS')
    })

    it('should update meeting minutes', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: 'Updated meeting minutes...',
        status: 'COMPLETED',
      }

      mockPrisma.boardMeeting.update.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.updateBoardMeeting(mockMeetingId, {
        minutes: 'Updated meeting minutes...',
        status: 'COMPLETED',
      })

      expect(result.minutes).toBe('Updated meeting minutes...')
    })
  })

  describe('deleteBoardMeeting', () => {
    it('should delete board meeting', async () => {
      const mockMeeting = {
        id: mockMeetingId,
        companyId: mockCompanyId,
        meetingDate: new Date('2024-06-30'),
        meetingType: 'regular',
        minutes: null,
        status: 'SCHEDULED',
      }

      mockPrisma.boardMeeting.delete.mockResolvedValue(mockMeeting)

      const result = await BoardMeetingService.deleteBoardMeeting(mockMeetingId)

      expect(result.id).toBe(mockMeetingId)
    })
  })

  describe('createAgendaItem', () => {
    it('should create agenda item with all fields', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '決算報告の承認',
        description: '2024年度の決算報告について',
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
        aiAnalysis: null,
        resolution: null,
        resolutionStatus: 'PENDING',
      }

      mockPrisma.agendaItem.create.mockResolvedValue(mockAgendaItem)

      const result = await BoardMeetingService.createAgendaItem({
        boardMeetingId: mockMeetingId,
        title: '決算報告の承認',
        description: '2024年度の決算報告について',
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
      })

      expect(result.title).toBe('決算報告の承認')
      expect(result.requiredByLaw).toBe(true)
      expect(result.legalBasis).toBe('会社法第436条')
    })

    it('should default requiredByLaw to false', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '自由議題',
        description: null,
        category: 'discussion',
        decisionType: 'discussion',
        requiredByLaw: false,
        legalBasis: null,
        aiAnalysis: null,
        resolution: null,
        resolutionStatus: null,
      }

      mockPrisma.agendaItem.create.mockResolvedValue(mockAgendaItem)

      const result = await BoardMeetingService.createAgendaItem({
        boardMeetingId: mockMeetingId,
        title: '自由議題',
        category: 'discussion',
        decisionType: 'discussion',
      })

      expect(result.requiredByLaw).toBe(false)
    })
  })

  describe('updateAgendaItem', () => {
    it('should update agenda item', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '更新された議題',
        description: 'Updated description',
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
        aiAnalysis: 'AI analysis text',
        resolution: 'Approved',
        resolutionStatus: 'APPROVED',
      }

      mockPrisma.agendaItem.update.mockResolvedValue(mockAgendaItem)

      const result = await BoardMeetingService.updateAgendaItem(mockAgendaItemId, {
        title: '更新された議題',
        resolution: 'Approved',
        resolutionStatus: 'APPROVED',
      })

      expect(result.title).toBe('更新された議題')
      expect(result.resolution).toBe('Approved')
      expect(result.resolutionStatus).toBe('APPROVED')
    })

    it('should update AI analysis', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: 'Test Agenda',
        description: null,
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
        aiAnalysis: 'New AI analysis content',
        resolution: null,
        resolutionStatus: 'PENDING',
      }

      mockPrisma.agendaItem.update.mockResolvedValue(mockAgendaItem)

      const result = await BoardMeetingService.updateAgendaItem(mockAgendaItemId, {
        aiAnalysis: 'New AI analysis content',
      })

      expect(result.aiAnalysis).toBe('New AI analysis content')
    })
  })

  describe('generateDefaultAgendaItems', () => {
    it('should generate default agenda items for fiscal year', async () => {
      mockPrisma.agendaItem.create.mockResolvedValue({ id: 'agenda-1' } as any)

      const result = await BoardMeetingService.generateDefaultAgendaItems(mockMeetingId, 2024)

      expect(result).toHaveLength(5)
      expect(mockPrisma.agendaItem.create).toHaveBeenCalledTimes(5)
    })

    it('should include legally required items', async () => {
      mockPrisma.agendaItem.create.mockResolvedValue({} as any)

      await BoardMeetingService.generateDefaultAgendaItems(mockMeetingId, 2024)

      const calls = mockPrisma.agendaItem.create.mock.calls
      const requiredItems = calls.filter((call: any[]) => call[0].data.requiredByLaw === true)

      expect(requiredItems.length).toBeGreaterThan(0)
    })
  })

  describe('analyzeAgendaItemWithAI', () => {
    it('should analyze agenda item and save AI analysis', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '決算報告の承認',
        description: '2024年度の決算報告について',
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
        boardMeeting: {
          id: mockMeetingId,
          companyId: mockCompanyId,
          meetingDate: new Date('2024-06-30'),
          meetingType: 'regular',
          minutes: null,
          status: 'SCHEDULED',
        },
      }

      mockPrisma.agendaItem.findUnique.mockResolvedValue(mockAgendaItem)
      mockPrisma.agendaItem.update.mockResolvedValue(mockAgendaItem)

      const companyInfo = {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: true,
        investmentAgreement: 'Series A Agreement',
      }

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(
        mockAgendaItemId,
        companyInfo
      )

      expect(result).toContain('決算報告の承認')
      expect(result).toContain('法的要件')
      expect(result).toContain('会社法第436条')
    })

    it('should throw error when agenda item not found', async () => {
      mockPrisma.agendaItem.findUnique.mockResolvedValue(null)

      const companyInfo = {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: false,
      }

      await expect(
        BoardMeetingService.analyzeAgendaItemWithAI(mockAgendaItemId, companyInfo)
      ).rejects.toThrow('Agenda item not found')
    })

    it('should include investor considerations when applicable', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '配当金の支払に関する決議',
        description: '2024年度の配当金の支払について',
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: false,
        legalBasis: '会社法第459条',
        boardMeeting: {
          id: mockMeetingId,
          companyId: mockCompanyId,
          meetingDate: new Date('2024-06-30'),
          meetingType: 'regular',
          minutes: null,
          status: 'SCHEDULED',
        },
      }

      mockPrisma.agendaItem.findUnique.mockResolvedValue(mockAgendaItem)
      mockPrisma.agendaItem.update.mockResolvedValue(mockAgendaItem)

      const companyInfo = {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: true,
        investmentAgreement: 'Series A Agreement',
      }

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(
        mockAgendaItemId,
        companyInfo
      )

      expect(result).toContain('投資家')
    })

    it('should handle report type agenda items', async () => {
      const mockAgendaItem = {
        id: mockAgendaItemId,
        boardMeetingId: mockMeetingId,
        title: '監査役の監査報告',
        description: '2024年度の監査報告について',
        category: 'audit',
        decisionType: 'report',
        requiredByLaw: true,
        legalBasis: '会社法第381条',
        boardMeeting: {
          id: mockMeetingId,
          companyId: mockCompanyId,
          meetingDate: new Date('2024-06-30'),
          meetingType: 'regular',
          minutes: null,
          status: 'SCHEDULED',
        },
      }

      mockPrisma.agendaItem.findUnique.mockResolvedValue(mockAgendaItem)
      mockPrisma.agendaItem.update.mockResolvedValue(mockAgendaItem)

      const companyInfo = {
        name: 'Test Company',
        fiscalYearEnd: 2024,
        hasInvestors: false,
      }

      const result = await BoardMeetingService.analyzeAgendaItemWithAI(
        mockAgendaItemId,
        companyInfo
      )

      expect(result).toContain('報告事項')
    })
  })
})
