import { prisma } from '@/lib/db'
import { failure, createAppError, tryCatch, type Result, type AppError } from '@/types/result'
import * as fs from 'fs'
import * as path from 'path'

const ALLOWED_BACKUP_DIR = path.resolve(process.cwd(), 'backups')
const ALLOWED_EXPORT_DIR = path.resolve(process.cwd(), 'exports')

function validateOutputDir(requestedDir: string | undefined, allowedBase: string): string {
  const resolved = path.resolve(requestedDir ?? allowedBase)
  if (!resolved.startsWith(allowedBase)) {
    throw new Error(`Path traversal detected: output must be under ${allowedBase}`)
  }
  return resolved
}

function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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
    const outputDir = validateOutputDir(options.outputDir, ALLOWED_BACKUP_DIR)

    await fs.promises.mkdir(outputDir, { recursive: true })

    const filePath = path.join(outputDir, fileName)

    const tables = await collectDatabaseData(options.companyId)
    const backupData = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      backupType: options.backupType,
      companyId: options.companyId ?? 'all',
      tables,
    }

    await fs.promises.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
    const stats = await fs.promises.stat(filePath)

    const record = await prisma.backupRecord.create({
      data: {
        companyId: options.companyId,
        backupType: options.backupType,
        fileName,
        filePath,
        fileSize: Number(stats.size),
        destination: options.destination,
        status: 'completed',
      },
    })

    return {
      id: record.id,
      fileName,
      filePath,
      fileSize: Number(stats.size),
      destination: options.destination,
    }
  }, 'DATABASE_ERROR')
}

async function collectDatabaseData(companyId?: string): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {}
  tables.companies = companyId
    ? await prisma.company.findMany({ where: { id: companyId } })
    : await prisma.company.findMany()

  tables.users = await prisma.user.findMany({
    ...(companyId ? { where: { companyId } } : {}),
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

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

export async function getBackupHistory(companyId?: string): Promise<
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

    const resolvedPath = path.resolve(record.filePath)
    if (!resolvedPath.startsWith(ALLOWED_BACKUP_DIR)) {
      throw new Error('Invalid backup file path')
    }

    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK)
    } catch {
      throw new Error(`Backup file not found: ${record.fileName}`)
    }

    const content = await fs.promises.readFile(resolvedPath, 'utf-8')
    const backupData = JSON.parse(content) as {
      tables: Record<string, unknown[]>
    }

    if (!backupData.tables || typeof backupData.tables !== 'object') {
      throw new Error('Invalid backup file format')
    }

    const restoredTables = Object.keys(backupData.tables)
    let recordCount = 0

    await prisma.$transaction(async (tx) => {
      for (const tableName of restoredTables) {
        const tableRows = backupData.tables[tableName]
        if (!Array.isArray(tableRows) || tableRows.length === 0) continue
        recordCount += tableRows.length

        const model = (tx as Record<string, unknown>)[tableName]
        if (model && typeof model === 'object' && 'createMany' in model) {
          const createMany = (
            model as {
              createMany: (args: { data: unknown[]; skipDuplicates: boolean }) => Promise<unknown>
            }
          ).createMany
          try {
            await createMany({ data: tableRows, skipDuplicates: true })
          } catch (err) {
            console.warn(`Skipping restore for table ${tableName}:`, err)
          }
        }
      }
    })

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
    const outputDir = validateOutputDir(options.outputDir, ALLOWED_EXPORT_DIR)
    await fs.promises.mkdir(outputDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const files: string[] = []
    const data = await collectDatabaseData(options.companyId)

    for (const tableName of options.tables) {
      const tableData = data[tableName]
      if (!tableData) continue

      if (options.format === 'json') {
        const filePath = path.join(outputDir, `${tableName}_${timestamp}.json`)
        await fs.promises.writeFile(filePath, JSON.stringify(tableData, null, 2), 'utf-8')
        files.push(filePath)
      } else {
        const filePath = path.join(outputDir, `${tableName}_${timestamp}.csv`)
        if (tableData.length > 0) {
          const headers = Object.keys(tableData[0] as Record<string, unknown>)
          const rows = tableData.map((row) => {
            const r = row as Record<string, unknown>
            return headers.map((h) => sanitizeCsvValue(r[h])).join(',')
          })
          await fs.promises.writeFile(filePath, [headers.join(','), ...rows].join('\n'), 'utf-8')
          files.push(filePath)
        }
      }
    }

    return { files }
  }, 'DATABASE_ERROR')
}
