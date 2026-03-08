'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ArrowLeft, Download, Save, RefreshCw, CheckCircle, FileText } from 'lucide-react'

interface BoardReportSection {
  sectionType: string
  title: string
  content: string
  data?: string
  sortOrder: number
}

interface BoardReport {
  id: string
  fiscalYear: number
  month: number
  title: string
  summary: string | null
  sections: BoardReportSection[]
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PRESENTED'
  generatedAt: string | null
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  DRAFT: { label: '下書き', variant: 'secondary' },
  REVIEW: { label: 'レビュー中', variant: 'outline' },
  APPROVED: { label: '承認済み', variant: 'default' },
  PRESENTED: { label: '報告済み', variant: 'default' },
}

const SECTION_TITLES: Record<string, string> = {
  FINANCIAL_SUMMARY: '月次決算サマリー',
  BUDGET_VARIANCE: '予実分析',
  CASH_POSITION: 'キャッシュポジション',
  FUND_FLOW: '資金繰り',
  KEY_METRICS: '主要KPI',
  RISKS: 'リスク要因',
  OPPORTUNITIES: '機会・チャンス',
  LLM_ANALYSIS: 'AI分析による状況報告',
}

export default function BoardReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const reportId = params.id as string

  const [report, setReport] = useState<BoardReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editedSections, setEditedSections] = useState<Record<string, string>>({})
  const [editedSummary, setEditedSummary] = useState('')

  const fetchReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/board-reports/${reportId}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data.report)
        setEditedSummary(data.report?.summary || '')

        const sections: Record<string, string> = {}
        data.report?.sections?.forEach((s: BoardReportSection) => {
          sections[s.sectionType] = s.content
        })
        setEditedSections(sections)
      } else {
        toast.error('レポートが見つかりません')
        router.push('/board-reports')
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      toast.error('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [reportId, router])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const handleSave = async () => {
    if (!report) return

    setSaving(true)
    try {
      const res = await fetch(`/api/board-reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: editedSummary,
          sections: editedSections,
        }),
      })

      if (res.ok) {
        toast.success('保存しました')
        fetchReport()
      } else {
        toast.error('保存に失敗しました')
      }
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/board-reports/${reportId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        toast.success('ステータスを更新しました')
        fetchReport()
      }
    } catch {
      toast.error('ステータスの更新に失敗しました')
    }
  }

  const handleExportPDF = async () => {
    try {
      const res = await fetch(`/api/board-reports/${reportId}/export?format=pdf`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${report?.title || 'board-report'}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      toast.error('PDFエクスポートに失敗しました')
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-screen items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="flex min-h-screen items-center justify-center">
          <p>レポートが見つかりません</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/board-reports">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{report.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_LABELS[report.status]?.variant || 'default'}>
                {STATUS_LABELS[report.status]?.label || report.status}
              </Badge>
              {report.generatedAt && (
                <span className="text-sm text-muted-foreground">
                  生成日: {new Date(report.generatedAt).toLocaleDateString('ja-JP')}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              保存
            </Button>
            {report.status === 'DRAFT' && (
              <Button variant="secondary" onClick={() => handleStatusChange('REVIEW')}>
                <CheckCircle className="mr-2 h-4 w-4" />
                レビューへ
              </Button>
            )}
            {report.status === 'REVIEW' && (
              <Button onClick={() => handleStatusChange('APPROVED')}>
                <CheckCircle className="mr-2 h-4 w-4" />
                承認
              </Button>
            )}
            {report.status === 'APPROVED' && (
              <Button onClick={() => handleStatusChange('PRESENTED')}>
                <FileText className="mr-2 h-4 w-4" />
                報告済みにする
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>エグゼクティブサマリー</CardTitle>
            <CardDescription>レポートの要約</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              placeholder="サマリーを入力..."
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {report.sections
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((section) => (
            <Card key={section.sectionType}>
              <CardHeader>
                <CardTitle>{SECTION_TITLES[section.sectionType] || section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={editedSections[section.sectionType] || section.content}
                  onChange={(e) =>
                    setEditedSections({
                      ...editedSections,
                      [section.sectionType]: e.target.value,
                    })
                  }
                  className="min-h-[200px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          ))}
      </div>
    </AppLayout>
  )
}
