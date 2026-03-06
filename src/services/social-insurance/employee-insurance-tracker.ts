import { prisma } from '@/lib/db'
import { InsuranceType } from './schedule-manager'

export interface EmployeeInsuranceStatus {
  employeeId: string
  employeeName: string
  hireDate: Date
  terminationDate?: Date
  insuranceType: InsuranceType
  enrollmentStatus: 'enrolled' | 'pending' | 'terminated'
  enrollmentDate?: Date
  terminationDate_processed?: Date
}

export interface InsuranceEnrollmentInput {
  companyId: string
  employeeId: string
  employeeName: string
  insuranceType: InsuranceType
  enrollmentDate: Date
  standardMonthlyRemuneration: number
}

export class EmployeeInsuranceTracker {
  static readonly ENROLLMENT_DEADLINES: Record<InsuranceType, number> = {
    health: 5,
    pension: 5,
    employment: 10,
    work_accident: 0,
    care: 5,
  }

  static async getEmployeeInsuranceStatus(
    companyId: string,
    employeeId?: string
  ): Promise<EmployeeInsuranceStatus[]> {
    const employees = await this.getEmployeeData(companyId)

    if (employeeId) {
      const employee = employees.find((e) => e.id === employeeId)
      if (!employee) return []
      return this.buildInsuranceStatus(employee)
    }

    const allStatuses: EmployeeInsuranceStatus[] = []
    for (const employee of employees) {
      allStatuses.push(...this.buildInsuranceStatus(employee))
    }
    return allStatuses
  }

  private static async getEmployeeData(companyId: string): Promise<any[]> {
    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        description: { contains: '給与' },
      },
      distinct: ['description'],
      select: {
        description: true,
        entryDate: true,
      },
      orderBy: { entryDate: 'desc' },
      take: 100,
    })

    return journals.map((j, index) => ({
      id: `emp-${index}`,
      name: this.extractEmployeeName(j.description),
      hireDate: j.entryDate,
    }))
  }

  private static extractEmployeeName(description: string): string {
    const match = description.match(/給与[：:]\s*(.+)/)
    return match ? match[1].trim() : 'Unknown'
  }

  private static buildInsuranceStatus(employee: any): EmployeeInsuranceStatus[] {
    const types: InsuranceType[] = ['health', 'pension', 'employment', 'care']

    return types.map((type) => ({
      employeeId: employee.id,
      employeeName: employee.name,
      hireDate: employee.hireDate,
      insuranceType: type,
      enrollmentStatus: 'enrolled' as const,
      enrollmentDate: employee.hireDate,
    }))
  }

  static async checkEnrollmentDeadlines(
    companyId: string
  ): Promise<{ employeeId: string; insuranceType: InsuranceType; daysRemaining: number }[]> {
    const statuses = await this.getEmployeeInsuranceStatus(companyId)
    const now = new Date()
    const alerts: { employeeId: string; insuranceType: InsuranceType; daysRemaining: number }[] = []

    for (const status of statuses) {
      if (status.enrollmentStatus === 'pending') {
        const deadline = this.ENROLLMENT_DEADLINES[status.insuranceType]
        const hireDate = new Date(status.hireDate)
        const deadlineDate = new Date(hireDate.getTime() + deadline * 24 * 60 * 60 * 1000)
        const daysRemaining = Math.ceil(
          (deadlineDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        )

        if (daysRemaining <= 5) {
          alerts.push({
            employeeId: status.employeeId,
            insuranceType: status.insuranceType,
            daysRemaining,
          })
        }
      }
    }

    return alerts
  }

  static async calculateTotalInsurancePremium(
    companyId: string,
    month: number,
    year: number
  ): Promise<Record<InsuranceType, number>> {
    const journals = await prisma.journal.findMany({
      where: {
        companyId,
        entryDate: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year, month, 1),
        },
        description: { contains: '給与' },
      },
    })

    const totalSalary = journals.reduce((sum, j) => sum + j.amount, 0)

    const rates = {
      health: 0.1,
      pension: 0.183,
      employment: 0.0155,
      work_accident: 0.003,
      care: 0.018,
    }

    const premiums: Record<InsuranceType, number> = {
      health: totalSalary * rates.health,
      pension: totalSalary * rates.pension,
      employment: totalSalary * rates.employment,
      work_accident: totalSalary * rates.work_accident,
      care: totalSalary * rates.care,
    }

    return premiums
  }
}
