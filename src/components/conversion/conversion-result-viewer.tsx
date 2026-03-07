'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { BalanceSheetTable } from './balance-sheet-table'
import { ProfitLossTable } from './profit-loss-table'
import { CashFlowTable } from './cash-flow-table'
import type { ConversionResult } from '@/types/conversion'

interface ConversionResultViewerProps {
  result: ConversionResult
  projectId: string
}

export function ConversionResultViewer({ result, projectId }: ConversionResultViewerProps) {
  const [activeTab, setActiveTab] = useState('bs')

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      const res = await fetch(`/api/conversion/export/${projectId}?format=${format}`)
      if (res.ok) {
        const data = await res.json()
        window.open(data.data.fileUrl, '_blank')
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}分${secs}秒`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>変換結果</CardTitle>
              <CardDescription>
                変換完了: {new Date(result.conversionDate).toLocaleString('ja-JP')}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')}>
                <Download className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">変換所要時間</div>
              <div className="text-xl font-bold">{formatDuration(result.conversionDurationMs)}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">変換仕訳数</div>
              <div className="text-xl font-bold">{result.journalConversions?.length || 0}</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">警告</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{result.warnings.length}</span>
                {result.warnings.length > 0 && (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                )}
              </div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="text-sm text-muted-foreground">エラー</div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{result.errors.length}</span>
                {result.errors.length === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result.warnings.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              警告 ({result.warnings.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.warnings.map((warning, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-yellow-800">
                  <Badge variant="outline" className="shrink-0 border-yellow-600 text-yellow-800">
                    {warning.code}
                  </Badge>
                  {warning.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.errors.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              エラー ({result.errors.length}件)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.errors.map((error, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-destructive">
                  <Badge variant="destructive" className="shrink-0">
                    {error.code}
                  </Badge>
                  {error.message}
                  {error.affectedItem && (
                    <span className="text-muted-foreground">({error.affectedItem})</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="bs">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            貸借対照表
          </TabsTrigger>
          <TabsTrigger value="pl">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            損益計算書
          </TabsTrigger>
          <TabsTrigger value="cf">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            キャッシュフロー
          </TabsTrigger>
          <TabsTrigger value="journals">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            仕訳一覧
          </TabsTrigger>
          {result.adjustingEntries && result.adjustingEntries.length > 0 && (
            <TabsTrigger value="adjustments">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              調整仕訳
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="bs" className="mt-4">
          {result.balanceSheet ? (
            <BalanceSheetTable data={result.balanceSheet} showSource />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                貸借対照表データがありません
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pl" className="mt-4">
          {result.profitLoss ? (
            <ProfitLossTable data={result.profitLoss} showSource />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                損益計算書データがありません
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cf" className="mt-4">
          {result.cashFlow ? (
            <CashFlowTable data={result.cashFlow} showSource />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                キャッシュフロー計算書データがありません
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="journals" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>変換済み仕訳一覧</CardTitle>
              <CardDescription>
                {result.journalConversions?.length || 0}件の仕訳が変換されました
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.journalConversions && result.journalConversions.length > 0 ? (
                <div className="max-h-[600px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b">
                        <th className="p-2 text-left">日付</th>
                        <th className="p-2 text-left">摘要</th>
                        <th className="p-2 text-left">ソース科目</th>
                        <th className="p-2 text-left">ターゲット科目</th>
                        <th className="p-2 text-right">借方</th>
                        <th className="p-2 text-right">貸方</th>
                        <th className="p-2 text-center">信頼度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.journalConversions.slice(0, 100).map((journal, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">
                            {new Date(journal.sourceDate).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="max-w-[200px] truncate p-2">
                            {journal.sourceDescription}
                          </td>
                          <td className="p-2">
                            {journal.lines.map((line, i) => (
                              <div key={i}>{line.sourceAccountCode}</div>
                            ))}
                          </td>
                          <td className="p-2">
                            {journal.lines.map((line, i) => (
                              <div key={i}>{line.targetAccountCode}</div>
                            ))}
                          </td>
                          <td className="p-2 text-right">
                            {journal.lines.map((line, i) => (
                              <div key={i}>
                                {line.debitAmount > 0 ? line.debitAmount.toLocaleString() : ''}
                              </div>
                            ))}
                          </td>
                          <td className="p-2 text-right">
                            {journal.lines.map((line, i) => (
                              <div key={i}>
                                {line.creditAmount > 0 ? line.creditAmount.toLocaleString() : ''}
                              </div>
                            ))}
                          </td>
                          <td className="p-2 text-center">
                            <Badge
                              variant={
                                journal.mappingConfidence >= 0.9
                                  ? 'default'
                                  : journal.mappingConfidence >= 0.7
                                    ? 'secondary'
                                    : 'destructive'
                              }
                            >
                              {Math.round(journal.mappingConfidence * 100)}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.journalConversions.length > 100 && (
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      上位100件を表示中（全{result.journalConversions.length}件）
                    </p>
                  )}
                </div>
              ) : (
                <p className="py-8 text-center text-muted-foreground">仕訳データがありません</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {result.adjustingEntries && result.adjustingEntries.length > 0 && (
          <TabsContent value="adjustments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>調整仕訳一覧</CardTitle>
                <CardDescription>
                  {result.adjustingEntries.length}件の調整仕訳が生成されました
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.adjustingEntries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge>{entry.type}</Badge>
                          <span className="font-medium">{entry.description}</span>
                        </div>
                        {entry.isApproved && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            承認済み
                          </Badge>
                        )}
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left">勘定科目</th>
                            <th className="p-2 text-right">借方</th>
                            <th className="p-2 text-right">貸方</th>
                          </tr>
                        </thead>
                        <tbody>
                          {entry.lines.map((line, index) => (
                            <tr key={index}>
                              <td className="p-2">
                                {line.accountCode} {line.accountName}
                              </td>
                              <td className="p-2 text-right">
                                {line.debit > 0 ? line.debit.toLocaleString() : ''}
                              </td>
                              <td className="p-2 text-right">
                                {line.credit > 0 ? line.credit.toLocaleString() : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
