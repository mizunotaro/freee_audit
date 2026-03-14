'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Download, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { IRReport, IRReportStatus, IRSectionType } from '@/types/ir-report'

const STATUS_LABELS: Record<IRReportStatus, string> = {
  DRAFT: '下書き',
  REVIEW: 'レビュー中',
  PUBLISHED: '公開済み',
  ARCHIVED: 'アーカイブ',
}

const SECTION_TYPE_LABELS: Record<IRSectionType, string> = {
  overview: '会社概要',
  business_summary: '事業概要',
  financial_summary: '財務ハイライト',
  segment_info: 'セグメント情報',
  risk_factors: 'リスク要因',
  governance: 'コーポレートガバナンス',
  shareholder_info: '株主情報',
  dividend_policy: '配当政策',
  future_outlook: '将来展望',
  custom: 'カスタム',
}

export default function IRPreviewPage() {
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<IRReport | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${reportId}`, {
        timeout: 30000,
      })

      if (!res.ok) {
        throw new Error('レポートの取得に失敗しました')
      }

      const data = await res.json()
      setReport(data)
    } catch (error) {
      console.error('Failed to fetch report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('レポートの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handlePrint = () => {
    window.print()
  }

  const handleExport = async (format: 'pdf' | 'html') => {
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${reportId}/export?format=${format}`, {
        timeout: 60000,
      })

      if (!res.ok) throw new Error('エクスポートに失敗しました')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${report?.title || 'report'}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('エクスポートしました')
    } catch (error) {
      console.error('Failed to export report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('エクスポートに失敗しました')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="mx-auto max-w-4xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-1/4 rounded bg-gray-200"></div>
            <div className="h-64 rounded bg-gray-200"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="mx-auto max-w-4xl p-8">
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">レポートが見つかりません</p>
            <Link href="/reports/ir">
              <Button className="mt-4">一覧に戻る</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const sections = report.sections.sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="sticky top-0 z-10 border-b bg-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link
            href="/reports/ir"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            一覧に戻る
          </Link>
          <div className="flex items-center gap-2">
            <Badge>{STATUS_LABELS[report.status]}</Badge>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="mr-1 h-4 w-4" />
              印刷
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
              <Download className="mr-1 h-4 w-4" />
              PDF
            </Button>
            <Link href={`/reports/ir/${reportId}`}>
              <Button size="sm">
                <Pencil className="mr-1 h-4 w-4" />
                編集
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl p-8 print:p-0">
        <div className="rounded-lg bg-white p-8 shadow print:shadow-none">
          <header className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900">{report.title}</h1>
            <p className="mt-2 text-lg text-gray-500">{report.fiscalYear}年度</p>
            {report.summary && (
              <p className="mx-auto mt-4 max-w-2xl text-gray-600">{report.summary}</p>
            )}
            {report.publishedAt && (
              <p className="mt-2 text-sm text-gray-400">
                公開日: {new Date(report.publishedAt).toLocaleDateString('ja-JP')}
              </p>
            )}
          </header>

          <Separator className="my-8" />

          <nav className="mb-8 print:hidden">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">目次</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {sections.map((section, index) => (
                    <li key={section.id}>
                      <a
                        href={`#section-${section.id}`}
                        className="text-primary-600 hover:underline"
                      >
                        {index + 1}. {SECTION_TYPE_LABELS[section.sectionType]}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </nav>

          <div className="space-y-8">
            {sections.map((section, index) => (
              <section key={section.id} id={`section-${section.id}`}>
                <h2 className="mb-4 text-xl font-bold text-gray-900">
                  {index + 1}. {section.title}
                </h2>
                <div className="prose prose-gray max-w-none">
                  {section.content ? (
                    <div className="whitespace-pre-wrap text-gray-700">{section.content}</div>
                  ) : (
                    <p className="italic text-gray-400">コンテンツがありません</p>
                  )}
                </div>
                {index < sections.length - 1 && <Separator className="mt-8" />}
              </section>
            ))}
          </div>

          <footer className="mt-12 border-t pt-8 text-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} All Rights Reserved.</p>
          </footer>
        </div>
      </div>
    </div>
  )
}
