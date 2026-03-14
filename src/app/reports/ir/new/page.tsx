'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { IRSectionType, IRReportType, CreateIRReportData } from '@/types/ir-report'

const REPORT_TEMPLATES = [
  { id: 'annual', name: '年次レポート', description: '決算短信・有価証券報告書ベース' },
  { id: 'quarterly', name: '四半期レポート', description: '四半期決算説明資料ベース' },
  { id: 'sustainability', name: 'サステナビリティレポート', description: 'ESG・CSR情報を中心に' },
  { id: 'integrated', name: '統合報告書', description: '財務・非財務情報を統合' },
  { id: 'custom', name: 'カスタム', description: 'テンプレートから選択して作成' },
]

const SECTION_TYPES: { value: IRSectionType; label: string }[] = [
  { value: 'overview', label: '会社概要' },
  { value: 'financial_summary', label: '財務ハイライト' },
  { value: 'business_summary', label: '事業戦略' },
  { value: 'future_outlook', label: '市場展望' },
  { value: 'risk_factors', label: 'リスク要因' },
  { value: 'governance', label: 'コーポレートガバナンス' },
  { value: 'shareholder_info', label: '株主情報' },
  { value: 'custom', label: 'よくある質問' },
]

export default function NewIRReportPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('annual')
  const [selectedSections, setSelectedSections] = useState<IRSectionType[]>([
    'overview',
    'financial_summary',
    'business_summary',
  ])

  const currentYear = new Date().getFullYear()
  const fiscalYears = Array.from({ length: 6 }, (_, i) => currentYear - i)
  const quarters = [
    { value: 'Q1', label: '第1四半期' },
    { value: 'Q2', label: '第2四半期' },
    { value: 'Q3', label: '第3四半期' },
    { value: 'Q4', label: '通期' },
  ]

  const [formData, setFormData] = useState({
    title: '',
    fiscalYear: currentYear.toString(),
    quarter: 'Q4',
    summary: '',
  })

  const handleSectionToggle = (section: IRSectionType) => {
    setSelectedSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('タイトルを入力してください')
      return
    }

    if (selectedSections.length === 0) {
      toast.error('セクションを少なくとも1つ選択してください')
      return
    }

    setLoading(true)

    try {
      const data: CreateIRReportData = {
        companyId: 'default',
        reportType: (selectedTemplate || 'annual') as IRReportType,
        fiscalYear: parseInt(formData.fiscalYear),
        title: formData.title,
        summary: formData.summary || undefined,
        quarter: formData.quarter ? parseInt(formData.quarter) : undefined,
      }

      const res = await fetchWithTimeout('/api/ir/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 30000,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || '作成に失敗しました')
      }

      const result = await res.json()
      toast.success('レポートを作成しました')
      router.push(`/reports/ir/${result.id}`)
    } catch (error) {
      console.error('Failed to create report:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error(error instanceof Error ? error.message : '作成に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout title="IRレポート新規作成">
      <div className="mb-6">
        <Link
          href="/reports/ir"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          一覧に戻る
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>基本情報</CardTitle>
            <CardDescription>レポートの基本情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例: 2025年度 決算説明資料"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fiscalYear">年度 *</Label>
                <Select
                  value={formData.fiscalYear}
                  onValueChange={(value) => setFormData({ ...formData, fiscalYear: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="年度を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {fiscalYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}年度
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quarter">四半期 *</Label>
                <Select
                  value={formData.quarter}
                  onValueChange={(value) => setFormData({ ...formData, quarter: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="四半期を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {quarters.map((q) => (
                      <SelectItem key={q.value} value={q.value}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">テンプレート</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="テンプレートを選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TEMPLATES.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">概要</Label>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="レポートの概要を入力（任意）"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>セクション選択</CardTitle>
            <CardDescription>含めるセクションを選択してください</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {SECTION_TYPES.map((section) => (
                <label
                  key={section.value}
                  className={`flex cursor-pointer items-center rounded-lg border p-3 transition-colors ${
                    selectedSections.includes(section.value)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selectedSections.includes(section.value)}
                    onChange={() => handleSectionToggle(section.value)}
                  />
                  <div
                    className={`mr-3 h-4 w-4 rounded border ${
                      selectedSections.includes(section.value)
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-gray-300'
                    } flex items-center justify-center`}
                  >
                    {selectedSections.includes(section.value) && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{section.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {selectedTemplate !== 'custom' && (
          <Card>
            <CardHeader>
              <CardTitle>テンプレートプレビュー</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-600">
                  {REPORT_TEMPLATES.find((t) => t.id === selectedTemplate)?.description}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/reports/ir">
            <Button type="button" variant="outline">
              キャンセル
            </Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            作成
          </Button>
        </div>
      </form>
    </AppLayout>
  )
}
