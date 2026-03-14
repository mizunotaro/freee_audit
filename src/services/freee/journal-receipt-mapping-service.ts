/**
 * freee API仕訳↔証憑マッピングサービス
 *
 * Deals API（取引）から receipts 情報を取得し、仕訳↔証憑のマッピングを構築
 *
 * @module services/freee/journal-receipt-mapping-service
 * @version 1.0.0
 */

import { FreeeClient } from '@/lib/integrations/freee/client'
import type {
  FreeeJournal,
  FreeeDeal,
  FreeeDealParams,
  JournalDocumentMapping,
  MappingSyncResult,
  FreeeJournalDetail,
  FreeeDealDetail,
} from '@/lib/integrations/freee/types'

/**
 * マッピングサービス設定
 */
export interface JournalReceiptMappingConfig {
  /** キャッシュ有効フラグ */
  cacheEnabled?: boolean
  /** キャッシュTTL（ミリ秒） */
  cacheTTL?: number
  /** 最大キャッシュサイズ */
  maxCacheSize?: number
  /** 並列処理の同時実行数 */
  concurrency?: number
  /** デバッグモード */
  debugMode?: boolean
}

/**
 * マッピング同期エラー
 */
export interface MappingSyncError {
  /** 仕訳ID */
  journalId?: string
  /** 取引ID */
  dealId?: number
  /** エラーメッセージ */
  error: string
  /** エラーコード */
  code?: string
}

/**
 * ログコンテキスト
 */
interface LogContext {
  requestId?: string
  userId?: string
  companyId?: number
  module: string
  operation: string
}

/**
 * Result型パターン
 */
export type Result<T, E = AppError> = { success: true; data: T } | { success: false; error: E }

/**
 * アプリケーションエラー
 */
export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  timestamp: string
  context?: LogContext
}

/**
 * 設定バージョン
 */
export const CONFIG_VERSION = '1.0.0'

/**
 * デフォルト設定
 */
const DEFAULT_MAPPING_CONFIG: Required<JournalReceiptMappingConfig> = {
  cacheEnabled: true,
  cacheTTL: 300000,
  maxCacheSize: 10000,
  concurrency: 5,
  debugMode: false,
}

/**
 * エラーコード定数
 */
export const ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  API_ERROR: 'API_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  TIMEOUT: 'TIMEOUT',
  CACHE_ERROR: 'CACHE_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const

/**
 * freee API仕訳↔証憑マッピングサービス
 *
 * 仕訳と証憑（Receipt/Document）の紐付けを管理するサービス
 *
 * @example
 * ```typescript
 * const service = new JournalReceiptMappingService()
 *
 * // 仕訳IDから証憑IDを取得
 * const result = await service.getReceiptsByJournalId(companyId, journalId, journalDate)
 * if (result.success) {
 *   console.log(result.data)
 * }
 *
 * // 一括同期
 * const syncResult = await service.syncMappings(companyId, startDate, endDate)
 * ```
 */
export class JournalReceiptMappingService {
  private client: FreeeClient
  private mappingCache: Map<string, JournalDocumentMapping> = new Map()
  private config: Required<JournalReceiptMappingConfig>
  private configVersion: string = CONFIG_VERSION

  constructor(client?: FreeeClient, config?: JournalReceiptMappingConfig) {
    this.client = client || new FreeeClient()
    this.config = { ...DEFAULT_MAPPING_CONFIG, ...config }
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.mappingCache.clear()
  }

  /**
   * 設定情報を取得
   */
  getConfig(): { version: string; config: Required<JournalReceiptMappingConfig> } {
    return {
      version: this.configVersion,
      config: { ...this.config },
    }
  }

  /**
   * キャッシュサイズを取得
   */
  getCacheSize(): number {
    return this.mappingCache.size
  }

