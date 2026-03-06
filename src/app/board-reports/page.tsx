'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, FileText, RefreshCw, Download, Eye, ArrowLeft } from 'lucide-react'

interface BoardReport {
  id: string
  fiscalYear: number
  month: number
  title: string
  status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PRESENTED'
  generatedAt: string | null
  presentedAt: string | null
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

export default function BoardReportsPage() {
  const [reports, setReports] = useState<BoardReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<string>('all')

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/board-reports')
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      toast.error('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateReport = async () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth() + 1

    try {
      const res = await fetch('/api/board-reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear: year, month }),
      })

      if (res.ok) {
        const data = await res.json()
        toast.success('レポートを生成しました')
        window.location.href = `/board-reports/${data.report.id}`
      } else {
        const data = await res.json()
        toast.error(data.error || 'レポートの生成に失敗しました')
      }
    } catch (error) {
      toast.error('レポートの生成に失敗しました')
    }
  }

  const filteredReports =
    selectedYear === 'all'
      ? reports
      : reports.filter((r) => r.fiscalYear.toString() === selectedYear)

  const years = [...new Set(reports.map((r) => r.fiscalYear))].sort((a, b) => b - a)

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-screen items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="container mx-auto space-y-6 py-6">
        <Link href="/" className="mb-4 flex items-center text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-2 h-4 w-4" />
          トップページに戻る
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">取締役会報告資料</h1>
            <p className="text-muted-foreground">月次決算の統合レポート管理</p>
          </div>
          <Button onClick={handleGenerateReport}>
            <Plus className="mr-2 h-4 w-4" />
            レポートを生成
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>レポート一覧</CardTitle>
                <CardDescription>過去の取締役会報告資料</CardDescription>
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="年度でフィルタ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">すべての年度</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}年度
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredReports.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">レポートがありません</p>
                <Button className="mt-4" onClick={handleGenerateReport}>
                  最初のレポートを生成
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>タイトル</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead>生成日</TableHead>
                    <TableHead>報告日</TableHead>
                    <TableHead className="text-right">アクション</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <Link
                          href={`/board-reports/${report.id}`}
                          className="font-medium hover:underline"
                        >
                          {report.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_LABELS[report.status]?.variant || 'default'}>
                          {STATUS_LABELS[report.status]?.label || report.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.generatedAt
                          ? new Date(report.generatedAt).toLocaleDateString('ja-JP')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {report.presentedAt
                          ? new Date(report.presentedAt).toLocaleDateString('ja-JP')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/board-reports/${report.id}`}>
                              <Eye className="mr-1 h-4 w-4" />
                              表示
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
