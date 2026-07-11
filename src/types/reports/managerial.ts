/**
 * 管理会計（CVP分析・予実ブリッジ）向け UI 表示型
 *
 * 注意: これらの型は API レスポンスの表示契約のみを定義する。
 * 限界利益・損益分岐点などの計算式は本ファイルではなく
 * src/services/budget/managerial-accounting.ts に存在する（UI 層に計算式を埋め込まない）。
 */

/** 限界利益率などが算出不可の場合の表示用フラグを含む管理会計指標 */
export interface ManagerialMetrics {
  /** 売上高 */
  revenue: number
  /** 変動費（売上原価を変動費とみなす簡易分類） */
  variableCosts: number
  /** 固定費（販売管理費を固定費とみなす簡易分類） */
  fixedCosts: number
  /** 限界利益 = 売上高 − 変動費 */
  contributionMargin: number
  /** 限界利益率（%）。売上高が 0 の場合は 0 */
  contributionMarginRatio: number
  /** 損益分岐点売上高。限界利益率 <= 0 の場合は null（達成不可） */
  breakEvenSales: number | null
  /** 安全余裕額（売上高 − 損益分岐点）。損益分岐点が null の場合は null */
  marginOfSafetySales: number | null
  /** 安全余裕率（%）。算出不可の場合は null */
  marginOfSafetyRatio: number | null
  /** 営業利益 = 限界利益 − 固定費 */
  operatingIncome: number
}

/** 予算→実績のブリッチ（ウォーターフォール）を構成する個別差異要因 */
export interface VarianceBridgeDriver {
  /** 表示名（例: 売上高差異） */
  label: string
  /** 符号付き金額。正=橋掛け指標を増加、負=減少 */
  amount: number
  /** P&L 区分（色分け・内訳表示用） */
  category: 'revenue' | 'cost_of_sales' | 'sga_expense'
}

/** 予算から実績への差異ブリッジ全体 */
export interface VarianceBridge {
  /** 開始点の表示名（例: 営業利益（予算）） */
  startLabel: string
  /** 開始値 */
  start: number
  /** 差異要因（符号付き） */
  drivers: VarianceBridgeDriver[]
  /** 終了点の表示名（例: 営業利益（実績）） */
  endLabel: string
  /** 終了値 */
  end: number
  /** start + Σdrivers.amount と end の差（丸め誤差以外は 0 になるはず） */
  reconciliationGap: number
}

/** /api/reports/budget/managerial のレスポンス */
export interface ManagerialReportResponse {
  fiscalYear: number
  month: number
  metrics: ManagerialMetrics | null
  bridge: VarianceBridge | null
}
