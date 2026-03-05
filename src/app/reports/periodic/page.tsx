'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Download, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface PeriodData {
  label: string
  fiscalYear: number
  startMonth: number
  endMonth: number
  balanceSheet: {
    totalAssets: number
    currentAssets: number
    fixedAssets: number
    totalLiabilities: number
    currentLiabilities: number
    fixedLiabilities: number
    equity: number
  }
  profitLoss: {
    revenue: number
    costOfSales: number
    grossProfit: number
    operatingIncome: number
    ordinaryIncome: number
    netIncome: number
  }
  cashFlow: {
    operatingCF: number
    investingCF: number
    financingCF: number
    freeCashFlow: number
  }
  kpis: {
    roe: number
    roa: number
    grossMargin: number
    operatingMargin: number
    currentRatio: number
    debtToEquity: number
  }
  endingCash: number
}

interface PeriodicReportData {
  periods: PeriodData[]
  summary: {
    revenueGrowth: number | null
    profitGrowth: number | null
    cashChange: number
    avgROE: number
    avgROA: number
    trendAnalysis: string
  }
}

const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`
  } else if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  } else if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toLocaleString()
}

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

const getTrendIcon = (value: number | null) => {
  if (value === null) return <Minus className="h-4 w-4 text-muted-foreground" />
  if (value > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
  if (value < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

export default function PeriodicReportPage() {
  const [report, setReport] = useState<PeriodicReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodType, setPeriodType] = useState<'3months' | '6months' | '12months'>('12months')
  const [includePreviousYear, setIncludePreviousYear] = useState(false)
  const [fiscalYearEndMonth, setFiscalYearEndMonth] = useState(12)

  useEffect(() => {
    fetchReport()
  }, [periodType, includePreviousYear, fiscalYearEndMonth])

  const fetchReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        periodType,
        includePreviousYear: includePreviousYear.toString(),
        fiscalYearEndMonth: fiscalYearEndMonth.toString(),
      })
      const res = await fetch(`/api/reports/periodic?${params}`)
      if (res.ok) {
        const data = await res.json()
        setReport(data)
      } else {
        toast.error('レポートの取得に失敗しました')
      }
    } catch (error) {
      console.error('Failed to fetch report:', error)
      toast.error('レポートの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        periodType,
        includePreviousYear: includePreviousYear.toString(),
        fiscalYearEndMonth: fiscalYearEndMonth.toString(),
        export: 'csv',
      })
      window.open(`/api/reports/periodic?${params}`, '_blank')
    } catch (error) {
      toast.error('エクスポートに失敗しました')
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

  return (
    <AppLayout>
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">多期間レポート</h1>
            <p className="text-muted-foreground">決算月基準の期間比較分析</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={fetchReport}>
              <RefreshCw className="mr-2 h-4 w-4" />
              更新
            </Button>
            <Button onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              CSV出力
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>レポート設定</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2">
                <Label>期間タイプ</Label>
                <Select
                  value={periodType}
                  onValueChange={(v) => setPeriodType(v as typeof periodType)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3months">3ヶ月</SelectItem>
                    <SelectItem value="6months">6ヶ月</SelectItem>
                    <SelectItem value="12months">12ヶ月</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>決算月</Label>
                <Select
                  value={fiscalYearEndMonth.toString()}
                  onValueChange={(v) => setFiscalYearEndMonth(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={m.toString()}>
                        {m}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="previous-year"
                  checked={includePreviousYear}
                  onCheckedChange={setIncludePreviousYear}
                />
                <Label htmlFor="previous-year">前年同期比較</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {report && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>売上成長率</CardDescription>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {report.summary.revenueGrowth !== null
                        ? `${report.summary.revenueGrowth.toFixed(1)}%`
                        : '-'}
                    </span>
                    {getTrendIcon(report.summary.revenueGrowth)}
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>利益成長率</CardDescription>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {report.summary.profitGrowth !== null
                        ? `${report.summary.profitGrowth.toFixed(1)}%`
                        : '-'}
                    </span>
                    {getTrendIcon(report.summary.profitGrowth)}
                  </div>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>キャッシュ増減</CardDescription>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">
                      {formatCurrency(report.summary.cashChange)}
                    </span>
                    {getTrendIcon(report.summary.cashChange)}
                  </div>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>トレンド分析</CardTitle>
                <CardDescription>{report.summary.trendAnalysis}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm">
                  平均ROE: <span className="font-medium">{report.summary.avgROE.toFixed(1)}%</span>/
                  平均ROA: <span className="font-medium">{report.summary.avgROA.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>損益計算書 (PL)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">項目</TableHead>
                        {report.periods.map((p) => (
                          <TableHead key={p.label} className="min-w-24 text-right">
                            {p.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: '売上高', key: 'revenue' as const },
                        { label: '売上原価', key: 'costOfSales' as const },
                        { label: '売上総利益', key: 'grossProfit' as const },
                        { label: '営業利益', key: 'operatingIncome' as const },
                        { label: '経常利益', key: 'ordinaryIncome' as const },
                        { label: '当期純利益', key: 'netIncome' as const },
                      ].map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {row.label}
                          </TableCell>
                          {report.periods.map((p) => (
                            <TableCell key={p.label} className="text-right">
                              {formatCurrency(p.profitLoss[row.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>貸借対照表 (BS)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">項目</TableHead>
                        {report.periods.map((p) => (
                          <TableHead key={p.label} className="min-w-24 text-right">
                            {p.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: '総資産', key: 'totalAssets' as const },
                        { label: '流動資産', key: 'currentAssets' as const },
                        { label: '固定資産', key: 'fixedAssets' as const },
                        { label: '総負債', key: 'totalLiabilities' as const },
                        { label: '純資産', key: 'equity' as const },
                      ].map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {row.label}
                          </TableCell>
                          {report.periods.map((p) => (
                            <TableCell key={p.label} className="text-right">
                              {formatCurrency(p.balanceSheet[row.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>キャッシュフロー (CF)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">項目</TableHead>
                        {report.periods.map((p) => (
                          <TableHead key={p.label} className="min-w-24 text-right">
                            {p.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: '営業CF', key: 'operatingCF' as const },
                        { label: '投資CF', key: 'investingCF' as const },
                        { label: '財務CF', key: 'financingCF' as const },
                        { label: 'フリーCF', key: 'freeCashFlow' as const },
                        { label: '期末現金', key: 'endingCash' as const, isPeriod: true },
                      ].map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {row.label}
                          </TableCell>
                          {report.periods.map((p) => (
                            <TableCell key={p.label} className="text-right">
                              {formatCurrency(
                                row.isPeriod
                                  ? p[row.key as 'endingCash']
                                  : p.cashFlow[row.key as keyof typeof p.cashFlow]
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>経営指標</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">指標</TableHead>
                        {report.periods.map((p) => (
                          <TableHead key={p.label} className="min-w-24 text-right">
                            {p.label}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: 'ROE', key: 'roe' as const, suffix: '%' },
                        { label: 'ROA', key: 'roa' as const, suffix: '%' },
                        { label: '売上総利益率', key: 'grossMargin' as const, suffix: '%' },
                        { label: '営業利益率', key: 'operatingMargin' as const, suffix: '%' },
                        { label: '流動比率', key: 'currentRatio' as const, suffix: '%' },
                        { label: 'D/E比率', key: 'debtToEquity' as const, suffix: '倍' },
                      ].map((row) => (
                        <TableRow key={row.key}>
                          <TableCell className="sticky left-0 bg-background font-medium">
                            {row.label}
                          </TableCell>
                          {report.periods.map((p) => (
                            <TableCell key={p.label} className="text-right">
                              {p.kpis[row.key]}
                              {row.suffix}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  )
}
