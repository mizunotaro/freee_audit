'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, CheckCircle, AlertCircle, RefreshCw, Filter } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface JournalEntry {
  id: string
  entryDate: string
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxType: string | null
  auditStatus: string
  issues: JournalIssue[]
}

interface JournalIssue {
  field: string
  issue: string
  severity: 'error' | 'warning' | 'info'
}

interface AuditStats {
  total: number
  pending: number
  passed: number
  issues: number
}

export default function JournalAuditPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'passed'>('all')
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/audit/journal?fiscalYear=${fiscalYear}&month=${month}`)
      const data = await res.json()
      setEntries(data.entries || [])
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to fetch journal entries:', error)
    } finally {
      setLoading(false)
    }
  }, [fiscalYear, month])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      const res = await fetch('/api/audit/journal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fiscalYear, month }),
      })
      const data = await res.json()
      setEntries(data.entries || [])
      setStats(data.stats)
    } catch (error) {
      console.error('Failed to analyze entries:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'all') return true
    if (filter === 'passed') return entry.issues.length === 0
    if (filter === 'error') return entry.issues.some((i) => i.severity === 'error')
    if (filter === 'warning') return entry.issues.some((i) => i.severity === 'warning')
    return true
  })

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive">エラー</Badge>
      case 'warning':
        return <Badge variant="secondary">警告</Badge>
      default:
        return <Badge variant="outline">OK</Badge>
    }
  }

  return (
    <AppLayout title="記帳診断">
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2022, 2023, 2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={y.toString()}>
                {y}年度
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month.toString()} onValueChange={(v) => setMonth(parseInt(v))}>
          <SelectTrigger className="w-24">
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
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          再読込
        </Button>
        <Button onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? '分析中...' : 'AI分析実行'}
        </Button>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">総仕訳数</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">未確認</div>
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">問題なし</div>
              <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-500">要確認</div>
              <div className="text-2xl font-bold text-red-600">{stats.issues}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて表示</SelectItem>
            <SelectItem value="error">エラーのみ</SelectItem>
            <SelectItem value="warning">警告以上</SelectItem>
            <SelectItem value="passed">問題なし</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-gray-500">{filteredEntries.length}件</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>仕訳一覧</CardTitle>
          <CardDescription>各仕訳の整合性をAIが分析し、問題点を指摘します</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">読み込み中...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-gray-500">データがありません</div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`rounded-lg border p-4 ${
                    entry.issues.length === 0
                      ? 'border-green-200 bg-green-50'
                      : entry.issues.some((i) => i.severity === 'error')
                        ? 'border-red-200 bg-red-50'
                        : 'border-yellow-200 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(
                          entry.issues.some((i) => i.severity === 'error')
                            ? 'error'
                            : entry.issues.some((i) => i.severity === 'warning')
                              ? 'warning'
                              : 'ok'
                        )}
                        <span className="font-medium">
                          {new Date(entry.entryDate).toLocaleDateString('ja-JP')}
                        </span>
                        <span className="text-gray-500">{entry.description}</span>
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="text-blue-600">{entry.debitAccount}</span>
                        <span className="mx-2">/</span>
                        <span className="text-purple-600">{entry.creditAccount}</span>
                        <span className="ml-4 font-medium">{formatCurrency(entry.amount)}</span>
                        {entry.taxType && (
                          <span className="ml-2 text-xs text-gray-500">({entry.taxType})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {entry.issues.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {entry.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          {getSeverityIcon(issue.severity)}
                          <span className="font-medium text-gray-600">{issue.field}:</span>
                          <span className="text-gray-700">{issue.issue}</span>
                          {getSeverityBadge(issue.severity)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  )
}