  /**
   * 仕訳IDに紐づく証憑IDを取得
   *
   * @param companyId - 事業所ID
   * @param journalId - 仕訳ID
   * @param journalDate - 仕訳日付（YYYY-MM-DD）
   * @param context - ログコンテキスト
   * @returns 証憑ID配列またはエラー
   */
  async getReceiptsByJournalId(
    companyId: number,
    journalId: string,
    journalDate: string,
    context?: LogContext
  ): Promise<Result<number[], AppError>> {
    const logCtx: LogContext = {
      ...context,
      companyId,
      module: 'journal-receipt-mapping',
      operation: 'getReceiptsByJournalId',
    }

    try {
      // 入力バリデーション
      if (!journalId || !journalDate) {
        return this.createError(
          ERROR_CODES.INVALID_INPUT,
          'journalId and journalDate are required',
          logCtx
        )
      }

      if (!this.isValidDateString(journalDate)) {
        return this.createError(
          ERROR_CODES.INVALID_INPUT,
          'journalDate must be in YYYY-MM-DD format',
          logCtx
        )
      }

      // キャッシュ確認
      const cached = this.mappingCache.get(journalId)
      if (cached && this.config.cacheEnabled) {
        const now = Date.now()
        if (now - cached.syncedAt.getTime() < this.config.cacheTTL) {
          this.log('debug', 'Cache hit', { ...logCtx, journalId })
          return { success: true, data: cached.receiptIds }
        }
      }

      // API呼び出し
      const params: FreeeDealParams = {
        company_id: companyId,
        start_issue_date: journalDate,
        end_issue_date: journalDate,
        limit: 100,
      }
      const deals = await this.client.getDeals(companyId, params)

      // 証憑ID収集
      const receiptIds: number[] = []
      for (const deal of deals.deals) {
        if (deal.receipts && deal.receipts.length > 0) {
          receiptIds.push(...deal.receipts.map((r) => r.id))
        }
        if (deal.details) {
          for (const detail of deal.details) {
            if (detail.receipt_id) {
              receiptIds.push(detail.receipt_id)
            }
          }
        }
      }

      const uniqueReceiptIds = [...new Set(receiptIds)]

      // キャッシュ更新
      const mapping: JournalDocumentMapping = {
        journalId,
        dealId: deals.deals[0]?.id ?? null,
        receiptIds: uniqueReceiptIds,
        documentIds: [],
        syncedAt: new Date(),
        matchConfidence: 'medium',
      }
      this.setCache(journalId, mapping)

      this.log('info', 'Retrieved receipt IDs', {
        ...logCtx,
        journalId,
        receiptCount: uniqueReceiptIds.length,
      })

      return { success: true, data: uniqueReceiptIds }
    } catch (error) {
      this.log('error', 'Failed to get receipts by journal ID', {
        ...logCtx,
        journalId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return this.createError(
        ERROR_CODES.API_ERROR,
        error instanceof Error ? error.message : 'Failed to get receipts',
        logCtx
      )
    }
  }

  /**
   * 証憑IDから取引情報を逆引き
   *
   * @param companyId - 事業所ID
   * @param receiptId - 証憑ID
   * @param context - ログコンテキスト
   * @returns 取引IDと仕訳日付またはエラー
   */
  async getDealByReceiptId(
    companyId: number,
    receiptId: number,
    context?: LogContext
  ): Promise<Result<{ dealId: number | null; journalDate: string | null }, AppError>> {
    const logCtx: LogContext = {
      ...context,
      companyId,
      module: 'journal-receipt-mapping',
      operation: 'getDealByReceiptId',
    }

    try {
      // 入力バリデーション
      if (!receiptId || receiptId <= 0) {
        return this.createError(
          ERROR_CODES.INVALID_INPUT,
          'receiptId must be a positive number',
          logCtx
        )
      }

      const receipt = await this.client.getReceiptDetails(companyId, receiptId)

      if (!receipt.deal_id) {
        return { success: true, data: { dealId: null, journalDate: null } }
      }

      const deal = await this.client.getDeal(companyId, receipt.deal_id)

      this.log('info', 'Retrieved deal by receipt ID', {
        ...logCtx,
        receiptId,
        dealId: receipt.deal_id,
      })

      return {
        success: true,
        data: {
          dealId: receipt.deal_id,
          journalDate: deal.issue_date,
        },
      }
    } catch (error) {
      this.log('error', 'Failed to get deal by receipt ID', {
        ...logCtx,
        receiptId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return this.createError(
        ERROR_CODES.API_ERROR,
        error instanceof Error ? error.message : 'Failed to get deal',
        logCtx
      )
    }
  }

  /**
   * 指定期間の紐付けを一括同期
   *
   * @param companyId - 事業所ID
   * @param startDate - 開始日（YYYY-MM-DD）
   * @param endDate - 終了日（YYYY-MM-DD）
   * @param context - ログコンテキスト
   * @returns 同期結果
   */
  async syncMappings(
    companyId: number,
    startDate: string,
    endDate: string,
    context?: LogContext
  ): Promise<MappingSyncResult> {
    const logCtx: LogContext = {
      ...context,
      companyId,
      module: 'journal-receipt-mapping',
      operation: 'syncMappings',
    }

    const result: MappingSyncResult = {
      totalJournals: 0,
      totalDeals: 0,
      totalMappings: 0,
      newMappings: 0,
      errors: [],
      syncedAt: new Date(),
    }

    try {
      // 入力バリデーション
      if (!this.isValidDateString(startDate) || !this.isValidDateString(endDate)) {
        result.errors.push({
          error: 'Invalid date format. Use YYYY-MM-DD',
          code: ERROR_CODES.INVALID_INPUT,
        })
        return result
      }

      // データ取得
      const [journals, deals] = await Promise.all([
        this.client.getJournals(companyId, startDate, endDate, 1000, 0),
        this.client.getDeals(companyId, {
          company_id: companyId,
          start_issue_date: startDate,
          end_issue_date: endDate,
          limit: 1000,
        }),
      ])

      result.totalJournals = journals.meta.total_count
      result.totalDeals = deals.meta.total_count

      // 日付ごとにグループ化
      const dealsByDate = new Map<string, FreeeDeal[]>()
      for (const deal of deals.deals) {
        const date = deal.issue_date
        if (!dealsByDate.has(date)) {
          dealsByDate.set(date, [])
        }
        dealsByDate.get(date)!.push(deal)
      }

      // 並列処理でマッピング構築
      const journalBatches = this.chunkArray(journals.data, this.config.concurrency)

      for (const batch of journalBatches) {
        await Promise.allSettled(
          batch.map((journal) => this.processJournalMapping(journal, dealsByDate, result, logCtx))
        )
      }

      this.log('info', 'Sync completed', {
        ...logCtx,
        totalJournals: result.totalJournals,
        totalDeals: result.totalDeals,
        totalMappings: result.totalMappings,
        newMappings: result.newMappings,
        errorCount: result.errors.length,
      })

      return result
    } catch (error) {
      result.errors.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        code: ERROR_CODES.UNKNOWN,
      })

      this.log('error', 'Sync failed', {
        ...logCtx,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return result
    }
  }

  /**
   * 個別仕訳のマッピング処理
   */
  private async processJournalMapping(
    journal: FreeeJournal,
    dealsByDate: Map<string, FreeeDeal[]>,
    result: MappingSyncResult,
    logCtx: LogContext
  ): Promise<void> {
    try {
      const journalDate = journal.issue_date
      const matchingDeals = dealsByDate.get(journalDate) || []
      const journalAmount = this.calculateJournalAmount(journal)

      let matchedDealId: number | null = null
      const receiptIds: number[] = []

      for (const deal of matchingDeals) {
        if (deal.receipts && deal.receipts.length > 0) {
          receiptIds.push(...deal.receipts.map((r) => r.id))
        }
        if (deal.details) {
          for (const detail of deal.details) {
            if (detail.receipt_id) {
              receiptIds.push(detail.receipt_id)
            }
          }
        }

        const dealAmount = this.calculateDealAmount(deal)
        if (Math.abs(dealAmount - journalAmount) < 1 && journalAmount > 0 && !matchedDealId) {
          matchedDealId = deal.id
        }
      }

      const mapping: JournalDocumentMapping = {
        journalId: journal.id.toString(),
        dealId: matchedDealId,
        receiptIds: [...new Set(receiptIds)],
        documentIds: [],
        syncedAt: new Date(),
        matchConfidence: matchedDealId ? 'high' : 'low',
      }

      this.setCache(journal.id.toString(), mapping)
      result.totalMappings++
      if (matchedDealId) {
        result.newMappings++
      }
    } catch (error) {
      result.errors.push({
        journalId: journal.id?.toString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        code: ERROR_CODES.UNKNOWN,
      })
    }
  }

  /**
   * キャッシュにエントリを設定（サイズ制限あり）
   */
  private setCache(key: string, value: JournalDocumentMapping): void {
    if (this.mappingCache.size >= this.config.maxCacheSize) {
      const firstKey = this.mappingCache.keys().next().value
      if (firstKey) {
        this.mappingCache.delete(firstKey)
      }
    }
    this.mappingCache.set(key, value)
  }

  /**
   * 仕訳金額を計算
   */
  private calculateJournalAmount(journal: FreeeJournal): number {
    if (!journal.details || journal.details.length === 0) {
      return journal.amount ?? 0
    }

    const debit = journal.details.find((d) => d.entry_side === 'debit')
    return debit ? Math.abs(debit.amount) : 0
  }

  /**
   * 取引金額を計算
   */
  private calculateDealAmount(deal: FreeeDeal): number {
    if (!deal.details || deal.details.length === 0) {
      return deal.amount ?? 0
    }
    return deal.details.reduce((sum, detail) => sum + Math.abs(detail.amount), 0)
  }

  /**
   * 日付文字列のバリデーション
   */
  private isValidDateString(date: string): boolean {
    if (!date || typeof date !== 'string') return false
    const regex = /^\d{4}-\d{2}-\d{2}$/
    if (!regex.test(date)) return false
    const parsed = new Date(date)
    return !isNaN(parsed.getTime())
  }

  /**
   * 配列をチャンクに分割
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  /**
   * エラーオブジェクトを作成
   */
  private createError(
    code: string,
    message: string,
    context?: LogContext
  ): Result<never, AppError> {
    return {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        context,
      },
    }
  }

  /**
   * ログ出力
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (level === 'debug' && !this.config.debugMode) return

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        configVersion: this.configVersion,
      },
    }

    console[level === 'debug' ? 'log' : level](
      `[${logEntry.timestamp}] [${level.toUpperCase()}] ${message}`,
      context ? JSON.stringify(context) : ''
    )
  }
}

/**
 * デフォルトインスタンス
 */
export const journalReceiptMappingService = new JournalReceiptMappingService()
