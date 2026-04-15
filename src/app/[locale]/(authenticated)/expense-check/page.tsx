'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Alert {
  checkType: string
  severity: string
  message: string
  employeeName?: string
  expenseId?: string
}

export default function ExpenseCheckPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)

  async function runCheck() {
    setLoading(true)
    try {
      const res = await fetch('/api/expense-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expenses: [],
          policy: {
            hotelLimitDomestic: 15000,
            taxiApprovalRequired: true,
            entertainmentApprovalLimit: 50000,
            maxMealExpense: 3000,
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setAlerts(data.data.alerts)
        setChecked(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const severityColor: Record<string, string> = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-blue-100 text-blue-800',
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">経費精算チェック</h1>
          <p className="text-muted-foreground">
            重複申請・通勤経路重複・社内規程準拠を自動チェック
          </p>
        </div>
        <Button onClick={runCheck} disabled={loading}>
          {loading ? 'チェック中...' : '経費チェック実行'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>チェック項目</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              <li>重複申請の検出</li>
              <li>通勤経路との重複チェック</li>
              <li>日付整合性（休日・古い申請）</li>
              <li>社内規程との照合</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>アラート数</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${alerts.length > 0 ? 'text-red-600' : checked ? 'text-green-600' : ''}`}
            >
              {checked ? alerts.length : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>高リスク</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {checked ? alerts.filter((a) => a.severity === 'high').length : '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      {checked && (
        <Card>
          <CardHeader>
            <CardTitle>チェック結果</CardTitle>
            <CardDescription>
              {alerts.length === 0
                ? '問題は検出されませんでした'
                : `${alerts.length}件のアラートが検出されました`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="font-medium text-green-600">全ての経費精算が正常です</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} className="rounded border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${severityColor[a.severity] ?? 'bg-gray-100'}`}
                      >
                        {a.severity}
                      </span>
                      <span className="text-xs text-muted-foreground">{a.checkType}</span>
                      {a.employeeName && (
                        <span className="text-xs font-medium">{a.employeeName}</span>
                      )}
                    </div>
                    <p className="text-sm">{a.message}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
