import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  BACKUP_MANIFEST_VERSION,
  backupDatabase,
  restoreDatabase,
  verifyRowCounts,
} from '@/lib/backup/sqlite-backup'

/**
 * End-to-end backup/restore drill against a REAL seeded SQLite database.
 *
 * The schema is materialised into a throwaway temp file via `prisma db push` (read-only use
 * of prisma/schema.prisma — no migration files are touched), then rows are seeded through a
 * real PrismaClient. The drill exercises the TS helpers in-process (backup -> restore ->
 * verify, plus a corruption negative) and the operational CLI scripts as subprocesses to
 * prove the documented commands work and interoperate via the shared manifest contract.
 */

const PRISMA_CLI = resolve(process.cwd(), 'node_modules/prisma/build/index.js')
const DB_BACKUP_CLI = resolve(process.cwd(), 'scripts/db-backup.mjs')
const DB_RESTORE_CLI = resolve(process.cwd(), 'scripts/db-restore.mjs')

function toFileUrl(p: string): string {
  return `file:${p.replace(/\\/g, '/')}`
}

function sha256OfFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function pushSchema(databaseUrl: string): void {
  const r = spawnSync(
    process.execPath,
    [PRISMA_CLI, 'db', 'push', '--skip-generate', '--accept-data-loss'],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      encoding: 'utf8',
    }
  )
  if (r.status !== 0) {
    throw new Error(`prisma db push failed (status ${r.status}): ${r.stderr || r.stdout}`)
  }
}

let tmpRoot: string
let seedPath: string
let seedUrl: string

beforeAll(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'backup01-'))
  seedPath = join(tmpRoot, 'seed.db')
  seedUrl = toFileUrl(seedPath)

  pushSchema(seedUrl)

  const prisma = new PrismaClient({ datasources: { db: { url: seedUrl } } })
  try {
    await prisma.user.create({
      data: { email: 'drill@seed.test', name: 'Drill User', role: 'ADMIN' },
    })
    await prisma.company.create({ data: { name: 'Drill Co' } })
    await prisma.auditLog.create({
      data: { action: 'BACKUP_DRILL', resource: 'database', result: 'SUCCESS' },
    })
  } finally {
    await prisma.$disconnect()
  }
}, 120000)

afterAll(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('sqlite backup/restore helpers (in-process drill)', () => {
  let backupPath: string
  let restoredPath: string

  it('backupDatabase writes a byte-copy backup with a checksum manifest sidecar', async () => {
    const outDir = join(tmpRoot, 'backups')
    const res = await backupDatabase({ sourcePath: seedPath, outDir })
    expect(res.success).toBe(true)
    if (!res.success) return

    const manifest = res.data
    expect(manifest.manifestVersion).toBe(BACKUP_MANIFEST_VERSION)
    expect(manifest.provider).toBe('sqlite')
    expect(manifest.checksumAlgorithm).toBe('sha256')
    expect(existsSync(manifest.backupPath)).toBe(true)
    expect(existsSync(`${manifest.backupPath}.manifest.json`)).toBe(true)
    expect(manifest.checksum).toBe(sha256OfFile(manifest.backupPath))
    expect(manifest.bytes).toBeGreaterThan(0)

    backupPath = manifest.backupPath
  })

  it('restoreDatabase restores to a temp dir after checksum verification', async () => {
    const targetDir = join(tmpRoot, 'restored')
    const res = await restoreDatabase({ backupPath, targetDir })
    expect(res.success).toBe(true)
    if (!res.success) return

    expect(res.data.checksumVerified).toBe(true)
    expect(existsSync(res.data.restoredPath)).toBe(true)
    expect(sha256OfFile(res.data.restoredPath)).toBe(res.data.checksum)
    restoredPath = res.data.restoredPath
  })

  it('verifyRowCounts reports matching counts across source and restored databases', async () => {
    const res = await verifyRowCounts({
      sourceUrl: seedUrl,
      targetUrl: toFileUrl(restoredPath),
    })
    expect(res.success).toBe(true)
    if (!res.success) return

    expect(res.data.allMatch).toBe(true)
    expect(res.data.mismatched).toEqual([])
    const userRow = res.data.tables.find((t) => t.table === 'user')
    expect(userRow).toBeDefined()
    expect(userRow?.sourceCount).toBeGreaterThan(0)
    expect(userRow?.sourceCount).toBe(userRow?.targetCount)
  })

  it('restoreDatabase refuses a corrupted backup (checksum mismatch)', async () => {
    const corruptPath = join(tmpRoot, 'corrupt.db')
    copyFileSync(backupPath, corruptPath)
    copyFileSync(`${backupPath}.manifest.json`, `${corruptPath}.manifest.json`)

    const buf = readFileSync(corruptPath)
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff
    writeFileSync(corruptPath, buf)

    const res = await restoreDatabase({
      backupPath: corruptPath,
      targetDir: join(tmpRoot, 'corrupt-restore'),
    })
    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.code).toBe('BUSINESS_LOGIC_ERROR')
    expect(res.error.message).toMatch(/checksum mismatch/)
  })

  it('backupDatabase rejects the unsupported postgresql provider', async () => {
    const res = await backupDatabase({ sourcePath: seedPath, provider: 'postgresql' })
    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.code).toBe('BUSINESS_LOGIC_ERROR')
  })

  it('restoreDatabase refuses when the manifest sidecar is missing', async () => {
    const orphanPath = join(tmpRoot, 'orphan.db')
    copyFileSync(backupPath, orphanPath)
    const res = await restoreDatabase({
      backupPath: orphanPath,
      targetDir: join(tmpRoot, 'orphan-restore'),
    })
    expect(res.success).toBe(false)
    if (res.success) return
    expect(res.error.code).toBe('NOT_FOUND')
  })
})

