'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ProcurementCase {
  id: string
  title: string
  vendor: string | null
  totalAmount: number
  status: string
  alertCount: number
}

export default function ProcurementPage() {
  const [cases, setCases] = useState<ProcurementCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
  }, [])

  async function fetchCases() {
    try {
      const res = await fetch('/api/procurement')
      const data = await res.json()
      if (data.success) setCases(data.data)
    } finally {
      setLoading(false)
    }
  }

  async function runCheck(caseId: string) {
    const res = await fetch('/api/procurement/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId }),
    })
    const data = await res.json()
    if (data.success) {
      alert(`整合性チェック完了: ${data.data.alerts.length}件のアラート`)
      fetchCases()
    }
  }

  const totalAlerts = cases.reduce((sum, c) => sum + c.alertCount, 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">購買管理</h1>
        <p className="text-muted-foreground">購買プロセス管理・書類整合性チェック</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>案件数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{cases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>未解決アラート</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-3xl font-bold ${totalAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}
            >
              {totalAlerts}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>100万円以上</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {cases.filter((c) => c.totalAmount >= 1000000).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>合計金額</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {cases.reduce((s, c) => s + c.totalAmount, 0).toLocaleString()}円
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>購買案件一覧</CardTitle>
          <CardDescription>見積→発注→納品→検収→請求→支払の書類整合性を管理</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>読み込み中...</p>
          ) : cases.length === 0 ? (
            <p className="text-muted-foreground">購買案件がありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">案件名</th>
                  <th className="py-2 text-left">取引先</th>
                  <th className="py-2 text-right">金額</th>
                  <th className="py-2 text-center">アラート</th>
                  <th className="py-2 text-center">状態</th>
                  <th className="py-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">{c.title}</td>
                    <td className="py-2">{c.vendor ?? '-'}</td>
                    <td className="py-2 text-right">{c.totalAmount.toLocaleString()}円</td>
                    <td className="py-2 text-center">
                      {c.alertCount > 0 ? (
                        <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                          {c.alertCount}
                        </span>
                      ) : (
                        <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                          OK
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-center">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs">{c.status}</span>
                    </td>
                    <td className="py-2 text-center">
                      <Button size="sm" variant="outline" onClick={() => runCheck(c.id)}>
                        整合性チェック
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
