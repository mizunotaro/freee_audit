'use client'

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ShareholderData } from '@/types/reports/ir-report'

export interface ShareholderPieChartProps {
  data: ShareholderData[]
  title?: string
  language?: 'ja' | 'en'
  size?: number
}

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
]

export function ShareholderPieChart({
  data,
  title = '株主構成',
  language = 'ja',
  size = 200,
}: ShareholderPieChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)

  const total = React.useMemo(() => {
    return data.reduce((sum, item) => sum + item.percentage, 0)
  }, [data])

  const paths = React.useMemo(() => {
    if (data.length === 0) return []

    let currentAngle = -90
    const cx = size / 2
    const cy = size / 2
    const radius = size / 2 - 10
    const innerRadius = radius * 0.5

    return data.map((item, index) => {
      const percentage = (item.percentage / total) * 100
      const angle = (percentage / 100) * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      const startRad = (startAngle * Math.PI) / 180
      const endRad = (endAngle * Math.PI) / 180

      const x1 = cx + radius * Math.cos(startRad)
      const y1 = cy + radius * Math.sin(startRad)
      const x2 = cx + radius * Math.cos(endRad)
      const y2 = cy + radius * Math.sin(endRad)

      const x3 = cx + innerRadius * Math.cos(endRad)
      const y3 = cy + innerRadius * Math.sin(endRad)
      const x4 = cx + innerRadius * Math.cos(startRad)
      const y4 = cy + innerRadius * Math.sin(startRad)

      const largeArcFlag = angle > 180 ? 1 : 0

      const pathD = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ')

      return {
        d: pathD,
        color: COLORS[index % COLORS.length],
        item,
        index,
      }
    })
  }, [data, total, size])

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-8 text-center text-muted-foreground">
            {language === 'en' ? 'No data available' : 'データがありません'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const tooltipData = hoveredIndex !== null ? data[hoveredIndex] : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {paths.map((path, index) => (
                <path
                  key={index}
                  d={path.d}
                  fill={path.color}
                  stroke="white"
                  strokeWidth={2}
                  opacity={hoveredIndex === null || hoveredIndex === index ? 1 : 0.5}
                  className="cursor-pointer transition-opacity duration-200"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ))}
            </svg>

            {tooltipData && (
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform rounded-md border bg-background px-3 py-2 shadow-lg">
                <p className="text-sm font-medium">{tooltipData.category}</p>
                <p className="text-lg font-bold">{tooltipData.percentage.toFixed(1)}%</p>
                {tooltipData.count && (
                  <p className="text-xs text-muted-foreground">
                    {language === 'en'
                      ? `${tooltipData.count.toLocaleString()} shareholders`
                      : `${tooltipData.count.toLocaleString()}名`}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="space-y-2">
              {data.map((item, index) => (
                <div
                  key={item.category}
                  className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-muted/50"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">{item.category}</span>
                  </div>
                  <span className="text-sm font-medium">{item.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default ShareholderPieChart
