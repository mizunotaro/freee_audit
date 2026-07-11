/**
 * SQLite データベースのバックアップ／リストア／検証ヘルパー。
 *
 * ファイルベースの SQLite プロバイダーに特化したバックアップ／リストア処理を
 * `Result<T, E>` 彤式で提供する。バックアップは対象 `.db` ファイルのバイトコピーと
 * SHA-256 チェックサム、および manifest サイドカーファイルを生成する。リストアは
 * manifest のチェックサムと一致することを検証したうえで一時場所へ復元する。
 * `verifyRowCounts` は Prisma クライアントで各モデルの行数を比較する。
 *
 * PostgreSQL プロバイダーは本モジュールでは未実装（構造のみ拡張ポイントとして用意）。
 * `postgresql:` URL を渡した場合は明示的な `failure` を返し、偽の成功を返さない。
 * 将来の PG 対応は各関数の provider 分岐に支払列を追加するだけで拡張できる構造とする。
 *
 * 制限: SQLite のバイトコピーは WAL や並行書き込みを考慮しない（drill／運用検証用途）。
 * 本番等級のオンラインバックアップが必要な場合は docs/OPERATIONS_BACKUP.md の注意事項を参照。
 *
 * @module lib/backup/sqlite-backup
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import {
  ERROR_CODES,
  createAppError,
  failure,
  success,
  type AppError,
  type Result,
} from '@/types/result'

/** manifest 形式のバージョン。破壊的変更時に繰り上げる。 */
export const BACKUP_MANIFEST_VERSION = 1 as const

/** チェックサムアルゴリズム（node:crypto の名前）。 */
export const BACKUP_CHECKSUM_ALGORITHM = 'sha256' as const

/** manifest サイドカーファイルの接尾辞（`<backupPath> + 本接尾辞`）。 */
export const MANIFEST_SIDECAR_SUFFIX = '.manifest.json' as const

/**
 * 行数検証の既定モデル一覧。シード有無に関わらず両 DB で一致すべき中核テーブル。
 * `verifyRowCounts` の `models` 未指定時に使用される。
 */
export const DEFAULT_VERIFY_MODELS = [
  'user',
  'company',
  'session',
  'auditLog',
  'journal',
  'monthlyBalance',
] as const

/** サポートする（構造上の）データベースプロバイダー。 */
export type DatabaseProvider = 'sqlite' | 'postgresql' | 'unknown'

/**
 * 接続 URL 文字列からプロバイダーを推論する。
 * SQLite は `file:`、PostgreSQL は `postgresql:` / `postgres:` で始まる。
 */
export function detectProvider(dbUrl: string): DatabaseProvider {
  const u = dbUrl.trim().toLowerCase()
  if (u.startsWith('file:')) return 'sqlite'
  if (u.startsWith('postgresql:') || u.startsWith('postgres:')) return 'postgresql'
  return 'unknown'
}

/**
 * バックアップ manifest の Zod スキーマ。`scripts/db-backup.mjs` と共有する契約。
 */
export const BackupManifestSchema = z.object({
  manifestVersion: z.literal(BACKUP_MANIFEST_VERSION),
  provider: z.enum(['sqlite', 'postgresql']),
  source: z.string().min(1),
  backupPath: z.string().min(1),
  checksumAlgorithm: z.literal(BACKUP_CHECKSUM_ALGORITHM),
  checksum: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
})

/** バックアップ manifest。 */
export type BackupManifest = z.infer<typeof BackupManifestSchema>

/** `backupDatabase` の入力オプション。 */
export const BackupOptionsSchema = z.object({
  /** バックアップ元の SQLite ファイルパス。 */
  sourcePath: z.string().min(1),
  /** バックアップ出力ディレクトリ。省略時は `sourcePath` と同階層。 */
  outDir: z.string().min(1).optional(),
  /** プロバイダー明示。省略時は `sqlite`。`postgresql` は未実装で failure になる。 */
  provider: z.enum(['sqlite', 'postgresql']).optional(),
})

/** `backupDatabase` への入力。 */
export type BackupOptions = z.infer<typeof BackupOptionsSchema>

/** `restoreDatabase` の入力オプション。 */
export const RestoreOptionsSchema = z.object({
  /** バックアップファイル（`.db`）のパス。 */
  backupPath: z.string().min(1),
  /** 復元先ディレクトリ（一時場所を推奨）。 */
  targetDir: z.string().min(1),
  /** 復元先に同名ファイルが存在する場合に上書きするか。省略時は false。 */
  overwrite: z.boolean().optional(),
})

