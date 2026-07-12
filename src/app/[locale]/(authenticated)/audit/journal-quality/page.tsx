'use client'

import { useState, useEffect, useCallback } from 'react'

type FlagKind = 'duplicate' | 'unbalanced'
type FlagSeverity = 'info' | 'warning'

interface JournalFlag {
  kind: FlagKind
  severity: FlagSeverity
  reason: string
}

interface QualityJournal {
  id: string
  freeeJournalId: string
  entryDate: string
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  flags: JournalFlag[]
}

interface QualitySummary {
  total: number
  flagged: number
  duplicateGroups: number
  unbalancedEntries: number
  hasIssues: boolean
}

type FlagFilter = 'all' | 'flagged' | 'duplicate' | 'unbalanced' | 'clean'

const flagKindLabel: Record<FlagKind, string> = {
  duplicate: '重複',
  unbalanced: '不整合',
}

const filterOptions: ReadonlyArray<{ value: FlagFilter; label: string }> = [
  { value: 'all', label: 'すべて' },
  { value: 'flagged', label: 'フラグあり' },
  { value: 'duplicate', label: '重複' },
  { value: 'unbalanced', label: '不整合' },
  { value: 'clean', label: 'フラグなし' },
]

function matchesFilter(journal: QualityJournal, filter: FlagFilter): boolean {
  switch (filter) {
    case 'flagged':
      return journal.flags.length > 0
    case 'clean':
      return journal.flags.length === 0
    case 'duplicate':
      return journal.flags.some((f) => f.kind === 'duplicate')
    case 'unbalanced':
      return journal.flags.some((f) => f.kind === 'unbalanced')
    default:
      return true
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)

export default function JournalQualityPage() {
  const [journals, setJournals] = useState<QualityJournal[]>([])
  const [summary, setSummary] = useState<QualitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FlagFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchQuality = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/journal-quality')
      if (!response.ok) {
        throw new Error('データ品質の取得に失敗しました')
      }
      const data = await response.json()
      setJournals(data.data || [])
      setSummary(data.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ品質の取得に失敗しました')
      setJournals([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuality()
  }, [fetchQuality])

  const filtered = journals.filter((j) => matchesFilter(j, filter))
  const selected = journals.find((j) => j.id === selectedId) ?? null

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">データ品質フラグ</h1>
      <p className="mb-6 text-sm text-gray-600">
        仕訳データの品質検査（重複・不整合）を読み取り専用で一覧表示します。判定ロジックは監査モジュールとは独立したフラグです。
      </p>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-700"
        >
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded bg-gray-100 px-3 py-1">総数: {summary.total}件</span>
          <span className="rounded bg-yellow-100 px-3 py-1 text-yellow-800">
            フラグあり: {summary.flagged}件
          </span>
          <span className="rounded bg-gray-100 px-3 py-1">
            重複グループ: {summary.duplicateGroups}
          </span>
          <span className="rounded bg-gray-100 px-3 py-1">
            不整合: {summary.unbalancedEntries}件
          </span>
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="dq-filter" className="text-sm font-medium text-gray-700">
          フィルター
        </label>
        <select
          id="dq-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FlagFilter)}
          className="rounded border px-3 py-2"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{filtered.length}件</span>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500">読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-gray-500">データがありません</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border bg-white">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">日付</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">摘要</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">借方科目</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">貸方科目</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">金額</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">フラグ</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">詳細</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((journal) => (
                <tr key={journal.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{journal.entryDate}</td>
                  <td className="px-4 py-3 text-sm">{journal.description}</td>
                  <td className="px-4 py-3 text-sm">{journal.debitAccount}</td>
                  <td className="px-4 py-3 text-sm">{journal.creditAccount}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatCurrency(journal.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {journal.flags.length === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <span className="flex flex-wrap justify-center gap-1">
                        {journal.flags.map((flag, idx) => (
                          <span
                            key={`${flag.kind}-${idx}`}
                            className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800"
                          >
                            {flagKindLabel[flag.kind]}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => setSelectedId(journal.id)}
                      aria-label={`${journal.description} の詳細`}
                      className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
                    >
                      詳細
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <section
          aria-label="仕訳詳細"
          className="mt-6 rounded border border-gray-300 bg-gray-50 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">仕訳詳細</h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="rounded border px-3 py-1 text-xs hover:bg-gray-100"
            >
              閉じる
            </button>
          </div>
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-gray-500">日付</dt>
              <dd>{selected.entryDate}</dd>
            </div>
            <div>
              <dt className="text-gray-500">摘要</dt>
              <dd>{selected.description}</dd>
            </div>
            <div>
              <dt className="text-gray-500">借方科目</dt>
              <dd>{selected.debitAccount}</dd>
            </div>
            <div>
              <dt className="text-gray-500">貸方科目</dt>
              <dd>{selected.creditAccount}</dd>
            </div>
            <div>
              <dt className="text-gray-500">金額</dt>
              <dd>{formatCurrency(selected.amount)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">税額</dt>
              <dd>{formatCurrency(selected.taxAmount)}</dd>
            </div>
          </dl>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">データ品質フラグ</h3>
          {selected.flags.length === 0 ? (
            <p className="text-sm text-gray-500">この仕訳にフラグはありません</p>
          ) : (
            <ul className="space-y-1">
              {selected.flags.map((flag, idx) => (
                <li key={`${flag.kind}-${idx}`} className="flex items-center gap-2 text-sm">
                  <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    {flagKindLabel[flag.kind]}
                  </span>
                  <span>{flag.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
