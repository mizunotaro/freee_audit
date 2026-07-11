#!/usr/bin/env node
// db-restore.mjs — dependency-free SQLite restore drill (checksum verify + optional row-count verify).
//
// Restores a backup produced by scripts/db-backup.mjs (or src/lib/backup/sqlite-backup.ts) into a
// TEMPORARY target directory — it never overwrites the live database. The restore is gated on the
// manifest checksum: a byte-flipped or truncated backup is refused. Pass --verify-rows <sourceDb>
// to additionally open both databases with @prisma/client (an already-installed dependency, not a
// new one) and assert row counts match per model.
//
// Manifest contract: shared with src/lib/backup/sqlite-backup.ts (BACKUP_MANIFEST_VERSION = 1).
//
// Usage:
//   node scripts/db-restore.mjs <backupDb> --to <tempDir>
//   node scripts/db-restore.mjs <backupDb> --to <tempDir> --overwrite
//   node scripts/db-restore.mjs <backupDb> --to <tempDir> --verify-rows <liveDb>
//
// Exit codes: 0 = restored (+ row counts verified if requested);
//             1 = usage / source / IO / checksum-mismatch / row-count-mismatch error;
//             2 = unsupported provider.
//
// Dep-free in the default path: Node >= 20 builtins only. @prisma/client is imported lazily and
// only when --verify-rows is supplied.

import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs'
import { basename, join, resolve } from 'node:path'

const MANIFEST_SIDECAR_SUFFIX = '.manifest.json'
const DEFAULT_VERIFY_MODELS = ['user', 'company', 'session', 'auditLog', 'journal', 'monthlyBalance']

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

// Prisma SQLite URLs use forward slashes; normalise a filesystem path into a `file:` URL.
function toFileUrl(p) {
  const abs = resolve(p)
  const normalized = abs.replace(/\\/g, '/')
  return `file:${normalized}`
}

function parseArgs(argv) {
  const out = { positional: [], to: undefined, overwrite: false, verifyRows: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--to') out.to = argv[++i]
    else if (a.startsWith('--to=')) out.to = a.slice('--to='.length)
    else if (a === '--overwrite') out.overwrite = true
    else if (a === '--verify-rows') out.verifyRows = argv[++i]
    else if (a.startsWith('--verify-rows=')) out.verifyRows = a.slice('--verify-rows='.length)
    else if (a === '-h' || a === '--help') out.help = true
    else out.positional.push(a)
  }
  return out
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/db-restore.mjs <backupDb> --to <tempDir> [--overwrite] [--verify-rows <liveDb>]',
      '',
      'Restores a backup into a TEMPORARY directory after verifying its checksum.',
      'Use --verify-rows to compare row counts against the live database via prisma.',
      'See docs/OPERATIONS_BACKUP.md.',
      '',
    ].join('\n')
  )
}

function fail(message, code = 1) {
  process.stderr.write(`[db-restore] ERROR: ${message}\n`)
  process.exit(code)
}

function readManifest(backupPath) {
  const manifestPath = `${backupPath}${MANIFEST_SIDECAR_SUFFIX}`
  if (!existsSync(manifestPath)) {
    fail(`manifest sidecar not found: ${manifestPath}`, 1)
  }
  let raw
  try {
    raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    fail(`manifest is not valid JSON (${manifestPath}): ${error.message}`, 1)
  }
  for (const key of ['manifestVersion', 'provider', 'source', 'backupPath', 'checksumAlgorithm', 'checksum', 'bytes', 'createdAt']) {
    if (!(key in raw)) fail(`manifest missing required field "${key}" (${manifestPath})`, 1)
  }
  if (raw.provider !== 'sqlite') {
    fail(`unsupported provider in manifest: ${raw.provider}`, 2)
  }
  return raw
}

async function verifyRows(sourceDbPath, restoredDbPath) {
  const { PrismaClient } = await import('@prisma/client')
  const sourceUrl = toFileUrl(sourceDbPath)
  const targetUrl = toFileUrl(restoredDbPath)
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })
  const rows = []
  try {
    for (const model of DEFAULT_VERIFY_MODELS) {
      const [sourceCount, targetCount] = await Promise.all([
        source[model].count(),
        target[model].count(),
      ])
      rows.push({ model, sourceCount, targetCount, match: sourceCount === targetCount })
    }
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()])
  }
  return rows
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const backupPath = args.positional[0]
  if (!backupPath) {
    printHelp()
    fail('missing <backupDb> argument', 1)
  }
  if (!args.to) {
    printHelp()
    fail('missing --to <tempDir> argument', 1)
  }
  if (!existsSync(backupPath)) {
    fail(`backup file not found: ${backupPath}`, 1)
  }

  const manifest = readManifest(backupPath)

  const actualChecksum = sha256File(backupPath)
  if (actualChecksum !== manifest.checksum) {
    fail(
      `checksum mismatch — refusing to restore (expected ${manifest.checksum}, got ${actualChecksum})`,
      1
    )
  }

  const targetDir = args.to
  mkdirSync(targetDir, { recursive: true })
  const restoredPath = join(targetDir, basename(manifest.source))
  if (existsSync(restoredPath) && !args.overwrite) {
    fail(`restore target already exists (pass --overwrite to replace): ${restoredPath}`, 1)
  }

  copyFileSync(backupPath, restoredPath)

  process.stdout.write(
    [
      `[db-restore] restored`,
      `  backupPath: ${backupPath}`,
      `  restored:   ${restoredPath}`,
      `  sha256:     ${actualChecksum} (verified)`,
      `  bytes:      ${statSync(restoredPath).size}`,
      '',
    ].join('\n')
  )

  if (args.verifyRows) {
    if (!existsSync(args.verifyRows)) {
      fail(`--verify-rows source database not found: ${args.verifyRows}`, 1)
    }
    const rows = await verifyRows(args.verifyRows, restoredPath)
    const mismatched = rows.filter((r) => !r.match).map((r) => r.model)
    process.stdout.write(`[db-restore] row-count verification (${rows.length} models)\n`)
    for (const r of rows) {
      process.stdout.write(
        `  ${r.model.padEnd(18)} source=${String(r.sourceCount).padStart(6)} target=${String(r.targetCount).padStart(6)} ${r.match ? 'OK' : 'MISMATCH'}\n`
      )
    }
    if (mismatched.length > 0) {
      fail(`row-count mismatch on: ${mismatched.join(', ')}`, 1)
    }
    process.stdout.write('[db-restore] all row counts match\n')
  }
}

main().catch((error) => {
  fail(error?.message ?? String(error), 1)
})
