'use client'

import { useState, useEffect, useCallback } from 'react'

interface AuditResult {
  id: string
  journalId: string
  documentId: string | null
  status: 'PASSED' | 'FAILED' | 'ERROR'
  issues: Array<{
    field: string
    severity: 'error' | 'warning' | 'info'
    message: string
    messageEn: string
    expectedValue?: unknown
    actualValue?: unknown
  }>
  confidenceScore: number | null
  analyzedAt: string
  journal: {
    id: string
    freeeJournalId: string
    entryDate: string
    description: string
    debitAccount: string
    creditAccount: string
    amount: number
    taxAmount: number
  } | null
  document: { id: string; fileName: string; fileType: string } | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusColors: Record<string, string> = {
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  ERROR: 'bg-orange-100 text-orange-800',
}

const statusLabels: Record<string, string> = {
  PASSED: '合格',
  FAILED: '要確認',
  ERROR: 'エラー',
}

const severityColors: Record<string, string> = {
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
}

export default function ResultsPage() {
  const [results, setResults] = useState<AuditResult[]>([])
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
  })
  const [selectedResult, setSelectedResult] = useState<AuditResult | null>(null)

  const fetchResults = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', '50')
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        if (filters.status) params.set('status', filters.status)

        const response = await fetch(`/api/audit/results?${params}`)
        const data = await response.json()

        setResults(data.data || [])
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      } catch (error) {
        console.error('Failed to fetch audit results:', error)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchResults(1)
  }, [fetchResults])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">監査結果 / Audit Results</h1>

      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">開始日</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">終了日</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ステータス</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded border px-3 py-2"
          >
            <option value="">すべて</option>
            <option value="PASSED">合格</option>
            <option value="FAILED">要確認</option>
            <option value="ERROR">エラー</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center">読み込み中...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full border bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">分析日時</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">仕訳日付</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">摘要</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">金額</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">信頼度</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">ステータス</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">問題数</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">詳細</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      {new Date(result.analyzedAt).toLocaleString('ja-JP')}
                    </td>
                    <td className="px-4 py-3 text-sm">{result.journal?.entryDate || '-'}</td>
                    <td className="px-4 py-3 text-sm">{result.journal?.description || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {result.journal ? formatCurrency(result.journal.amount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {result.confidenceScore
                        ? `${Math.round(result.confidenceScore * 100)}%`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${statusColors[result.status]}`}
                      >
                        {statusLabels[result.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {result.issues.length > 0 && (
                        <span
                          className={
                            result.issues.some((i) => i.severity === 'error')
                              ? 'font-bold text-red-600'
                              : ''
                          }
                        >
                          {result.issues.length}
                        </span>
                      )}
                      {result.issues.length === 0 && <span className="text-gray-400">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedResult(result)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => fetchResults(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                前へ
              </button>
              <span className="px-4 py-2">
                {pagination.page} / {pagination.totalPages} ({pagination.total}件)
              </span>
              <button
                onClick={() => fetchResults(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}

      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-xl font-bold">監査結果詳細</h2>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">仕訳ID</p>
                  <p className="font-medium">{selectedResult.journal?.freeeJournalId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ステータス</p>
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusColors[selectedResult.status]}`}
                  >
                    {statusLabels[selectedResult.status]}
                  </span>
                </div>
              </div>

              {selectedResult.journal && (
                <div className="border-t pt-4">
                  <h3 className="mb-2 font-semibold">仕訳情報</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>
                      <span className="text-gray-500">日付:</span>{' '}
                      {selectedResult.journal.entryDate}
                    </p>
                    <p>
                      <span className="text-gray-500">金額:</span>{' '}
                      {formatCurrency(selectedResult.journal.amount)}
                    </p>
                    <p>
                      <span className="text-gray-500">借方:</span>{' '}
                      {selectedResult.journal.debitAccount}
                    </p>
                    <p>
                      <span className="text-gray-500">貸方:</span>{' '}
                      {selectedResult.journal.creditAccount}
                    </p>
                    <p className="col-span-2">
                      <span className="text-gray-500">摘要:</span>{' '}
                      {selectedResult.journal.description}
                    </p>
                  </div>
                </div>
              )}

              {selectedResult.issues.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="mb-2 font-semibold">検出された問題</h3>
                  <div className="space-y-2">
                    {selectedResult.issues.map((issue, index) => (
                      <div
                        key={index}
                        className={`rounded p-3 ${severityColors[issue.severity]} bg-gray-50`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="font-medium">
                            {issue.severity === 'error' && '❌'}
                            {issue.severity === 'warning' && '⚠️'}
                            {issue.severity === 'info' && 'ℹ️'}
                          </span>
                          <div>
                            <p className="font-medium">{issue.message}</p>
                            <p className="text-sm text-gray-500">{issue.messageEn}</p>
                            {issue.expectedValue !== undefined &&
                              issue.actualValue !== undefined && (
                                <p className="mt-1 text-sm">
                                  期待値: {String(issue.expectedValue)} / 実際:{' '}
                                  {String(issue.actualValue)}
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
