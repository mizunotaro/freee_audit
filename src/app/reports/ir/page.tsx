'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Plus, FileText, Calendar, Eye, Pencil, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { IRReportList, IRReportStatus, IRReportFilters, IRReportType } from '@/types/ir-report'

const REPORT_TYPE_LABELS: Record<IRReportType, string> = {
  annual: '年次報告書',
  quarterly: '四半期報告書',
  earnings_call: '決算説明会',
  sustainability: 'サステナビリティ報告書',
}

const STATUS_LABELS: Record<IRReportStatus, string> = {
  DRAFT: '下書き',
  REVIEW: 'レビュー中',
  PUBLISHED: '公開済み',
  ARCHIVED: 'アーカイブ',
}

const STATUS_COLORS: Record<IRReportStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  REVIEW: 'bg-blue-100 text-blue-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-yellow-100 text-yellow-800',
}

export default function IRReportsPage() {
  const [reports, setReports] = useState<IRReportList[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<IRReportFilters>({})
  const [deleteTarget, setDeleteTarget] = useState<IRReportList | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.reportType) params.append('reportType', filters.reportType)
      if (filters.fiscalYear) params.append('fiscalYear', String(filters.fiscalYear))
      if (filters.status) params.append('status', filters.status)
      if (filters.search) params.append('search', filters.search)

      const res = await fetchWithTimeout(`/api/ir/reports?${params.toString()}`, {
        timeout: 30000,
      })

      if (!res.ok) {
        throw new Error('レポートの取得に失敗しました')
      }

      const data = await res.json()
      setReports(data.reports || [])
    } catch (error) {
      console.error('Failed to fetch IR reports:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('レポートの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${deleteTarget.id}`, {
        method: 'DELETE',
        timeout: 30000,
      })

      if (!res.ok) throw new Error('削除に失敗しました')

      toast.success('レポートを削除しました')
      fetchReports()
    } catch (error) {
      console.error('Failed to delete report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('削除に失敗しました')
      }
    } finally {
      setDeleteTarget(null)
    }
  }

  const handlePublish = async (report: IRReportList) => {
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${report.id}/publish`, {
        method: 'POST',
        timeout: 30000,
      })

      if (!res.ok) throw new Error('公開に失敗しました')

      toast.success('レポートを公開しました')
      fetchReports()
    } catch (error) {
      console.error('Failed to publish report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('公開に失敗しました')
      }
    }
  }

  const currentYear = new Date().getFullYear()
  const fiscalYears = Array.from({ length: 6 }, (_, i) => currentYear - i)

  if (loading) {
    return (
      <AppLayout title="IRレポート">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 rounded bg-gray-200"></div>
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="IRレポート">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select
          value={filters.reportType || 'all'}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              reportType: value === 'all' ? undefined : (value as IRReportType),
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="レポート種別" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全種別</SelectItem>
            {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.fiscalYear?.toString() || 'all'}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              fiscalYear: value === 'all' ? undefined : parseInt(value),
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="年度" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全年度</SelectItem>
            {fiscalYears.map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}年度
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.status || 'all'}
          onValueChange={(value) =>
            setFilters({
              ...filters,
              status: value === 'all' ? undefined : (value as IRReportStatus),
            })
          }
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全ステータス</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto">
          <Link href="/reports/ir/new">
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">レポートがありません</h3>
          <p className="mt-2 text-sm text-gray-500">新しいIRレポートを作成してください</p>
          <Link href="/reports/ir/new" className="mt-4 inline-block">
            <Button>
              <Plus className="mr-1 h-4 w-4" />
              新規作成
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="overflow-hidden rounded-lg bg-white shadow transition-shadow hover:shadow-md"
            >
              <div className="border-b border-gray-100 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{report.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">{report.fiscalYear}年度</p>
                  </div>
                  <Badge className={STATUS_COLORS[report.status]}>
                    {STATUS_LABELS[report.status]}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="mr-1 h-4 w-4" />
                  {report.publishedAt
                    ? new Date(report.publishedAt).toLocaleDateString('ja-JP')
                    : '未公開'}
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/reports/ir/${report.id}/preview`}>
                    <Button variant="ghost" size="sm" title="プレビュー">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/reports/ir/${report.id}`}>
                    <Button variant="ghost" size="sm" title="編集">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Link>
                  {report.status === 'DRAFT' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="公開"
                      onClick={() => handlePublish(report)}
                    >
                      <Send className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    title="削除"
                    onClick={() => setDeleteTarget(report)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex justify-center gap-4">
        <Link href="/reports/ir/shareholders">
          <Button variant="outline">株主構成管理</Button>
        </Link>
        <Link href="/reports/ir/events">
          <Button variant="outline">IRイベント</Button>
        </Link>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>レポートの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」を削除しますか？ この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
