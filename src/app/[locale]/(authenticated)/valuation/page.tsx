'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calculator,
  Building2,
  BarChart3,
} from 'lucide-react'

interface DCFInputs {
  freeCashFlow: number
  growthRate: number
  terminalGrowthRate: number
  discountRate: number
  projectionYears: number
}

interface ComparableData {
  companyName: string
  marketCap: number
  ev: number
  revenue: number
  ebitda: number
  per: number
  evEbitda: number
  psr: number
}

const lifeScienceComparables: ComparableData[] = [
  { companyName: 'Helios Corp', marketCap: 45000, ev: 48000, revenue: 12000, ebitda: 2400, per: 18.8, evEbitda: 20.0, psr: 3.75 },
  { companyName: 'BioSignal Labs', marketCap: 28000, ev: 32000, revenue: 8500, ebitda: 1700, per: 16.5, evEbitda: 18.8, psr: 3.29 },
  { companyName: 'GenomeTech', marketCap: 62000, ev: 68000, revenue: 18000, ebitda: 3600, per: 17.2, evEbitda: 18.9, psr: 3.44 },
  { companyName: 'CellMedicine', marketCap: 35000, ev: 38000, revenue: 9500, ebitda: 1900, per: 18.4, evEbitda: 20.0, psr: 3.68 },
  { companyName: 'ProteinEng', marketCap: 52000, ev: 56000, revenue: 15000, ebitda: 3000, per: 17.3, evEbitda: 18.7, psr: 3.47 },
]

function calculateDCF(inputs: DCFInputs): { enterpriseValue: number; presentValues: number[] } {
  const { freeCashFlow, growthRate, terminalGrowthRate, discountRate, projectionYears } = inputs
  const presentValues: number[] = []
  let enterpriseValue = 0

  for (let year = 1; year <= projectionYears; year++) {
    const fcf = freeCashFlow * Math.pow(1 + growthRate / 100, year)
    const pv = fcf / Math.pow(1 + discountRate / 100, year)
    presentValues.push(pv)
    enterpriseValue += pv
  }

  const terminalFcf = freeCashFlow * Math.pow(1 + growthRate / 100, projectionYears) * (1 + terminalGrowthRate / 100)
  const terminalValue = terminalFcf / (discountRate / 100 - terminalGrowthRate / 100)
  const terminalPV = terminalValue / Math.pow(1 + discountRate / 100, projectionYears)
  enterpriseValue += terminalPV

  return { enterpriseValue, presentValues }
}

