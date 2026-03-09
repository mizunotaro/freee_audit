import { SocialInsuranceSchedule } from '@prisma/client'
import { prisma } from '@/lib/db'

export type InsuranceType = 'health' | 'pension' | 'employment' | 'work_accident' | 'care'
export type ScheduleStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE'

export interface InsuranceTask {
  insuranceType: InsuranceType
  taskName: string
  dueDate: Date
  description?: string
}

export interface CreateScheduleInput {
  companyId: string
  insuranceType: InsuranceType
  taskName: string
  dueDate: Date
  notes?: string
}

export class ScheduleManager {
  static readonly INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
    health: '健康保険',
    pension: '厚生年金保険',
    employment: '雇用保険',
    work_accident: '労災保険',
    care: '介護保険',
  }

  static readonly STANDARD_TASKS: InsuranceTask[] = [
    {
      insuranceType: 'health',
      taskName: '被保険者資格取得届',
      dueDate: new Date(),
      description: '5日以内',
    },
    {
      insuranceType: 'health',
      taskName: '被保険者資格喪失届',
      dueDate: new Date(),
      description: '5日以内',
    },
    {
      insuranceType: 'health',
      taskName: '月額保険料納付',
      dueDate: new Date(),
      description: '翌月末日',
    },
    {
      insuranceType: 'pension',
      taskName: '被保険者資格取得届',
      dueDate: new Date(),
      description: '5日以内',
    },
    {
      insuranceType: 'pension',
      taskName: '被保険者資格喪失届',
      dueDate: new Date(),
      description: '5日以内',
    },
    {
      insuranceType: 'pension',
      taskName: '月額保険料納付',
      dueDate: new Date(),
      description: '翌月末日',
    },
    {
      insuranceType: 'employment',
      taskName: '被保険者資格取得届',
      dueDate: new Date(),
      description: '10日以内',
    },
    {
      insuranceType: 'employment',
      taskName: '被保険者資格喪失届',
      dueDate: new Date(),
      description: '10日以内',
    },
    {
      insuranceType: 'employment',
      taskName: '月額保険料納付',
      dueDate: new Date(),
      description: '翌月末日',
    },
    {
      insuranceType: 'work_accident',
      taskName: '確定保険料申告・納付',
      dueDate: new Date(),
      description: '7/10まで',
    },
    {
      insuranceType: 'work_accident',
      taskName: '概算保険料申告・納付',
      dueDate: new Date(),
      description: '4/1〜5/31',
    },
    {
      insuranceType: 'care',
      taskName: '月額保険料納付',
      dueDate: new Date(),
      description: '健康保険と一括',
    },
  ]

  static async getSchedules(
    companyId: string,
    filters?: { insuranceType?: InsuranceType; status?: ScheduleStatus }
  ): Promise<SocialInsuranceSchedule[]> {
    const where: any = { companyId }
    if (filters?.insuranceType) {
      where.insuranceType = filters.insuranceType
    }
    if (filters?.status) {
      where.status = filters.status
    }
    return prisma.socialInsuranceSchedule.findMany({
      where,
      orderBy: { dueDate: 'asc' },
    })
  }

  static async getUpcomingSchedules(
    companyId: string,
    days: number = 30
  ): Promise<SocialInsuranceSchedule[]> {
    const now = new Date()
    const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    return prisma.socialInsuranceSchedule.findMany({
      where: {
        companyId,
        dueDate: { gte: now, lte: futureDate },
        status: 'PENDING',
      },
      orderBy: { dueDate: 'asc' },
    })
  }

  static async createSchedule(data: CreateScheduleInput): Promise<SocialInsuranceSchedule> {
    return prisma.socialInsuranceSchedule.create({
      data: {
        companyId: data.companyId,
        insuranceType: data.insuranceType,
        taskName: data.taskName,
        dueDate: data.dueDate,
        notes: data.notes,
        status: 'PENDING',
      },
    })
  }

  static async completeSchedule(id: string): Promise<SocialInsuranceSchedule> {
    return prisma.socialInsuranceSchedule.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedDate: new Date(),
      },
    })
  }

  static async deleteSchedule(id: string): Promise<SocialInsuranceSchedule> {
    return prisma.socialInsuranceSchedule.delete({
      where: { id },
    })
  }

  static async generateYearlySchedules(
    companyId: string,
    year: number
  ): Promise<SocialInsuranceSchedule[]> {
    const schedules: CreateScheduleInput[] = []

    for (let month = 1; month <= 12; month++) {
      const dueDate = new Date(year, month, 0)
      schedules.push({
        companyId,
        insuranceType: 'health',
        taskName: `${month}月分保険料納付`,
        dueDate,
        notes: '健康保険・厚生年金保険・介護保険一括納付',
      })
    }

    schedules.push({
      companyId,
      insuranceType: 'work_accident',
      taskName: '確定保険料申告・納付',
      dueDate: new Date(year, 6, 10),
      notes: '7月10日まで',
    })

    schedules.push({
      companyId,
      insuranceType: 'work_accident',
      taskName: '概算保険料申告・納付',
      dueDate: new Date(year, 3, 30),
      notes: '4月1日〜5月31日',
    })

    return Promise.all(schedules.map((s) => this.createSchedule(s)))
  }

  static async checkOverdueSchedules(companyId: string): Promise<SocialInsuranceSchedule[]> {
    const now = new Date()
    const overdue = await prisma.socialInsuranceSchedule.findMany({
      where: {
        companyId,
        dueDate: { lt: now },
        status: 'PENDING',
      },
    })

    await Promise.all(
      overdue.map((schedule) =>
        prisma.socialInsuranceSchedule.update({
          where: { id: schedule.id },
          data: { status: 'OVERDUE' },
        })
      )
    )

    return overdue
  }
}
