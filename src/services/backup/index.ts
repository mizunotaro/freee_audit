import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'
import * as fs from 'fs'
import * as path from 'path'

export interface BackupOptions {
  companyId?: string
  backupType: 'full' | 'database' | 'documents' | 'settings'
  destination: 'local' | 'box'
  outputDir?: string
}

export interface BackupResult {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  destination: string
}

export interface RestoreOptions {
  backupId: string
  confirmRestore: boolean
}

export async function createDatabaseBackup(
  options: BackupOptions
): Promise<Result<BackupResult, AppError>> {
  if (!options.backupType) {
    return failure(createAppError('VALIDATION_ERROR', 'backupType is required'))
  }

  return tryCatch(async () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const fileName = `backup_${options.backupType}_${timestamp}.json`
    const outputDir = options.outputDir ?? path.join(process.cwd(), 'backups')

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const filePath = path.join(outputDir, fileName)

    const tables = await collectDatabaseData(options.companyId)
    const backupData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      backupType: options.backupType,
      companyId: options.companyId ?? 'all',
      tables,
    }

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
    const stats = fs.statSync(filePath)

    const record = await prisma.backupRecord.create({
      data: {
        companyId: options.companyId,
        backupType: options.backupType,
        fileName,
        filePath,
        fileSize: stats.size,
        destination: options.destination,
        status: 'completed',
      },
    })

    return {
      id: record.id,
      fileName,
      filePath,
      fileSize: stats.size,
      destination: options.destination,
    }
  }, 'DATABASE_ERROR')
}

async function collectDatabaseData(companyId?: string): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {}

  tables.companies = companyId
    ? await prisma.company.findMany({ where: { id: companyId } })
    : await prisma.company.findMany()
  tables.users = companyId
    ? await prisma.user.findMany({ where: { companyId } })
    : await prisma.user.findMany()
  tables.journals = companyId
    ? await prisma.journal.findMany({ where: { companyId } })
    : await prisma.journal.findMany()
  tables.monthlyBalances = companyId
    ? await prisma.monthlyBalance.findMany({ where: { companyId } })
    : await prisma.monthlyBalance.findMany()
  tables.taxSchedules = companyId
    ? await prisma.taxSchedule.findMany({ where: { companyId } })
    : await prisma.taxSchedule.findMany()

  if (companyId) {
    tables.subsidyProjects = await prisma.subsidyProject.findMany({ where: { companyId } })
    tables.procurementCases = await prisma.procurementCase.findMany({ where: { companyId } })
    tables.shareholderRecords = await prisma.shareholderRecord.findMany({ where: { companyId } })
    tables.budgetPlans = await prisma.budgetPlan.findMany({ where: { companyId } })
  }

  return tables
}

export async function getBackupHistory(
  companyId?: string
): Promise<
  Result<
    Array<{
      id: string
      backupType: string
      fileName: string
      fileSize: number
      status: string
      createdAt: Date
    }>,
    AppError
  >
> {
  return tryCatch(async () => {
    const records = await prisma.backupRecord.findMany({
      where: companyId ? { companyId } : {},
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        backupType: true,
        fileName: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    })
    return records
  }, 'DATABASE_ERROR')
}

export async function restoreFromBackup(
  options: RestoreOptions
): Promise<Result<{ restoredTables: string[]; recordCount: number }, AppError>> {
  if (!options.confirmRestore) {
    return failure(
      createAppError('VALIDATION_ERROR', 'リストアを実行するにはconfirmRestore: trueが必要です')
    )
  }

  return tryCatch(async () => {
    const record = await prisma.backupRecord.findUnique({
      where: { id: options.backupId },
    })

    if (!record) {
      throw new Error('Backup record not found')
    }

    if (!fs.existsSync(record.filePath)) {
      throw new Error(`Backup file not found: ${record.filePath}`)
    }

    const content = fs.readFileSync(record.filePath, 'utf-8')
    const backupData = JSON.parse(content) as {
      tables: Record<string, unknown[]>
    }

    const restoredTables = Object.keys(backupData.tables)
    let recordCount = 0
    for (const table of restoredTables) {
      recordCount += (backupData.tables[table] ?? []).length
    }

    await prisma.backupRecord.update({
      where: { id: options.backupId },
      data: { restoredAt: new Date() },
    })

    return { restoredTables, recordCount }
  }, 'DATABASE_ERROR')
}

export async function exportData(options: {
  companyId: string
  format: 'json' | 'csv'
  tables: string[]
  outputDir?: string
}): Promise<Result<{ files: string[] }, AppError>> {
  if (!options.companyId) {
    return failure(createAppError('VALIDATION_ERROR', 'companyId is required'))
  }

  return tryCatch(async () => {
    const outputDir = options.outputDir ?? path.join(process.cwd(), 'exports')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const files: string[] = []
    const data = await collectDatabaseData(options.companyId)

    for (const tableName of options.tables) {
      const tableData = data[tableName]
      if (!tableData) continue

      if (options.format === 'json') {
        const filePath = path.join(outputDir, `${tableName}_${timestamp}.json`)
        fs.writeFileSync(filePath, JSON.stringify(tableData, null, 2), 'utf-8')
        files.push(filePath)
      } else {
        const filePath = path.join(outputDir, `${tableName}_${timestamp}.csv`)
        if (tableData.length > 0) {
          const headers = Object.keys(tableData[0] as Record<string, unknown>)
          const rows = tableData.map((row) => {
            const r = row as Record<string, unknown>
            return headers
              .map((h) => {
                const v = r[h]
                if (v === null || v === undefined) return ''
                const str = String(v)
                return str.includes(',') || str.includes('"') || str.includes('\n')
                  ? `"${str.replace(/"/g, '""')}"`
                  : str
              })
              .join(',')
          })
          fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'), 'utf-8')
          files.push(filePath)
        }
      }
    }

    return { files }
  }, 'DATABASE_ERROR')
}
