'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, FileText, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface BusinessReportData {
  fiscalYear: number
  companyName: string
  businessOverview: string
  businessEnvironment: string
  managementPolicy: string
  issuesAndRisks: string
  financialHighlights: string
  researchAndDevelopment: string
  corporateGovernance: string
}

const defaultReportData: BusinessReportData = {
  fiscalYear: new Date().getFullYear(),
  companyName: '',
  businessOverview: '',
  businessEnvironment: '',
  managementPolicy: '',
  issuesAndRisks: '',
  researchAndDevelopment: '',
  corporateGovernance: '',
  financialHighlights: '',
}

export default function BusinessReportPage() {
  const [reportData, setReportData] = useState<BusinessReportData>(defaultReportData)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleInputChange = (field: keyof BusinessReportData, value: string | number) => {
    setReportData((prev) => ({ ...prev, [field]: value }))
  }

  const handleGenerateWithAI = async (section: keyof BusinessReportData) => {
    setGenerating(true)
    try {
      const res = await fetch('/api/reports/business/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section,
          companyName: reportData.companyName,
          fiscalYear: reportData.fiscalYear,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReportData((prev) => ({ ...prev, [section]: data.content }))
        toast.success('AIによる生成が完了しました')
      } else {
        throw new Error('Failed to generate content')
      }
    } catch (error) {
      console.error('Error generating content:', error)
      toast.error('生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportPDF = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports/business/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `business_report_${reportData.fiscalYear}.pdf`
        a.click()
        window.URL.revokeObjectURL(url)
        toast.success('PDFをダウンロードしました')
      } else {
        throw new Error('Failed to export PDF')
      }
    } catch (error) {
      console.error('Error exporting PDF:', error)
      toast.error('PDFのエクスポートに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const sections: Array<{ key: keyof BusinessReportData; title: string; description: string }> = [
    {
      key: 'businessOverview',
      title: '1. 事業の概要',
      description: '会社の主な事業内容、主要製品・サービス、市場ポジションなど',
    },
    {
      key: 'businessEnvironment',
      title: '2. 経営環境',
      description: '業界の動向、競合状況、法規制、経済情勢など',
    },
    {
      key: 'managementPolicy',
      title: '3. 経営方針',
      description: '経営理念、中長期戦略、成長目標など',
    },
    {
      key: 'issuesAndRisks',
      title: '4. 課題とリスク',
      description: '直面している課題、潜在的リスクと対策',
    },
    {
      key: 'financialHighlights',
      title: '5. 財務ハイライト',
      description: '売上高、利益、キャッシュフロー等の主要財務指標',
    },
    {
      key: 'researchAndDevelopment',
      title: '6. 研究開発活動',
      description: 'R&D投資、技術開発の状況、知的財産戦略など',
    },
    {
      key: 'corporateGovernance',
      title: '7. 企業統治',
      description: 'コーポレートガバナンス体制、内部統制、コンプライアンスなど',
    },
  ]

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">事業報告書作成</h1>
          <p className="text-muted-foreground">経団連ひな型に基づく事業報告書</p>
        </div>
        <Button onClick={handleExportPDF} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          {loading ? 'エクスポート中...' : 'PDFエクスポート'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="companyName">会社名</Label>
            <Input
              id="companyName"
              value={reportData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="株式会社○○"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiscalYear">事業年度</Label>
            <Select
              value={reportData.fiscalYear.toString()}
              onValueChange={(v) => handleInputChange('fiscalYear', parseInt(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2023, 2024, 2025, 2026].map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年度
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleGenerateWithAI(section.key)}
                  disabled={generating || !reportData.companyName}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  AI生成
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={reportData[section.key]}
                onChange={(e) => handleInputChange(section.key, e.target.value)}
                rows={6}
                placeholder={section.description}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
