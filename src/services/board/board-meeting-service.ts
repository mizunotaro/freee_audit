import { PrismaClient, BoardMeeting, AgendaItem } from '@prisma/client'

const prisma = new PrismaClient()

export type MeetingType = 'regular' | 'extraordinary'
export type DecisionType = 'resolution' | 'report' | 'discussion'
export type MeetingStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'
export type ResolutionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface CreateBoardMeetingInput {
  companyId: string
  meetingDate: Date
  meetingType: MeetingType
  minutes?: string
}

export interface UpdateBoardMeetingInput {
  meetingDate?: Date
  meetingType?: MeetingType
  minutes?: string
  status?: MeetingStatus
}

export interface CreateAgendaItemInput {
  boardMeetingId: string
  title: string
  description?: string
  category: string
  decisionType: DecisionType
  requiredByLaw?: boolean
  legalBasis?: string
}

export interface UpdateAgendaItemInput {
  title?: string
  description?: string
  category?: string
  decisionType?: DecisionType
  requiredByLaw?: boolean
  legalBasis?: string
  aiAnalysis?: string
  resolution?: string
  resolutionStatus?: ResolutionStatus
}

export class BoardMeetingService {
  static async getBoardMeetings(companyId: string): Promise<BoardMeeting[]> {
    return prisma.boardMeeting.findMany({
      where: { companyId },
      include: { agendaItems: true },
      orderBy: { meetingDate: 'desc' },
    })
  }

  static async getBoardMeetingById(id: string): Promise<BoardMeeting | null> {
    return prisma.boardMeeting.findUnique({
      where: { id },
      include: { agendaItems: true },
    })
  }

  static async createBoardMeeting(data: CreateBoardMeetingInput): Promise<BoardMeeting> {
    return prisma.boardMeeting.create({
      data: {
        companyId: data.companyId,
        meetingDate: data.meetingDate,
        meetingType: data.meetingType,
        minutes: data.minutes,
      },
    })
  }

  static async updateBoardMeeting(
    id: string,
    data: UpdateBoardMeetingInput
  ): Promise<BoardMeeting> {
    return prisma.boardMeeting.update({
      where: { id },
      data,
    })
  }

  static async deleteBoardMeeting(id: string): Promise<BoardMeeting> {
    return prisma.boardMeeting.delete({
      where: { id },
    })
  }

  static async createAgendaItem(data: CreateAgendaItemInput): Promise<AgendaItem> {
    return prisma.agendaItem.create({
      data: {
        boardMeetingId: data.boardMeetingId,
        title: data.title,
        description: data.description,
        category: data.category,
        decisionType: data.decisionType,
        requiredByLaw: data.requiredByLaw ?? false,
        legalBasis: data.legalBasis,
      },
    })
  }

  static async updateAgendaItem(id: string, data: UpdateAgendaItemInput): Promise<AgendaItem> {
    return prisma.agendaItem.update({
      where: { id },
      data,
    })
  }

  static async deleteAgendaItem(id: string): Promise<AgendaItem> {
    return prisma.agendaItem.delete({
      where: { id },
    })
  }

  static async generateDefaultAgendaItems(
    boardMeetingId: string,
    fiscalYear: number
  ): Promise<AgendaItem[]> {
    const defaultItems: CreateAgendaItemInput[] = [
      {
        boardMeetingId,
        title: '決算報告の承認',
        description: `${fiscalYear}年度の決算報告について`,
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第436条',
      },
      {
        boardMeetingId,
        title: '事業報告の承認',
        description: `${fiscalYear}年度の事業報告について`,
        category: 'business',
        decisionType: 'resolution',
        requiredByLaw: true,
        legalBasis: '会社法第435条',
      },
      {
        boardMeetingId,
        title: '配当金の支払に関する決議',
        description: `${fiscalYear}年度の配当金の支払について`,
        category: 'financial',
        decisionType: 'resolution',
        requiredByLaw: false,
        legalBasis: '会社法第459条',
      },
      {
        boardMeetingId,
        title: '役員報酬の決定',
        description: '役員の報酬額について',
        category: 'governance',
        decisionType: 'resolution',
        requiredByLaw: false,
        legalBasis: '会社法第361条',
      },
      {
        boardMeetingId,
        title: '監査役の監査報告',
        description: `${fiscalYear}年度の監査報告について`,
        category: 'audit',
        decisionType: 'report',
        requiredByLaw: true,
        legalBasis: '会社法第381条',
      },
    ]

    return Promise.all(defaultItems.map((item) => this.createAgendaItem(item)))
  }

  static async analyzeAgendaItemWithAI(
    agendaItemId: string,
    companyInfo: {
      name: string
      fiscalYearEnd: number
      hasInvestors: boolean
      investmentAgreement?: string
    }
  ): Promise<string> {
    const agendaItem = await prisma.agendaItem.findUnique({
      where: { id: agendaItemId },
      include: { boardMeeting: true },
    })

    if (!agendaItem) {
      throw new Error('Agenda item not found')
    }

    const analysis = this.generateBasicAnalysis(agendaItem, companyInfo)

    await prisma.agendaItem.update({
      where: { id: agendaItemId },
      data: { aiAnalysis: analysis },
    })

    return analysis
  }

  private static generateBasicAnalysis(
    agendaItem: AgendaItem,
    companyInfo: { name: string; fiscalYearEnd: number; hasInvestors: boolean }
  ): string {
    let analysis = `## ${agendaItem.title} の分析\n\n`
    analysis += `**法的要件**: ${agendaItem.requiredByLaw ? '必要' : '任意'}\n`

    if (agendaItem.legalBasis) {
      analysis += `**法的根拠**: ${agendaItem.legalBasis}\n`
    }

    analysis += `\n**決議種別**: `
    switch (agendaItem.decisionType) {
      case 'resolution':
        analysis += '決議事項（取締役会の承認が必要）\n'
        break
      case 'report':
        analysis += '報告事項（承認は不要だが、報告が義務付けられている場合がある）\n'
        break
      case 'discussion':
        analysis += '協議事項（意思決定のための議論）\n'
        break
    }

    if (companyInfo.hasInvestors && agendaItem.category === 'financial') {
      analysis += `\n**投資家への影響**: この議題は投資家（株主）の権利に影響を与える可能性があります。`
      if (companyInfo.investmentAgreement) {
        analysis += `出資契約書の条項を確認し、投資家の同意が必要か検討してください。`
      }
    }

    analysis += `\n**推奨アクション**:\n`
    analysis += `- 議事録に決議内容を明確に記録する\n`
    analysis += `- 必要に応じて事前に資料を配布する\n`
    if (agendaItem.requiredByLaw) {
      analysis += `- 法的期限を守って手続きを進める\n`
    }

    return analysis
  }
}
