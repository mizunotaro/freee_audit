import {
  success,
  failure,
  createAppError,
  tryCatch,
  type Result,
  type AppError,
} from '@/types/result'

export interface FreeeHRConfig {
  accessToken: string
  companyId: number
}

export interface FreeeEmployee {
  id: number
  num: string | null
  displayName: string
  entryDate: string | null
  retireDate: string | null
  birthDate: string | null
  gender: string | null
  email: string | null
  department: string | null
  position: string | null
}

export interface EmployeeSummary {
  totalCount: number
  activeCount: number
  averageAge: number | null
  averageTenureMonths: number | null
  genderDistribution: Record<string, number>
  departmentDistribution: Record<string, number>
}

export interface AttendanceSummary {
  employeeId: number
  employeeName: string
  year: number
  month: number
  totalWorkingDays: number
  totalWorkingHours: number
  totalOvertimeHours: number
  paidLeaveDays: number
  absentDays: number
}

interface WorkRecordSummaryResponse {
  year: number
  month: number
  work_days: number
  total_work_mins: number
  total_overtime_mins: number
  total_holiday_work_mins: number
  total_latenight_work_mins: number
  total_paid_holiday: number
  total_absence_days: number
}

function calculateAge(birthDate: string, referenceDate: Date = new Date()): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return null
  const age = referenceDate.getFullYear() - birth.getFullYear()
  const monthDiff = referenceDate.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < birth.getDate())) {
    return age - 1
  }
  return age
}

function calculateTenureMonths(entryDate: string, referenceDate: Date = new Date()): number | null {
  if (!entryDate) return null
  const entry = new Date(entryDate)
  if (isNaN(entry.getTime())) return null
  const years = referenceDate.getFullYear() - entry.getFullYear()
  const months = referenceDate.getMonth() - entry.getMonth()
  return years * 12 + months
}

export async function fetchEmployees(
  config: FreeeHRConfig
): Promise<Result<FreeeEmployee[], AppError>> {
  return tryCatch(async () => {
    const response = await fetch(
      `https://api.freee.co.jp/hr/api/v1/employees?company_id=${config.companyId}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`freee HR API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { employees?: Array<Record<string, unknown>> }
    const employees = (data.employees ?? []).map(
      (e): FreeeEmployee => ({
        id: Number(e.id),
        num: (e.num as string) ?? null,
        displayName: (e.display_name as string) ?? '',
        entryDate: (e.entry_date as string) ?? null,
        retireDate: (e.retire_date as string) ?? null,
        birthDate: (e.birth_date as string) ?? null,
        gender: (e.gender as string) ?? null,
        email: (e.email as string) ?? null,
        department: null,
        position: null,
      })
    )

    return employees
  }, 'EXTERNAL_SERVICE_ERROR')
}

export function computeEmployeeSummary(
  employees: FreeeEmployee[],
  referenceDate: Date = new Date()
): Result<EmployeeSummary, AppError> {
  if (!employees || employees.length === 0) {
    return failure(createAppError('VALIDATION_ERROR', '従業員データが空です'))
  }

  const active = employees.filter((e) => !e.retireDate)
  const ages = active
    .map((e) => (e.birthDate ? calculateAge(e.birthDate, referenceDate) : null))
    .filter((a): a is number => a !== null)

  const tenures = active
    .map((e) => (e.entryDate ? calculateTenureMonths(e.entryDate, referenceDate) : null))
    .filter((t): t is number => t !== null)

  const genderDist: Record<string, number> = {}
  for (const e of active) {
    const gender = e.gender ?? 'unknown'
    genderDist[gender] = (genderDist[gender] ?? 0) + 1
  }

  const deptDist: Record<string, number> = {}
  for (const e of active) {
    const dept = e.department ?? 'unknown'
    deptDist[dept] = (deptDist[dept] ?? 0) + 1
  }

  return success({
    totalCount: employees.length,
    activeCount: active.length,
    averageAge:
      ages.length > 0
        ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10
        : null,
    averageTenureMonths:
      tenures.length > 0 ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null,
    genderDistribution: genderDist,
    departmentDistribution: deptDist,
  })
}

export async function fetchAttendanceSummary(options: {
  config: FreeeHRConfig
  employeeId: number
  year: number
  month: number
}): Promise<Result<AttendanceSummary, AppError>> {
  const { config, employeeId, year, month } = options
  return tryCatch(async () => {
    const response = await fetch(
      `https://api.freee.co.jp/hr/api/v1/employees/${employeeId}/work_record_summaries/${year}/${month}?company_id=${config.companyId}`,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`freee HR attendance API error: ${response.status}`)
    }

    const data = (await response.json()) as WorkRecordSummaryResponse

    return {
      employeeId,
      employeeName: '',
      year: data.year,
      month: data.month,
      totalWorkingDays: data.work_days ?? 0,
      totalWorkingHours: Math.round(((data.total_work_mins ?? 0) / 60) * 100) / 100,
      totalOvertimeHours: Math.round(((data.total_overtime_mins ?? 0) / 60) * 100) / 100,
      paidLeaveDays: data.total_paid_holiday ?? 0,
      absentDays: data.total_absence_days ?? 0,
    }
  }, 'EXTERNAL_SERVICE_ERROR')
}
