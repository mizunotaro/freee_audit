'use client'

import { useState, useEffect, useCallback } from 'react'

interface Journal {
  id: string
  freeeJournalId: string
  entryDate: string
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType: string | null
  documentId: string | null
  document: { id: string; fileName: string; fileType: string } | null
  auditStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
  syncedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PASSED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  SKIPPED: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  PENDING: '未監査',
  PASSED: '合格',
  FAILED: '要確認',
  SKIPPED: 'スキップ',
}

export default function JournalsPage() {
  const [journals, setJournals] = useState<Journal[]>([])
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
    auditStatus: '',
  })

  const fetchJournals = useCallback(
    async (page = 1) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', '50')
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        if (filters.auditStatus) params.set('auditStatus', filters.auditStatus)

        const response = await fetch(`/api/audit/journals?${params}`)
        const data = await response.json()

        setJournals(data.data || [])
        setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 })
      } catch (error) {
        console.error('Failed to fetch journals:', error)
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchJournals(1)
  }, [fetchJournals])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">仕訳一覧 / Journal Entries</h1>

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
          <label className="mb-1 block text-sm font-medium text-gray-700">監査ステータス</label>
          <select
            value={filters.auditStatus}
            onChange={(e) => setFilters({ ...filters, auditStatus: e.target.value })}
            className="rounded border px-3 py-2"
          >
            <option value="">すべて</option>
            <option value="PENDING">未監査</option>
            <option value="PASSED">合格</option>
            <option value="FAILED">要確認</option>
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
                  <th className="px-4 py-3 text-left text-sm font-semibold">日付</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">摘要</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">借方科目</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">貸方科目</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">金額</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">消費税</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">証憑</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((journal) => (
                  <tr key={journal.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{journal.entryDate}</td>
                    <td className="px-4 py-3 text-sm">{journal.description}</td>
                    <td className="px-4 py-3 text-sm">{journal.debitAccount}</td>
                    <td className="px-4 py-3 text-sm">{journal.creditAccount}</td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatCurrency(journal.amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatCurrency(journal.taxAmount)}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {journal.document ? (
                        <span className="text-blue-600">📎 {journal.document.fileName}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded px-2 py-1 text-xs font-medium ${statusColors[journal.auditStatus]}`}
                      >
                        {statusLabels[journal.auditStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => fetchJournals(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                前へ
              </button>
              <span className="px-4 py-2">
                {pagination.page} / {pagination.totalPages} ({pagination.total}件)
              </span>
              <button
                onClick={() => fetchJournals(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="rounded border px-4 py-2 disabled:opacity-50"
              >
                次へ
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
