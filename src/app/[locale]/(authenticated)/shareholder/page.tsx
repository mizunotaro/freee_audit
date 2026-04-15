'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ShareholderSummary {
  totalShares: number
  totalShareholders: number
  byType: Record<string, { shares: number; holders: number; percentage: number }>
  topShareholders: Array<{ name: string; shares: number; percentage: number }>
}

interface CapitalStructure {
  issuedShares: number
  potentialShares: number
  fullyDilutedShares: number
  optionPoolTotal: number
  optionPoolGranted: number
  optionPoolAvailable: number
}

export default function ShareholderPage() {
  const [summary, setSummary] = useState<ShareholderSummary | null>(null)
  const [capital, setCapital] = useState<CapitalStructure | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/shareholder').then((r) => r.json()),
      fetch('/api/shareholder?view=capital').then((r) => r.json()),
    ])
      .then(([sumData, capData]) => {
        if (sumData.success) setSummary(sumData.data)
        if (capData.success) setCapital(capData.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6">読み込み中...</div>

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">株主・資本管理</h1>
        <p className="text-muted-foreground">株主名簿・新株予約権原簿・資本構成</p>
      </div>

      {capital && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>発行済株式数</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{capital.issuedShares.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>完全希薄化後</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{capital.fullyDilutedShares.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SO付与済</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{capital.optionPoolGranted.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                / {capital.optionPoolTotal.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>SO残枠</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {capital.optionPoolAvailable.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>株主構成（種別）</CardTitle>
              <CardDescription>
                株主{summary.totalShareholders}名 / 合計{summary.totalShares.toLocaleString()}株
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">種別</th>
                    <th className="py-2 text-right">株数</th>
                    <th className="py-2 text-right">人数</th>
                    <th className="py-2 text-right">比率</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byType).map(([type, data]) => (
                    <tr key={type} className="border-b">
                      <td className="py-2">{type}</td>
                      <td className="py-2 text-right">{data.shares.toLocaleString()}</td>
                      <td className="py-2 text-right">{data.holders}</td>
                      <td className="py-2 text-right">{data.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>上位株主</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">株主名</th>
                    <th className="py-2 text-right">保有株数</th>
                    <th className="py-2 text-right">議決権比率</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topShareholders.map((s, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{s.name}</td>
                      <td className="py-2 text-right">{s.shares.toLocaleString()}</td>
                      <td className="py-2 text-right">{s.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