describe('cli scripts interop (scripts/db-backup.mjs, scripts/db-restore.mjs)', () => {
  it('db-backup.mjs produces a manifest consumable by the TS restore/verify path', async () => {
    const cliBackupDir = join(tmpRoot, 'cli-backups')
    const r = spawnSync(process.execPath, [DB_BACKUP_CLI, seedPath, '--out', cliBackupDir], {
      encoding: 'utf8',
    })
    expect(r.status).toBe(0)

    const manifestFile = readdirSync(cliBackupDir).find((f) => f.endsWith('.manifest.json'))
    expect(manifestFile).toBeDefined()
    if (!manifestFile) throw new Error('db-backup.mjs produced no manifest sidecar')

    const manifest = JSON.parse(readFileSync(join(cliBackupDir, manifestFile), 'utf8')) as {
      manifestVersion: number
      backupPath: string
      checksumAlgorithm: string
    }
    expect(manifest.manifestVersion).toBe(BACKUP_MANIFEST_VERSION)
    expect(manifest.checksumAlgorithm).toBe('sha256')

    const restoreRes = await restoreDatabase({
      backupPath: manifest.backupPath,
      targetDir: join(tmpRoot, 'cli-restore'),
    })
    expect(restoreRes.success).toBe(true)
    if (!restoreRes.success) return

    const verifyRes = await verifyRowCounts({
      sourceUrl: seedUrl,
      targetUrl: toFileUrl(restoreRes.data.restoredPath),
    })
    expect(verifyRes.success).toBe(true)
    if (!verifyRes.success) return
    expect(verifyRes.data.allMatch).toBe(true)
  })

  it('db-restore.mjs restores and verifies rows end-to-end via --verify-rows', () => {
    const cliBackupDir = join(tmpRoot, 'cli-backups-2')
    const make = spawnSync(process.execPath, [DB_BACKUP_CLI, seedPath, '--out', cliBackupDir], {
      encoding: 'utf8',
    })
    expect(make.status).toBe(0)

    const dbFile = readdirSync(cliBackupDir).find(
      (f) => f.endsWith('.db') && !f.endsWith('.manifest.json')
    )
    expect(dbFile).toBeDefined()
    if (!dbFile) throw new Error('db-backup.mjs produced no backup file')

    const restoreTo = join(tmpRoot, 'cli-restore-2')
    const r = spawnSync(
      process.execPath,
      [DB_RESTORE_CLI, join(cliBackupDir, dbFile), '--to', restoreTo, '--verify-rows', seedPath],
      { encoding: 'utf8' }
    )
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/all row counts match/)
  })

  it('db-restore.mjs exits non-zero on a corrupted backup', () => {
    const cliBackupDir = join(tmpRoot, 'cli-backups-3')
    spawnSync(process.execPath, [DB_BACKUP_CLI, seedPath, '--out', cliBackupDir], {
      encoding: 'utf8',
    })
    const dbFile = readdirSync(cliBackupDir).find(
      (f) => f.endsWith('.db') && !f.endsWith('.manifest.json')
    )
    expect(dbFile).toBeDefined()
    if (!dbFile) throw new Error('db-backup.mjs produced no backup file')

    const corruptPath = join(tmpRoot, 'cli-corrupt.db')
    copyFileSync(join(cliBackupDir, dbFile), corruptPath)
    copyFileSync(join(cliBackupDir, `${dbFile}.manifest.json`), `${corruptPath}.manifest.json`)
    const buf = readFileSync(corruptPath)
    buf[0] = buf[0] ^ 0xff
    writeFileSync(corruptPath, buf)

    const r = spawnSync(
      process.execPath,
      [DB_RESTORE_CLI, corruptPath, '--to', join(tmpRoot, 'cli-corrupt-restore')],
      { encoding: 'utf8' }
    )
    expect(r.status).not.toBe(0)
    expect(r.stderr).toMatch(/checksum mismatch/)
  })
})
