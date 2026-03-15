'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Play, RefreshCw, AlertCircle, CheckCircle2, Calculator, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ValuationFormulaDisplay } from '@/components/valuation/valuation-formula-display'
import {
  calculateDCF,
  calculateWACC,
  runMonteCarloSimulation,
  type DCFInputs,
  type DCFResult,
  type WACCInputs,
  type WACCResult,
  type MonteCarloInputs,
  type MonteCarloResult,
  type CalculationStep,
} from '@/services/valuation'

type WACCMode = 'simple' | 'detailed'

interface DCFInputState {
  freeCashFlow: number
  growthRate: number
  terminalGrowthRate: number
  discountRate: number
  projectionYears: number
}

interface WACCSimpleInputState {
  waccValue: number
}

interface WACCDetailedInputState {
  riskFreeRate: number
  marketRiskPremium: number
  beta: number
  costOfDebt: number
  taxRate: number
  debtRatio: number
}

export default function ValuationPage() {
  const t = useTranslations('valuation')

  const [dcfInputs, setDcfInputs] = useState<DCFInputState>({
    freeCashFlow: 1000,
    growthRate: 5,
    terminalGrowthRate: 2,
    discountRate: 10,
    projectionYears: 5,
  })

  const [waccMode, setWaccMode] = useState<WACCMode>('simple')
  const [waccSimpleInputs, setWaccSimpleInputs] = useState<WACCSimpleInputState>({
    waccValue: 10,
  })
  const [waccDetailedInputs, setWaccDetailedInputs] = useState<WACCDetailedInputState>({
    riskFreeRate: 1.0,
    marketRiskPremium: 6.0,
    beta: 1.0,
    costOfDebt: 3.0,
    taxRate: 30.0,
    debtRatio: 30.0,
  })

  const [dcfResult, setDcfResult] = useState<DCFResult | null>(null)
  const [waccResult, setWaccResult] = useState<WACCResult | null>(null)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null)
  const [calculationSteps, setCalculationSteps] = useState<CalculationStep[]>([])

  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCalculateDCF = useCallback(async () => {
    setIsCalculating(true)
    setError(null)
    setCalculationSteps([])

    try {
      const inputs: DCFInputs = {
        freeCashFlow: dcfInputs.freeCashFlow,
        growthRate: dcfInputs.growthRate / 100,
        terminalGrowthRate: dcfInputs.terminalGrowthRate / 100,
        discountRate: dcfInputs.discountRate / 100,
        projectionYears: dcfInputs.projectionYears,
        currency: 'JPY',
        unit: 'million',
      }

      const result = calculateDCF(inputs)

      if (result.success) {
        setDcfResult(result.data)
        setCalculationSteps(result.data.steps)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
    }
  }, [dcfInputs])

  const handleCalculateWACC = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      let inputs: WACCInputs

      if (waccMode === 'simple') {
        inputs = {
          mode: 'simple',
          simpleWACC: waccSimpleInputs.waccValue / 100,
        }
      } else {
        inputs = {
          mode: 'detailed',
          riskFreeRate: waccDetailedInputs.riskFreeRate / 100,
          marketRiskPremium: waccDetailedInputs.marketRiskPremium / 100,
          beta: waccDetailedInputs.beta,
          costOfDebt: waccDetailedInputs.costOfDebt / 100,
          taxRate: waccDetailedInputs.taxRate / 100,
          debtRatio: waccDetailedInputs.debtRatio / 100,
        }
      }

      const result = calculateWACC(inputs)

      if (result.success) {
        setWaccResult(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
    }
  }, [waccMode, waccSimpleInputs, waccDetailedInputs])

  const handleRunMonteCarlo = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      const inputs: MonteCarloInputs = {
        iterations: 1000,
        baseInputs: {
          freeCashFlow: dcfInputs.freeCashFlow,
          growthRate: dcfInputs.growthRate / 100,
          terminalGrowthRate: dcfInputs.terminalGrowthRate / 100,
          discountRate: dcfInputs.discountRate / 100,
          projectionYears: dcfInputs.projectionYears,
          currency: 'JPY',
          unit: 'million',
        },
        distributions: {
          growthRate: {
            type: 'normal',
            params: { mean: dcfInputs.growthRate / 100, stdDev: 0.03 },
          },
          terminalGrowthRate: {
            type: 'normal',
            params: { mean: dcfInputs.terminalGrowthRate / 100, stdDev: 0.015 },
          },
          discountRate: {
            type: 'normal',
            params: { mean: dcfInputs.discountRate / 100, stdDev: 0.02 },
          },
        },
      }

      const result = runMonteCarloSimulation(inputs)

      if (result.success) {
        setMonteCarloResult(result.data)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
    }
  }, [dcfInputs])

  const formatCurrency = (value: number): string => {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} MM JPY`
  }

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {t('title') || 'Business Valuation'}
          </h1>
          <p className="text-muted-foreground">
            {t('description') || 'Enterprise value estimation using multiple methodologies'}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Calculator className="mr-2 h-4 w-4" />
          v1.0.0
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="dcf" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dcf">DCF Analysis</TabsTrigger>
          <TabsTrigger value="wacc">WACC Calculator</TabsTrigger>
          <TabsTrigger value="monte-carlo">Monte Carlo</TabsTrigger>
        </TabsList>

        <TabsContent value="dcf" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>DCF Inputs</CardTitle>
                <CardDescription>
                  Enter the parameters for discounted cash flow analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Free Cash Flow (MM JPY)</Label>
                    <Input
                      type="number"
                      value={dcfInputs.freeCashFlow}
                      onChange={(e) =>
                        setDcfInputs({ ...dcfInputs, freeCashFlow: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Growth Rate (%)</Label>
                    <Input
                      type="number"
                      value={dcfInputs.growthRate}
                      onChange={(e) =>
                        setDcfInputs({ ...dcfInputs, growthRate: Number(e.target.value) })
                      }
                      step="0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Terminal Growth (%)</Label>
                    <Input
                      type="number"
                      value={dcfInputs.terminalGrowthRate}
                      onChange={(e) =>
                        setDcfInputs({ ...dcfInputs, terminalGrowthRate: Number(e.target.value) })
                      }
                      step="0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Discount Rate (%)</Label>
                    <Input
                      type="number"
                      value={dcfInputs.discountRate}
                      onChange={(e) =>
                        setDcfInputs({ ...dcfInputs, discountRate: Number(e.target.value) })
                      }
                      step="0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Projection Years</Label>
                    <Input
                      type="number"
                      value={dcfInputs.projectionYears}
                      onChange={(e) =>
                        setDcfInputs({ ...dcfInputs, projectionYears: Number(e.target.value) })
                      }
                      min="1"
                      max="20"
                    />
                  </div>
                </div>

                <Button onClick={handleCalculateDCF} disabled={isCalculating} className="w-full">
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Calculate DCF
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>DCF Result</CardTitle>
                <CardDescription>
                  Enterprise value based on discounted future cash flows
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dcfResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Enterprise Value</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(dcfResult.enterpriseValue)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Terminal Value (PV)</div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(dcfResult.terminalPV)}
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Calculated at {dcfResult.metadata.calculatedAt}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    Enter inputs and click Calculate
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {calculationSteps.length > 0 && (
            <ValuationFormulaDisplay steps={calculationSteps} title="DCF Calculation Steps" />
          )}
        </TabsContent>

        <TabsContent value="wacc" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>WACC Calculator</CardTitle>
                    <CardDescription>Weighted Average Cost of Capital</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="wacc-mode" className="text-sm">
                      Detailed
                    </Label>
                    <Switch
                      id="wacc-mode"
                      checked={waccMode === 'detailed'}
                      onCheckedChange={(checked) => setWaccMode(checked ? 'detailed' : 'simple')}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {waccMode === 'simple' ? (
                  <div className="space-y-2">
                    <Label>WACC (%)</Label>
                    <Input
                      type="number"
                      value={waccSimpleInputs.waccValue}
                      onChange={(e) => setWaccSimpleInputs({ waccValue: Number(e.target.value) })}
                      step="0.5"
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the discount rate directly for quick analysis
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        CAPM-Based Calculation
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Cost of Equity = Risk-Free Rate + Beta × Market Risk Premium
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Risk-Free Rate (%)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.riskFreeRate}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              riskFreeRate: Number(e.target.value),
                            })
                          }
                          step="0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Market Risk Premium (%)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.marketRiskPremium}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              marketRiskPremium: Number(e.target.value),
                            })
                          }
                          step="0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Beta (β)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.beta}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              beta: Number(e.target.value),
                            })
                          }
                          step="0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cost of Debt (%)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.costOfDebt}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              costOfDebt: Number(e.target.value),
                            })
                          }
                          step="0.1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tax Rate (%)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.taxRate}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              taxRate: Number(e.target.value),
                            })
                          }
                          step="1"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Debt Ratio (%)</Label>
                        <Input
                          type="number"
                          value={waccDetailedInputs.debtRatio}
                          onChange={(e) =>
                            setWaccDetailedInputs({
                              ...waccDetailedInputs,
                              debtRatio: Number(e.target.value),
                            })
                          }
                          step="1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={handleCalculateWACC} disabled={isCalculating} className="w-full">
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Calculate WACC
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WACC Result</CardTitle>
                <CardDescription>Calculated weighted average cost of capital</CardDescription>
              </CardHeader>
              <CardContent>
                {waccResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-sm text-muted-foreground">WACC</div>
                      <div className="text-3xl font-bold text-primary">
                        {formatPercent(waccResult.wacc)}
                      </div>
                    </div>
                    {waccResult.components && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost of Equity:</span>
                          <span>{formatPercent(waccResult.components.costOfEquity)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">After-Tax Cost of Debt:</span>
                          <span>{formatPercent(waccResult.components.afterTaxCostOfDebt)}</span>
                        </div>
                      </div>
                    )}
                    <Separator />
                    <Badge variant="outline">
                      Mode: {waccResult.mode === 'detailed' ? 'CAPM-Based' : 'Simple'}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    Enter inputs and click Calculate
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {waccResult && waccResult.steps.length > 0 && (
            <ValuationFormulaDisplay steps={waccResult.steps} title="WACC Calculation Steps" />
          )}
        </TabsContent>

        <TabsContent value="monte-carlo" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monte Carlo Simulation</CardTitle>
                <CardDescription>Probabilistic valuation with 1,000 iterations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="mb-1 font-medium">Distribution Parameters</div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>Growth Rate: μ={dcfInputs.growthRate}%, σ=3%</li>
                    <li>Terminal Growth: μ={dcfInputs.terminalGrowthRate}%, σ=1.5%</li>
                    <li>Discount Rate: μ={dcfInputs.discountRate}%, σ=2%</li>
                  </ul>
                </div>

                <Button onClick={handleRunMonteCarlo} disabled={isCalculating} className="w-full">
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run Monte Carlo Simulation
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
                <CardDescription>Statistical distribution of enterprise values</CardDescription>
              </CardHeader>
              <CardContent>
                {monteCarloResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xs text-muted-foreground">Mean</div>
                        <div className="font-bold">
                          {formatCurrency(monteCarloResult.statistics.mean)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xs text-muted-foreground">Median</div>
                        <div className="font-bold">
                          {formatCurrency(monteCarloResult.statistics.median)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xs text-muted-foreground">Std Dev</div>
                        <div className="font-bold">
                          {formatCurrency(monteCarloResult.statistics.stdDev)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Percentiles</div>
                      <div className="grid grid-cols-5 gap-1 text-xs">
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">P5</div>
                          <div>{formatCurrency(monteCarloResult.statistics.percentiles.p5)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">P25</div>
                          <div>{formatCurrency(monteCarloResult.statistics.percentiles.p25)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">P50</div>
                          <div>{formatCurrency(monteCarloResult.statistics.percentiles.p50)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">P75</div>
                          <div>{formatCurrency(monteCarloResult.statistics.percentiles.p75)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">P95</div>
                          <div>{formatCurrency(monteCarloResult.statistics.percentiles.p95)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{monteCarloResult.iterations} iterations</Badge>
                      <Badge variant="outline">{monteCarloResult.executionTimeMs}ms</Badge>
                      <Badge variant="outline">{monteCarloResult.source}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    Click Run to start simulation
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {monteCarloResult && monteCarloResult.steps.length > 0 && (
            <ValuationFormulaDisplay steps={monteCarloResult.steps} title="Monte Carlo Steps" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
