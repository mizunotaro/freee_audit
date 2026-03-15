'use client'

import { useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Play,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Calculator,
  TrendingUp,
  BarChart3,
  PieChart,
  Layers,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ValuationFormulaDisplay } from '@/components/valuation/valuation-formula-display'
import { WACCInputPanel } from '@/components/valuation/wacc-input-panel'
import { ValuationCharts } from '@/components/valuation/valuation-charts'
import { ValuationAIAdvisor } from '@/components/valuation/valuation-ai-advisor'
import {
  calculateDCF,
  calculateWACC,
  runMonteCarloSimulation,
  getWACCAdvice,
  calculateAssetBased,
  calculateBlackScholes,
  calculateScenario,
  type DCFInputs,
  type DCFResult,
  type WACCInputs,
  type WACCResult,
  type MonteCarloInputs,
  type MonteCarloResult,
  type WACCAdviceResponse,
  type AssetBasedInputs,
  type AssetBasedResult,
  type BlackScholesInputs,
  type BlackScholesResult,
  type ScenarioInputs,
  type ScenarioResult,
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

interface WACCDetailedInputState {
  riskFreeRate: number
  marketRiskPremium: number
  beta: number
  costOfDebt: number
  taxRate: number
  debtRatio: number
}

interface AssetBasedInputState {
  totalAssets: number
  totalLiabilities: number
  intangibleAssets: number
  liquidationDiscount: number
}

interface BlackScholesInputState {
  spotPrice: number
  strikePrice: number
  timeToMaturity: number
  riskFreeRate: number
  volatility: number
  optionType: 'call' | 'put'
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
  const [waccSimpleValue, setWaccSimpleValue] = useState(10)
  const [waccDetailedInputs, setWaccDetailedInputs] = useState<WACCDetailedInputState>({
    riskFreeRate: 0.8,
    marketRiskPremium: 6.0,
    beta: 1.0,
    costOfDebt: 2.5,
    taxRate: 30.0,
    debtRatio: 30.0,
  })

  const [assetInputs, setAssetInputs] = useState<AssetBasedInputState>({
    totalAssets: 5000,
    totalLiabilities: 2000,
    intangibleAssets: 500,
    liquidationDiscount: 20,
  })

  const [bsInputs, setBsInputs] = useState<BlackScholesInputState>({
    spotPrice: 100,
    strikePrice: 100,
    timeToMaturity: 1,
    riskFreeRate: 1,
    volatility: 25,
    optionType: 'call',
  })

  const [industry, setIndustry] = useState('software')

  const [dcfResult, setDcfResult] = useState<DCFResult | null>(null)
  const [waccResult, setWaccResult] = useState<WACCResult | null>(null)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null)
  const [assetResult, setAssetResult] = useState<AssetBasedResult | null>(null)
  const [bsResult, setBsResult] = useState<BlackScholesResult | null>(null)
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [calculationSteps, setCalculationSteps] = useState<CalculationStep[]>([])

  const [waccAdvice, setWaccAdvice] = useState<WACCAdviceResponse | null>(null)
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false)

  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWACCAdvice = useCallback(async () => {
    setIsLoadingAdvice(true)
    try {
      const result = await getWACCAdvice({ industry })
      if (result.success) {
        setWaccAdvice(result.data)
      }
    } catch {
      console.error('Failed to load WACC advice')
    } finally {
      setIsLoadingAdvice(false)
    }
  }, [industry])

  useEffect(() => {
    if (waccMode === 'detailed') {
      loadWACCAdvice()
    }
  }, [waccMode, industry, loadWACCAdvice])

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
          simpleWACC: waccSimpleValue / 100,
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
  }, [waccMode, waccSimpleValue, waccDetailedInputs])

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

  const handleCalculateAssetBased = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      const inputs: AssetBasedInputs = {
        totalAssets: assetInputs.totalAssets,
        totalLiabilities: assetInputs.totalLiabilities,
        intangibleAssets: assetInputs.intangibleAssets,
        liquidationDiscount: assetInputs.liquidationDiscount / 100,
        currency: 'JPY',
        unit: 'million',
      }

      const result = calculateAssetBased(inputs)

      if (result.success) {
        setAssetResult(result.data)
        setCalculationSteps(result.data.steps)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
    }
  }, [assetInputs])

  const handleCalculateBlackScholes = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      const inputs: BlackScholesInputs = {
        spotPrice: bsInputs.spotPrice,
        strikePrice: bsInputs.strikePrice,
        timeToMaturity: bsInputs.timeToMaturity,
        riskFreeRate: bsInputs.riskFreeRate / 100,
        volatility: bsInputs.volatility / 100,
        optionType: bsInputs.optionType,
      }

      const result = calculateBlackScholes(inputs)

      if (result.success) {
        setBsResult(result.data)
        setCalculationSteps(result.data.steps)
      } else {
        setError(result.error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCalculating(false)
    }
  }, [bsInputs])

  const handleRunScenario = useCallback(async () => {
    setIsCalculating(true)
    setError(null)

    try {
      const inputs: ScenarioInputs = {
        baseInputs: {
          freeCashFlow: dcfInputs.freeCashFlow,
          growthRate: dcfInputs.growthRate / 100,
          terminalGrowthRate: dcfInputs.terminalGrowthRate / 100,
          discountRate: dcfInputs.discountRate / 100,
          projectionYears: dcfInputs.projectionYears,
          currency: 'JPY',
          unit: 'million',
        },
        scenarios: [
          {
            name: 'Optimistic',
            type: 'optimistic',
            adjustments: {
              growthRate: { factor: 1.2, type: 'multiply' },
              terminalGrowthRate: { factor: 1.1, type: 'multiply' },
            },
          },
          {
            name: 'Base Case',
            type: 'base',
            adjustments: {},
          },
          {
            name: 'Pessimistic',
            type: 'pessimistic',
            adjustments: {
              growthRate: { factor: 0.8, type: 'multiply' },
              terminalGrowthRate: { factor: 0.9, type: 'multiply' },
            },
          },
        ],
      }

      const result = calculateScenario(inputs)

      if (result.success) {
        setScenarioResult(result.data)
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

  const formatCurrency = (value: number): string => {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} MM JPY`
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dcf">
            <TrendingUp className="mr-1 h-4 w-4" />
            DCF
          </TabsTrigger>
          <TabsTrigger value="wacc">
            <PieChart className="mr-1 h-4 w-4" />
            WACC
          </TabsTrigger>
          <TabsTrigger value="monte-carlo">
            <BarChart3 className="mr-1 h-4 w-4" />
            Monte Carlo
          </TabsTrigger>
          <TabsTrigger value="asset-based">
            <Layers className="mr-1 h-4 w-4" />
            Asset
          </TabsTrigger>
          <TabsTrigger value="black-scholes">Options</TabsTrigger>
          <TabsTrigger value="scenario">Scenario</TabsTrigger>
        </TabsList>

        <TabsContent value="dcf" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
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

            <div className="space-y-4">
              <ValuationCharts dcfResult={dcfResult} monteCarloResult={monteCarloResult} />
            </div>
          </div>

          {calculationSteps.length > 0 && (
            <ValuationFormulaDisplay steps={calculationSteps} title="DCF Calculation Steps" />
          )}
        </TabsContent>

        <TabsContent value="wacc" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WACCInputPanel
                mode={waccMode}
                onModeChange={setWaccMode}
                simpleValue={waccSimpleValue}
                onSimpleValueChange={setWaccSimpleValue}
                detailedInputs={waccDetailedInputs}
                onDetailedInputsChange={setWaccDetailedInputs}
                result={waccResult}
                onCalculate={handleCalculateWACC}
                isCalculating={isCalculating}
                advice={waccAdvice}
                isLoadingAdvice={isLoadingAdvice}
                industry={industry}
                onIndustryChange={setIndustry}
              />
            </div>

            <ValuationAIAdvisor
              advice={waccAdvice}
              qaResult={null}
              isLoading={isLoadingAdvice}
              onRefresh={loadWACCAdvice}
            />
          </div>

          {waccResult && waccResult.steps.length > 0 && (
            <ValuationFormulaDisplay steps={waccResult.steps} title="WACC Calculation Steps" />
          )}
        </TabsContent>

        <TabsContent value="monte-carlo" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
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

            <ValuationCharts monteCarloResult={monteCarloResult} />
          </div>

          {monteCarloResult && monteCarloResult.steps.length > 0 && (
            <ValuationFormulaDisplay steps={monteCarloResult.steps} title="Monte Carlo Steps" />
          )}
        </TabsContent>

        <TabsContent value="asset-based" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Asset-Based Valuation</CardTitle>
                <CardDescription>Book value and liquidation value analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Assets (MM JPY)</Label>
                    <Input
                      type="number"
                      value={assetInputs.totalAssets}
                      onChange={(e) =>
                        setAssetInputs({ ...assetInputs, totalAssets: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Total Liabilities (MM JPY)</Label>
                    <Input
                      type="number"
                      value={assetInputs.totalLiabilities}
                      onChange={(e) =>
                        setAssetInputs({ ...assetInputs, totalLiabilities: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Intangible Assets (MM JPY)</Label>
                    <Input
                      type="number"
                      value={assetInputs.intangibleAssets}
                      onChange={(e) =>
                        setAssetInputs({ ...assetInputs, intangibleAssets: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Liquidation Discount (%)</Label>
                    <Input
                      type="number"
                      value={assetInputs.liquidationDiscount}
                      onChange={(e) =>
                        setAssetInputs({
                          ...assetInputs,
                          liquidationDiscount: Number(e.target.value),
                        })
                      }
                      step="5"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleCalculateAssetBased}
                  disabled={isCalculating}
                  className="w-full"
                >
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Calculate Asset Value
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Asset-Based Result</CardTitle>
                <CardDescription>Valuation based on net assets</CardDescription>
              </CardHeader>
              <CardContent>
                {assetResult ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Book Value</div>
                        <div className="text-2xl font-bold">
                          {formatCurrency(assetResult.metadata.bookValue)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Enterprise Value</div>
                        <div className="text-2xl font-bold text-primary">
                          {formatCurrency(assetResult.enterpriseValue)}
                        </div>
                      </div>
                    </div>
                    {assetResult.metadata.liquidationValue !== undefined && (
                      <div className="rounded-lg border p-4">
                        <div className="text-sm text-muted-foreground">Liquidation Value</div>
                        <div className="text-xl font-bold">
                          {formatCurrency(assetResult.metadata.liquidationValue)}
                        </div>
                      </div>
                    )}
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
            <ValuationFormulaDisplay steps={calculationSteps} title="Asset-Based Steps" />
          )}
        </TabsContent>

        <TabsContent value="black-scholes" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Black-Scholes Option Pricing</CardTitle>
                <CardDescription>European option valuation model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Spot Price</Label>
                    <Input
                      type="number"
                      value={bsInputs.spotPrice}
                      onChange={(e) =>
                        setBsInputs({ ...bsInputs, spotPrice: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Strike Price</Label>
                    <Input
                      type="number"
                      value={bsInputs.strikePrice}
                      onChange={(e) =>
                        setBsInputs({ ...bsInputs, strikePrice: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time to Maturity (years)</Label>
                    <Input
                      type="number"
                      value={bsInputs.timeToMaturity}
                      onChange={(e) =>
                        setBsInputs({ ...bsInputs, timeToMaturity: Number(e.target.value) })
                      }
                      step="0.25"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Risk-Free Rate (%)</Label>
                    <Input
                      type="number"
                      value={bsInputs.riskFreeRate}
                      onChange={(e) =>
                        setBsInputs({ ...bsInputs, riskFreeRate: Number(e.target.value) })
                      }
                      step="0.5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Volatility (%)</Label>
                    <Input
                      type="number"
                      value={bsInputs.volatility}
                      onChange={(e) =>
                        setBsInputs({ ...bsInputs, volatility: Number(e.target.value) })
                      }
                      step="5"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Option Type</Label>
                    <select
                      value={bsInputs.optionType}
                      onChange={(e) =>
                        setBsInputs({
                          ...bsInputs,
                          optionType: e.target.value as 'call' | 'put',
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                  </div>
                </div>

                <Button
                  onClick={handleCalculateBlackScholes}
                  disabled={isCalculating}
                  className="w-full"
                >
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Calculate Option Value
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Option Valuation Result</CardTitle>
                <CardDescription>Black-Scholes model output</CardDescription>
              </CardHeader>
              <CardContent>
                {bsResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4 text-center">
                      <div className="text-sm text-muted-foreground">
                        {bsResult.optionType === 'call' ? 'Call' : 'Put'} Option Value
                      </div>
                      <div className="text-3xl font-bold text-primary">
                        {bsResult.optionValue.toFixed(4)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Greeks</div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">Delta</div>
                          <div className="font-medium">{bsResult.greeks.delta.toFixed(4)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">Gamma</div>
                          <div className="font-medium">{bsResult.greeks.gamma.toFixed(4)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">Theta</div>
                          <div className="font-medium">{bsResult.greeks.theta.toFixed(4)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">Vega</div>
                          <div className="font-medium">{bsResult.greeks.vega.toFixed(4)}</div>
                        </div>
                        <div className="rounded bg-muted p-2 text-center">
                          <div className="text-muted-foreground">Rho</div>
                          <div className="font-medium">{bsResult.greeks.rho.toFixed(4)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">d1:</span>
                        <span>{bsResult.d1.toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">d2:</span>
                        <span>{bsResult.d2.toFixed(4)}</span>
                      </div>
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
            <ValuationFormulaDisplay steps={calculationSteps} title="Black-Scholes Steps" />
          )}
        </TabsContent>

        <TabsContent value="scenario" className="space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Scenario Analysis</CardTitle>
                <CardDescription>Multi-scenario DCF valuation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="mb-1 font-medium">Base Parameters (from DCF inputs)</div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>FCF: {dcfInputs.freeCashFlow} MM JPY</li>
                    <li>Growth Rate: {dcfInputs.growthRate}%</li>
                    <li>Terminal Growth: {dcfInputs.terminalGrowthRate}%</li>
                    <li>Discount Rate: {dcfInputs.discountRate}%</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950/30">
                  <div className="mb-1 font-medium">Scenario Adjustments</div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>Optimistic: Growth ×1.2, Terminal ×1.1</li>
                    <li>Base Case: No adjustments</li>
                    <li>Pessimistic: Growth ×0.8, Terminal ×0.9</li>
                  </ul>
                </div>

                <Button onClick={handleRunScenario} disabled={isCalculating} className="w-full">
                  {isCalculating ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run Scenario Analysis
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scenario Results</CardTitle>
                <CardDescription>Valuation across different scenarios</CardDescription>
              </CardHeader>
              <CardContent>
                {scenarioResult ? (
                  <div className="space-y-4">
                    {scenarioResult.scenarios.map((scenario) => (
                      <div
                        key={scenario.name}
                        className={`rounded-lg border p-3 ${
                          scenario.type === 'optimistic'
                            ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
                            : scenario.type === 'pessimistic'
                              ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                              : 'bg-muted/50'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-sm font-medium">{scenario.name}</span>
                          <span className="text-lg font-bold">
                            {formatCurrency(scenario.value)}
                          </span>
                        </div>
                      </div>
                    ))}

                    <Separator />

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xs text-muted-foreground">Weighted Average</div>
                        <div className="font-bold">
                          {formatCurrency(scenarioResult.weightedAverage)}
                        </div>
                      </div>
                      <div className="rounded-lg border p-3 text-center">
                        <div className="text-xs text-muted-foreground">Range</div>
                        <div className="text-xs font-bold">
                          {formatCurrency(scenarioResult.range.min)} -{' '}
                          {formatCurrency(scenarioResult.range.max)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    Click Run to analyze scenarios
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {calculationSteps.length > 0 && (
            <ValuationFormulaDisplay steps={calculationSteps} title="Scenario Analysis Steps" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