export default function ValuationPage() {
  const t = useTranslations('navigation')
  const [dcfInputs, setDcfInputs] = useState<DCFInputs>({
    freeCashFlow: 2000,
    growthRate: 15,
    terminalGrowthRate: 3,
    discountRate: 12,
    projectionYears: 5,
  })

  const [selectedComparable, setSelectedComparable] = useState<string>('average')
  const [targetRevenue, setTargetRevenue] = useState<number>(10000)
  const [targetEbitda, setTargetEbitda] = useState<number>(2000)

  const dcfResult = calculateDCF(dcfInputs)

  const getComparableMultiples = () => {
    if (selectedComparable === 'average') {
      const avgPer = lifeScienceComparables.reduce((sum, c) => sum + c.per, 0) / lifeScienceComparables.length
      const avgEvEbitda = lifeScienceComparables.reduce((sum, c) => sum + c.evEbitda, 0) / lifeScienceComparables.length
      const avgPsr = lifeScienceComparables.reduce((sum, c) => sum + c.psr, 0) / lifeScienceComparables.length
      return { per: avgPer, evEbitda: avgEvEbitda, psr: avgPsr }
    }
    const comp = lifeScienceComparables.find(c => c.companyName === selectedComparable)
    return comp ? { per: comp.per, evEbitda: comp.evEbitda, psr: comp.psr } : { per: 0, evEbitda: 0, psr: 0 }
  }

  const multiples = getComparableMultiples()
  const comparableValuation = {
    per: targetEbitda * 0.5 * multiples.per,
    evEbitda: targetEbitda * multiples.evEbitda,
    psr: targetRevenue * multiples.psr,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('valuation')}</h1>
        <p className="text-muted-foreground">DCF & Comparable Company Analysis</p>
      </div>

      <Tabs defaultValue="dcf" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dcf">
            <Calculator className="mr-2 h-4 w-4" />
            DCF Method
          </TabsTrigger>
          <TabsTrigger value="comparable">
            <Building2 className="mr-2 h-4 w-4" />
            Comparable Companies
          </TabsTrigger>
          <TabsTrigger value="summary">
            <BarChart3 className="mr-2 h-4 w-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dcf" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>DCF Parameters</CardTitle>
                <CardDescription>Free Cash Flow Discount Model Inputs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fcf">Free Cash Flow (MM JPY)</Label>
                  <Input
                    id="fcf"
                    type="number"
                    value={dcfInputs.freeCashFlow}
                    onChange={(e) => setDcfInputs({ ...dcfInputs, freeCashFlow: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="growthRate">Growth Rate (%)</Label>
                  <Input
                    id="growthRate"
                    type="number"
                    value={dcfInputs.growthRate}
                    onChange={(e) => setDcfInputs({ ...dcfInputs, growthRate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="terminalGrowth">Terminal Growth Rate (%)</Label>
                  <Input
                    id="terminalGrowth"
                    type="number"
                    value={dcfInputs.terminalGrowthRate}
                    onChange={(e) => setDcfInputs({ ...dcfInputs, terminalGrowthRate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discountRate">Discount Rate (WACC) (%)</Label>
                  <Input
                    id="discountRate"
                    type="number"
                    value={dcfInputs.discountRate}
                    onChange={(e) => setDcfInputs({ ...dcfInputs, discountRate: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="years">Projection Period (Years)</Label>
                  <Input
                    id="years"
                    type="number"
                    value={dcfInputs.projectionYears}
                    onChange={(e) => setDcfInputs({ ...dcfInputs, projectionYears: Number(e.target.value) })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DCF Valuation Result</CardTitle>
                <CardDescription>Enterprise Value Calculation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-primary/10 p-4">
                  <div className="text-sm text-muted-foreground">Estimated Enterprise Value</div>
                  <div className="text-3xl font-bold text-primary">
                    {Math.round(dcfResult.enterpriseValue).toLocaleString()} MM JPY
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">Present Value by Period</div>
                  {dcfResult.presentValues.map((pv, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>Year {index + 1}</span>
                      <span>{Math.round(pv).toLocaleString()} MM JPY</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparable" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparable Company Selection</CardTitle>
                <CardDescription>Life Science Industry Listed Companies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Comparison Target</Label>
                  <Select value={selectedComparable} onValueChange={setSelectedComparable}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="average">Industry Average</SelectItem>
                      {lifeScienceComparables.map((c) => (
                        <SelectItem key={c.companyName} value={c.companyName}>
                          {c.companyName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetRevenue">Target Revenue (MM JPY)</Label>
                  <Input
                    id="targetRevenue"
                    type="number"
                    value={targetRevenue}
                    onChange={(e) => setTargetRevenue(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetEbitda">Target EBITDA (MM JPY)</Label>
                  <Input
                    id="targetEbitda"
                    type="number"
                    value={targetEbitda}
                    onChange={(e) => setTargetEbitda(Number(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multiples</CardTitle>
                <CardDescription>Selected Comparable Company Metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">P/E</div>
                    <div className="text-lg font-bold">{multiples.per.toFixed(1)}x</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">EV/EBITDA</div>
                    <div className="text-lg font-bold">{multiples.evEbitda.toFixed(1)}x</div>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">P/S</div>
                    <div className="text-lg font-bold">{multiples.psr.toFixed(2)}x</div>
                  </div>
                </div>
                <div className="space-y-2 pt-4">
                  <div className="flex justify-between text-sm">
                    <span>P/E Valuation</span>
                    <span className="font-medium">{Math.round(comparableValuation.per).toLocaleString()} MM JPY</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>EV/EBITDA Valuation</span>
                    <span className="font-medium">{Math.round(comparableValuation.evEbitda).toLocaleString()} MM JPY</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>P/S Valuation</span>
                    <span className="font-medium">{Math.round(comparableValuation.psr).toLocaleString()} MM JPY</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparable Companies List</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Company</th>
                      <th className="p-2 text-right">Market Cap</th>
                      <th className="p-2 text-right">EV</th>
                      <th className="p-2 text-right">Revenue</th>
                      <th className="p-2 text-right">EBITDA</th>
                      <th className="p-2 text-right">P/E</th>
                      <th className="p-2 text-right">EV/EBITDA</th>
                      <th className="p-2 text-right">P/S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lifeScienceComparables.map((c) => (
                      <tr key={c.companyName} className="border-b">
                        <td className="p-2">{c.companyName}</td>
                        <td className="p-2 text-right">{c.marketCap.toLocaleString()}</td>
                        <td className="p-2 text-right">{c.ev.toLocaleString()}</td>
                        <td className="p-2 text-right">{c.revenue.toLocaleString()}</td>
                        <td className="p-2 text-right">{c.ebitda.toLocaleString()}</td>
                        <td className="p-2 text-right">{c.per.toFixed(1)}</td>
                        <td className="p-2 text-right">{c.evEbitda.toFixed(1)}</td>
                        <td className="p-2 text-right">{c.psr.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/50 font-medium">
                      <td className="p-2">Average</td>
                      <td className="p-2 text-right">{Math.round(lifeScienceComparables.reduce((s, c) => s + c.marketCap, 0) / lifeScienceComparables.length).toLocaleString()}</td>
                      <td className="p-2 text-right">{Math.round(lifeScienceComparables.reduce((s, c) => s + c.ev, 0) / lifeScienceComparables.length).toLocaleString()}</td>
                      <td className="p-2 text-right">{Math.round(lifeScienceComparables.reduce((s, c) => s + c.revenue, 0) / lifeScienceComparables.length).toLocaleString()}</td>
                      <td className="p-2 text-right">{Math.round(lifeScienceComparables.reduce((s, c) => s + c.ebitda, 0) / lifeScienceComparables.length).toLocaleString()}</td>
                      <td className="p-2 text-right">{(lifeScienceComparables.reduce((s, c) => s + c.per, 0) / lifeScienceComparables.length).toFixed(1)}</td>
                      <td className="p-2 text-right">{(lifeScienceComparables.reduce((s, c) => s + c.evEbitda, 0) / lifeScienceComparables.length).toFixed(1)}</td>
                      <td className="p-2 text-right">{(lifeScienceComparables.reduce((s, c) => s + c.psr, 0) / lifeScienceComparables.length).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">DCF Method</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(dcfResult.enterpriseValue).toLocaleString()} MM JPY
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Comparable (EV/EBITDA)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(comparableValuation.evEbitda).toLocaleString()} MM JPY
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Valuation Range</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(Math.min(dcfResult.enterpriseValue, comparableValuation.evEbitda)).toLocaleString()} - {Math.round(Math.max(dcfResult.enterpriseValue, comparableValuation.evEbitda)).toLocaleString()} MM JPY
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Valuation Summary</CardTitle>
              <CardDescription>Integrated Enterprise Valuation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="mb-2 font-medium">Valuation Assumptions</div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Projection Period: {dcfInputs.projectionYears} years</li>
                    <li>Growth Rate: Initial {dcfInputs.growthRate}% / Terminal {dcfInputs.terminalGrowthRate}%</li>
                    <li>Discount Rate (WACC): {dcfInputs.discountRate}%</li>
                    <li>Industry: Life Science</li>
                  </ul>
                </div>
                <div className="rounded-lg bg-primary/10 p-4">
                  <div className="mb-2 font-medium">Estimated Enterprise Value (Weighted Average)</div>
                  <div className="text-2xl font-bold">
                    {Math.round((dcfResult.enterpriseValue * 0.6 + comparableValuation.evEbitda * 0.4)).toLocaleString()} MM JPY
                  </div>
                  <div className="text-sm text-muted-foreground">DCF 60% / Comparable 40%</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
