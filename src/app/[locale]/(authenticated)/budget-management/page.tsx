'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface BudgetPlan {
  id: string
  name: string
  fiscalYear: number
  version: number
  status: string
}

export default function BudgetManagementPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/budget-management')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setPlans(data.data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">予実管理</h1>
        <p className="text-muted-foreground">予算策定・予実差異分析・取締役会資料連携</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>予算計画数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{plans.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>当年度</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {plans.filter((p) => p.fiscalYear === new Date().getFullYear()).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>アクティブ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">
              {plans.filter((p) => p.status === 'active' || p.status === 'draft').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>予算計画一覧</CardTitle>
          <CardDescription>予算の策定・差異分析・理由記録</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>読み込み中...</p>
          ) : plans.length === 0 ? (
            <p className="text-muted-foreground">
              予算計画がありません。AI支援で予算を作成できます。
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">計画名</th>
                  <th className="py-2 text-right">年度</th>
                  <th className="py-2 text-right">バージョン</th>
                  <th className="py-2 text-center">状態</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 text-right">{p.fiscalYear}</td>
                    <td className="py-2 text-right">v{p.version}</td>
                    <td className="py-2 text-center">
                      <span className="rounded bg-gray-100 px-2 py-1 text-xs">{p.status}</span>
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