/** `restoreDatabase` への入力。 */
export type RestoreOptions = z.infer<typeof RestoreOptionsSchema>

/** `restoreDatabase` の成功結果。 */
export interface RestoreResult {
  restoredPath: string
  bytes: number
  checksum: string
  checksumVerified: boolean
  manifest: BackupManifest
}

/** `verifyRowCounts` の入力オプション。 */
export const VerifyOptionsSchema = z.object({
  /** 比較元のデータベース URL（例: `file:/abs/seed.db`）。 */
  sourceUrl: z.string().min(1),
  /** 比較先（復元側）のデータベース URL。 */
  targetUrl: z.string().min(1),
  /** 検証対象モデル一覧。省略時は {@link DEFAULT_VERIFY_MODELS}。 */
  models: z.array(z.string().min(1)).optional(),
  /** プロバイダー明示。省略時は `sourceUrl` から推論。`sqlite` 以外は failure。 */
  provider: z.enum(['sqlite', 'postgresql']).optional(),
})

/** `verifyRowCounts` への入力。 */
export type VerifyOptions = z.infer<typeof VerifyOptionsSchema>

/** モデル別の行数比較結果。 */
export interface TableCount {
  table: string
  sourceCount: number
  targetCount: number
  match: boolean
}

/** `verifyRowCounts` の成功結果。 */
export interface RowCountReport {
  tables: TableCount[]
  allMatch: boolean
  mismatched: string[]
}

function validationFailure(message: string, issues: unknown): Result<never, AppError> {
  return failure(
    createAppError(ERROR_CODES.VALIDATION_ERROR, message, {
      details: { issues },
    })
  )
}

/** ファイル全体の SHA-256 を 16 進文字列で返す。 */
function sha256File(filePath: string): string {
  return createHash(BACKUP_CHECKSUM_ALGORITHM).update(readFileSync(filePath)).digest('hex')
}

/** ファイル名に安全に使える UTC タイムスタンプ（`YYYYMMDDTHHMMSSZ`）。 */
function stampForFilename(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

/**
 * SQLite ファイルをバックアップし、チェックサムと manifest サイドカーを書き出す。
 *
 * 成功すると `<outDir>/<base>.<stamp>.db` と `<...>.db.manifest.json` を生成し、
 * その manifest を返す。PostgreSQL プロバイダーは未実装のため failure を返す。
 */
export async function backupDatabase(rawOpts: unknown): Promise<Result<BackupManifest, AppError>> {
  const parsed = BackupOptionsSchema.safeParse(rawOpts)
  if (!parsed.success) {
    return validationFailure('Invalid backup options', parsed.error.issues)
  }
  const { sourcePath, outDir, provider } = parsed.data

  const resolvedProvider = provider ?? 'sqlite'
  if (resolvedProvider === 'postgresql') {
    return failure(
      createAppError(
        ERROR_CODES.BUSINESS_LOGIC_ERROR,
        'PostgreSQL backup is not implemented; only the SQLite file provider is supported. See docs/OPERATIONS_BACKUP.md.'
      )
    )
  }

  if (!existsSync(sourcePath)) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, `Source database file not found: ${sourcePath}`)
    )
  }

  const destDir = outDir ?? dirname(resolve(sourcePath))
  mkdirSync(destDir, { recursive: true })

  const stamp = stampForFilename(new Date())
  const backupPath = join(destDir, `${basename(sourcePath)}.${stamp}.db`)
  copyFileSync(sourcePath, backupPath)

  const bytes = statSync(backupPath).size
  const checksum = sha256File(backupPath)
  const manifest: BackupManifest = {
    manifestVersion: BACKUP_MANIFEST_VERSION,
    provider: 'sqlite',
    source: isAbsolute(sourcePath) ? sourcePath : resolve(sourcePath),
    backupPath,
    checksumAlgorithm: BACKUP_CHECKSUM_ALGORITHM,
    checksum,
    bytes,
    createdAt: new Date().toISOString(),
  }

  writeFileSync(
    `${backupPath}${MANIFEST_SIDECAR_SUFFIX}`,
    JSON.stringify(manifest, null, 2),
    'utf8'
  )

  return success(manifest)
}

/**
 * バックアップファイルを検証して一時場所へ復元する。
 *
 * `<backupPath>.manifest.json` サイドカーを読み、バックアップ実ファイル SHA-256 が
 * manifest と一致するか検証する。不一致や manifest 欠落・破損は failure。
 * 復元先のファイル名は manifest.source のベース名を用いる。
 */
