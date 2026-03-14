'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, Send, Download, Loader2, Sparkles, Save, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { IRReport, IRReportStatus, IRSectionType } from '@/types/ir-report'

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

export default function IREditPage() {
  const params = useParams()
  const reportId = params.id as string

  const [report, setReport] = useState<IRReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [publishDialog, setPublishDialog] = useState(false)

  const [editedSections, setEditedSections] = useState<Map<string, string>>(new Map())

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

  const handleSaveSection = async (sectionId: string) => {
    const content = editedSections.get(sectionId)
    if (content === undefined) return

    setSaving(true)
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${reportId}/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        timeout: 30000,
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      toast.success('セクションを保存しました')
      fetchReport()
      setEditedSections((prev) => {
        const newMap = new Map(prev)
        newMap.delete(sectionId)
        return newMap
      })
    } catch (error) {
      console.error('Failed to save section:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('保存に失敗しました')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleGenerateSection = async (sectionType: IRSectionType) => {
    setGenerating(sectionType)
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${reportId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType }),
        timeout: 60000,
      })

      if (!res.ok) throw new Error('生成に失敗しました')

      await res.json()
      toast.success('コンテンツを生成しました')
      fetchReport()
    } catch (error) {
      console.error('Failed to generate content:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('生成に失敗しました')
      }
    } finally {
      setGenerating(null)
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      const res = await fetchWithTimeout(`/api/ir/reports/${reportId}/publish`, {
        method: 'POST',
        timeout: 30000,
      })

      if (!res.ok) throw new Error('公開に失敗しました')

      toast.success('レポートを公開しました')
      setPublishDialog(false)
      fetchReport()
    } catch (error) {
      console.error('Failed to publish report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('公開に失敗しました')
      }
    } finally {
      setSaving(false)
    }
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
      <AppLayout title="IRレポート編集">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-64 rounded bg-gray-200"></div>
        </div>
      </AppLayout>
    )
  }

  if (!report) {
    return (
      <AppLayout title="IRレポート編集">
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">レポートが見つかりません</p>
          <Link href="/reports/ir">
            <Button className="mt-4">一覧に戻る</Button>
          </Link>
        </div>
      </AppLayout>
    )
  }

  const sections = report.sections.sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <AppLayout title="IRレポート編集">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/reports/ir"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          一覧に戻る
        </Link>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[report.status]}>{STATUS_LABELS[report.status]}</Badge>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{report.title}</h1>
          <p className="text-sm text-gray-500">{report.fiscalYear}年度</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/reports/ir/${reportId}/preview`}>
            <Button variant="outline">
              <Eye className="mr-1 h-4 w-4" />
              プレビュー
            </Button>
          </Link>
          <Button variant="outline" onClick={() => handleExport('pdf')}>
            <Download className="mr-1 h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" onClick={() => handleExport('html')}>
            <Download className="mr-1 h-4 w-4" />
            HTML
          </Button>
          {report.status === 'DRAFT' && (
            <Button onClick={() => setPublishDialog(true)}>
              <Send className="mr-1 h-4 w-4" />
              公開
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue={sections[0]?.id || 'overview'} className="space-y-4">
            <TabsList className="flex-wrap">
              {sections.map((section) => (
                <TabsTrigger key={section.id} value={section.id}>
                  {SECTION_TYPE_LABELS[section.sectionType]}
                </TabsTrigger>
              ))}
            </TabsList>

            {sections.map((section) => (
              <TabsContent key={section.id} value={section.id}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{section.title}</CardTitle>
                        <CardDescription>
                          {SECTION_TYPE_LABELS[section.sectionType]}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGenerateSection(section.sectionType)}
                        disabled={generating === section.sectionType}
                      >
                        {generating === section.sectionType ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-4 w-4" />
                        )}
                        AI生成
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={editedSections.get(section.id) ?? section.content ?? ''}
                      onChange={(e) =>
                        setEditedSections((prev) => {
                          const newMap = new Map(prev)
                          newMap.set(section.id, e.target.value)
                          return newMap
                        })
                      }
                      rows={12}
                      className="font-mono text-sm"
                      placeholder="コンテンツを入力してください"
                    />
                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => handleSaveSection(section.id)}
                        disabled={saving || editedSections.get(section.id) === undefined}
                      >
                        {saving ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-1 h-4 w-4" />
                        )}
                        保存
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">セクション一覧</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sections.map((section) => (
                  <div key={section.id} className="flex items-center rounded-lg border p-2">
                    <GripVertical className="mr-2 h-4 w-4 text-gray-400" />
                    <span className="text-sm">{SECTION_TYPE_LABELS[section.sectionType]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">メタデータ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">作成日</span>
                <span>{new Date(report.createdAt).toLocaleDateString('ja-JP')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">更新日</span>
                <span>{new Date(report.updatedAt).toLocaleDateString('ja-JP')}</span>
              </div>
              {report.publishedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">公開日</span>
                  <span>{new Date(report.publishedAt).toLocaleDateString('ja-JP')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={publishDialog} onOpenChange={setPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>レポートの公開</AlertDialogTitle>
            <AlertDialogDescription>
              このレポートを公開しますか？ 公開後も編集は可能です。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              公開
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
