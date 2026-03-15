'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MonteCarloResult, DCFResult, WACCResult } from '@/services/valuation'

interface ValuationChartsProps {
  monteCarloResult?: MonteCarloResult | null
  dcfResult?: DCFResult | null
  waccResult?: WACCResult | null
  className?: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export function ValuationCharts({
  monteCarloResult,
  dcfResult,
  waccResult,
  className,
}: ValuationChartsProps) {
  const histogramData = useMemo(() => {
    if (!monteCarloResult?.histogram) return []
    return monteCarloResult.histogram.slice(0, 20).map((bin, _index) => ({
      name: `${(bin.binStart / 1000).toFixed(0)}K`,
      value: bin.count,
      frequency: bin.frequency,
      binStart: bin.binStart,
      binEnd: bin.binEnd,
    }))
  }, [monteCarloResult])

  const percentileData = useMemo(() => {
    if (!monteCarloResult?.statistics) return []
    const { percentiles } = monteCarloResult.statistics
    return [
      { name: 'P5', value: percentiles.p5 / 1000 },
      { name: 'P25', value: percentiles.p25 / 1000 },
      { name: 'P50', value: percentiles.p50 / 1000 },
      { name: 'P75', value: percentiles.p75 / 1000 },
      { name: 'P95', value: percentiles.p95 / 1000 },
    ]
  }, [monteCarloResult])

  const waccComponentsData = useMemo(() => {
    if (!waccResult?.components) return []
    return [
      {
        name: 'Equity Weight',
        value: (1 - waccResult.components.weightedCostOfDebt / waccResult.wacc) * 100,
      },
      {
        name: 'Debt Weight',
        value: (waccResult.components.weightedCostOfDebt / waccResult.wacc) * 100,
      },
    ]
  }, [waccResult])

  const dcfCashFlowData = useMemo(() => {
    if (!dcfResult?.metadata?.presentValues) return []
    return dcfResult.metadata.presentValues.map((pv, index) => ({
      year: `Year ${index + 1}`,
      presentValue: pv / 1000,
    }))
  }, [dcfResult])

  if (!monteCarloResult && !dcfResult && !waccResult) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
          Run calculations to see charts
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Visualization</CardTitle>
        <CardDescription>Interactive charts powered by Recharts</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="distribution" className="w-full">
          <TabsList className="mb-4">
            {monteCarloResult && <TabsTrigger value="distribution">Distribution</TabsTrigger>}
            {monteCarloResult && <TabsTrigger value="percentiles">Percentiles</TabsTrigger>}
            {dcfResult && <TabsTrigger value="dcf">DCF Flows</TabsTrigger>}
            {waccResult?.components && <TabsTrigger value="wacc">WACC</TabsTrigger>}
          </TabsList>

          {monteCarloResult && (
            <TabsContent value="distribution" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    labelFormatter={(label) => `Bin: ${label}`}
                  />
                  <Bar dataKey="value" fill="#8884d8" radius={[4, 4, 0, 0]}>
                    {histogramData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          )}

          {monteCarloResult && (
            <TabsContent value="percentiles" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={percentileData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={10} tickFormatter={(v) => `${v}K`} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}K MM JPY`, 'Value']}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    dot={{ fill: '#82ca9d', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          )}

          {dcfResult && (
            <TabsContent value="dcf" className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dcfCashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="year" fontSize={10} />
                  <YAxis fontSize={10} tickFormatter={(v) => `${v}K`} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}K MM JPY`, 'PV']} />
                  <Area
                    type="monotone"
                    dataKey="presentValue"
                    stroke="#8884d8"
                    fill="#8884d8"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>
          )}

          {waccResult?.components && (
            <TabsContent value="wacc" className="h-64">
              <div className="grid h-full grid-cols-2 gap-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={waccComponentsData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {waccComponentsData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'Weight']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col justify-center space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost of Equity:</span>
                    <span className="font-medium">
                      {(waccResult.components.costOfEquity * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost of Debt:</span>
                    <span className="font-medium">
                      {(waccResult.components.costOfDebt * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">After-Tax Cost:</span>
                    <span className="font-medium">
                      {(waccResult.components.afterTaxCostOfDebt * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium text-muted-foreground">Total WACC:</span>
                    <span className="font-bold text-primary">
                      {(waccResult.wacc * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <div className="mt-4 flex items-center gap-2">
          <Badge variant="outline">Recharts</Badge>
          <span className="text-xs text-muted-foreground">Interactive charts</span>
        </div>
      </CardContent>
    </Card>
  )
}