export async function restoreDatabase(rawOpts: unknown): Promise<Result<RestoreResult, AppError>> {
  const parsed = RestoreOptionsSchema.safeParse(rawOpts)
  if (!parsed.success) {
    return validationFailure('Invalid restore options', parsed.error.issues)
  }
  const { backupPath, targetDir, overwrite } = parsed.data

  if (!existsSync(backupPath)) {
    return failure(createAppError(ERROR_CODES.NOT_FOUND, `Backup file not found: ${backupPath}`))
  }

  const manifestPath = `${backupPath}${MANIFEST_SIDECAR_SUFFIX}`
  if (!existsSync(manifestPath)) {
    return failure(
      createAppError(ERROR_CODES.NOT_FOUND, `Manifest sidecar not found: ${manifestPath}`)
    )
  }

  let manifestRaw: unknown
  try {
    manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'Manifest is not valid JSON', {
        cause,
      })
    )
  }

  const manifestParse = BackupManifestSchema.safeParse(manifestRaw)
  if (!manifestParse.success) {
    return validationFailure('Manifest does not match expected schema', manifestParse.error.issues)
  }
  const manifest = manifestParse.data

  const actualChecksum = sha256File(backupPath)
  if (actualChecksum !== manifest.checksum) {
    return failure(
      createAppError(
        ERROR_CODES.BUSINESS_LOGIC_ERROR,
        'Backup checksum mismatch — refusing to restore a corrupt or tampered backup.',
        { details: { expected: manifest.checksum, actual: actualChecksum } }
      )
    )
  }

  mkdirSync(targetDir, { recursive: true })
  const restoredPath = join(targetDir, basename(manifest.source))
  if (existsSync(restoredPath) && !overwrite) {
    return failure(
      createAppError(
        ERROR_CODES.BUSINESS_LOGIC_ERROR,
        `Restore target already exists (pass overwrite:true to replace): ${restoredPath}`
      )
    )
  }

  copyFileSync(backupPath, restoredPath)
  return success({
    restoredPath,
    bytes: statSync(restoredPath).size,
    checksum: actualChecksum,
    checksumVerified: true,
    manifest,
  })
}

/** Prisma クライアントから指定モデルの行数を取得する。未知モデルは例外を投げる。 */
async function countModel(client: PrismaClient, model: string): Promise<number> {
  const delegate = (client as unknown as Record<string, { count: () => Promise<number> }>)[model]
  if (!delegate || typeof delegate.count !== 'function') {
    throw new Error(`Unknown prisma model for row-count verification: ${model}`)
  }
  return delegate.count()
}

/**
 * 2 つのデータベース URL について、指定モデルの行数が一致するか検証する。
 *
 * それぞれ個別の `PrismaClient` を開いて `.count()` を比較し、両 DB で終了時に切断する。
 * SQLite プロバイダーのみサポート（それ以外は failure）。
 */
export async function verifyRowCounts(rawOpts: unknown): Promise<Result<RowCountReport, AppError>> {
  const parsed = VerifyOptionsSchema.safeParse(rawOpts)
  if (!parsed.success) {
    return validationFailure('Invalid verify options', parsed.error.issues)
  }
  const { sourceUrl, targetUrl, models, provider } = parsed.data

  const resolvedProvider = provider ?? detectProvider(sourceUrl)
  if (resolvedProvider !== 'sqlite') {
    return failure(
      createAppError(
        ERROR_CODES.BUSINESS_LOGIC_ERROR,
        `Row-count verification supports the SQLite provider only (detected: ${resolvedProvider}).`
      )
    )
  }

  const modelNames = models ?? [...DEFAULT_VERIFY_MODELS]
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } })
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } })

  try {
    const tables: TableCount[] = []
    for (const model of modelNames) {
      const [sourceCount, targetCount] = await Promise.all([
        countModel(source, model),
        countModel(target, model),
      ])
      tables.push({
        table: model,
        sourceCount,
        targetCount,
        match: sourceCount === targetCount,
      })
    }
    const mismatched = tables.filter((t) => !t.match).map((t) => t.table)
    return success({ tables, allMatch: mismatched.length === 0, mismatched })
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    return failure(
      createAppError(
        ERROR_CODES.DATABASE_ERROR,
        `Row-count verification failed: ${cause.message}`,
        {
          cause,
        }
      )
    )
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()])
  }
}
