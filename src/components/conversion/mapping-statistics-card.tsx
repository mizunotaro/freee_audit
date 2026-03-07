'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface MappingStatistics {
  total: number
  approved: number
  pending: number
  needsReview: number
  averageConfidence?: number
  byType?: Record<string, number>
}

interface MappingStatisticsCardProps {
  statistics: MappingStatistics
}

export function MappingStatisticsCard({ statistics }: MappingStatisticsCardProps) {
  const approvalRate =
    statistics.total > 0 ? Math.round((statistics.approved / statistics.total) * 100) : 0

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">総マッピング数</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{statistics.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">承認済み</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{statistics.approved}</div>
          <Progress value={approvalRate} className="mt-2 h-1" />
          <p className="mt-1 text-xs text-muted-foreground">{approvalRate}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">要確認</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{statistics.needsReview}</div>
          <p className="text-xs text-muted-foreground">手動レビューが必要</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">平均信頼度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.round((statistics.averageConfidence ?? 0) * 100)}%
          </div>
          <p className="text-xs text-muted-foreground">AI推論の信頼度</p>
        </CardContent>
      </Card>
    </div>
  )
}
