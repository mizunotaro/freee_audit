#!/usr/bin/env node
// db-backup.mjs — dependency-free SQLite backup drill (byte copy + SHA-256 manifest).
//
// Creates `<outDir>/<base>.<UTCstamp>.db` (a byte-for-byte copy of the source SQLite
// file) plus a `<...>.db.manifest.json` sidecar holding the checksum, byte size and
// source path. The manifest shape is the shared contract with src/lib/backup/sqlite-backup.ts
// (BACKUP_MANIFEST_VERSION = 1): a backup made here is consumable by the TS restore path
// and vice-versa. See docs/OPERATIONS_BACKUP.md.
//
// Structured for a future PostgreSQL provider via detectProvider()/a provider switch; only
// the SQLite file provider is wired today (postgresql exits 1 with a clear message).
//
// Usage:
//   node scripts/db-backup.mjs <sourceDb>                 # writes next to the source
//   node scripts/db-backup.mjs <sourceDb> --out ./backups
//   node scripts/db-backup.mjs <sourceDb> --provider sqlite
//
// Exit codes: 0 = backup created; 1 = usage/source/IO error; 2 = unsupported provider.
//
// Dep-free: Node >= 20 builtins only (no prisma, no zod, no new packages).

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

const MANIFEST_VERSION = 1
const CHECKSUM_ALGORITHM = 'sha256'
const MANIFEST_SIDECAR_SUFFIX = '.manifest.json'

function detectProvider(value) {
  const u = String(value).trim().toLowerCase()
  if (u.startsWith('file:')) return 'sqlite'
  if (u.startsWith('postgresql:') || u.startsWith('postgres:')) return 'postgresql'
  return 'sqlite' // filesystem paths default to the sqlite provider
}

function sha256File(filePath) {
  return createHash(CHECKSUM_ALGORITHM).update(readFileSync(filePath)).digest('hex')
}

function stampForFilename(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function parseArgs(argv) {
  const out = { positional: [], out: undefined, provider: undefined }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') out.out = argv[++i]
    else if (a.startsWith('--out=')) out.out = a.slice('--out='.length)
    else if (a === '--provider') out.provider = argv[++i]
    else if (a.startsWith('--provider=')) out.provider = a.slice('--provider='.length)
    else if (a === '-h' || a === '--help') out.help = true
    else out.positional.push(a)
  }
  return out
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/db-backup.mjs <sourceDb> [--out <dir>] [--provider sqlite|postgresql]',
      '',
      'Creates a byte-copy backup of the SQLite file with a SHA-256 manifest sidecar.',
      'See docs/OPERATIONS_BACKUP.md.',
      '',
    ].join('\n')
  )
}

function fail(message, code = 1) {
  process.stderr.write(`[db-backup] ERROR: ${message}\n`)
  process.exit(code)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const sourcePath = args.positional[0]
  if (!sourcePath) {
    printHelp()
    fail('missing <sourceDb> argument', 1)
  }

  const provider = args.provider ?? detectProvider(sourcePath)
  if (provider === 'postgresql') {
    fail(
      'PostgreSQL backup is not implemented; only the SQLite file provider is supported. See docs/OPERATIONS_BACKUP.md.',
      2
    )
  }
  if (provider !== 'sqlite') {
    fail(`Unsupported provider: ${provider}`, 2)
  }

  if (!existsSync(sourcePath)) {
    fail(`source database file not found: ${sourcePath}`, 1)
  }

  const destDir = args.out ?? dirname(resolve(sourcePath))
  mkdirSync(destDir, { recursive: true })

  const stamp = stampForFilename(new Date())
  const backupPath = join(destDir, `${basename(sourcePath)}.${stamp}.db`)
  copyFileSync(sourcePath, backupPath)

  const bytes = statSync(backupPath).size
  const checksum = sha256File(backupPath)
  const manifest = {
    manifestVersion: MANIFEST_VERSION,
    provider: 'sqlite',
    source: isAbsolute(sourcePath) ? sourcePath : resolve(sourcePath),
    backupPath,
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    checksum,
    bytes,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(`${backupPath}${MANIFEST_SIDECAR_SUFFIX}`, JSON.stringify(manifest, null, 2), 'utf8')

  process.stdout.write(
    [
      `[db-backup] backup created`,
      `  source:     ${manifest.source}`,
      `  backupPath: ${backupPath}`,
      `  manifest:   ${backupPath}${MANIFEST_SIDECAR_SUFFIX}`,
      `  sha256:     ${checksum}`,
      `  bytes:      ${bytes}`,
      '',
    ].join('\n')
  )
}

main()
