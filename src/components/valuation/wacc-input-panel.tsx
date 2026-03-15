'use client'

import { Info, TrendingUp, Calculator, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WACCResult, WACCAdviceResponse } from '@/services/valuation'

interface WACCInputPanelProps {
  mode: 'simple' | 'detailed'
  onModeChange: (mode: 'simple' | 'detailed') => void
  simpleValue: number
  onSimpleValueChange: (value: number) => void
  detailedInputs: {
    riskFreeRate: number
    marketRiskPremium: number
    beta: number
    costOfDebt: number
    taxRate: number
    debtRatio: number
  }
  onDetailedInputsChange: (inputs: WACCInputPanelProps['detailedInputs']) => void
  result: WACCResult | null
  onCalculate: () => void
  isCalculating: boolean
  advice: WACCAdviceResponse | null
  isLoadingAdvice: boolean
  industry: string
  onIndustryChange: (industry: string) => void
  className?: string
}

const INDUSTRY_OPTIONS = [
  { value: 'software', label: 'Software / IT' },
  { value: 'saas', label: 'SaaS' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'energy', label: 'Energy' },
  { value: 'real_estate', label: 'Real Estate' },
]

export function WACCInputPanel({
  mode,
  onModeChange,
  simpleValue,
  onSimpleValueChange,
  detailedInputs,
  onDetailedInputsChange,
  result,
  onCalculate,
  isCalculating,
  advice,
  isLoadingAdvice,
  industry,
  onIndustryChange,
  className,
}: WACCInputPanelProps) {
  const applyAdvice = () => {
    if (!advice) return
    onDetailedInputsChange({
      riskFreeRate: advice.recommendedValues.riskFreeRate * 100,
      marketRiskPremium: advice.recommendedValues.marketRiskPremium * 100,
      beta: advice.recommendedValues.beta,
      costOfDebt: advice.recommendedValues.costOfDebt * 100,
      taxRate: advice.recommendedValues.taxRate * 100,
      debtRatio: advice.recommendedValues.debtRatio * 100,
    })
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              WACC Calculator
            </CardTitle>
            <CardDescription>Weighted Average Cost of Capital</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="wacc-mode" className="text-sm font-normal">
              Simple
            </Label>
            <Switch
              id="wacc-mode"
              checked={mode === 'detailed'}
              onCheckedChange={(checked) => onModeChange(checked ? 'detailed' : 'simple')}
            />
            <Label htmlFor="wacc-mode" className="text-sm font-normal">
              CAPM
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === 'simple' ? (
          <div className="space-y-2">
            <Label htmlFor="wacc-simple">WACC (%)</Label>
            <Input
              id="wacc-simple"
              type="number"
              value={simpleValue}
              onChange={(e) => onSimpleValueChange(Number(e.target.value))}
              step="0.5"
              min="0"
              max="50"
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
              <p className="mb-3 text-xs text-muted-foreground">
                Cost of Equity = Risk-Free Rate + β × Market Risk Premium
              </p>
              <div className="flex gap-2">
                <select
                  value={industry}
                  onChange={(e) => onIndustryChange(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {INDUSTRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {advice && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                    <TrendingUp className="h-4 w-4" />
                    AI Recommendations
                  </div>
                  <Button size="sm" variant="outline" onClick={applyAdvice}>
                    Apply All
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Risk-Free:</span>
                    <span className="ml-1 font-medium">
                      {(advice.recommendedValues.riskFreeRate * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">β:</span>
                    <span className="ml-1 font-medium">
                      {advice.recommendedValues.beta.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">MRP:</span>
                    <span className="ml-1 font-medium">
                      {(advice.recommendedValues.marketRiskPremium * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {isLoadingAdvice && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <InputField
                id="risk-free-rate"
                label="Risk-Free Rate"
                suffix="%"
                value={detailedInputs.riskFreeRate}
                onChange={(v) => onDetailedInputsChange({ ...detailedInputs, riskFreeRate: v })}
                tooltip="Typically 10-year government bond yield (Japan: ~0.8%)"
              />
              <InputField
                id="market-risk-premium"
                label="Market Risk Premium"
                suffix="%"
                value={detailedInputs.marketRiskPremium}
                onChange={(v) =>
                  onDetailedInputsChange({ ...detailedInputs, marketRiskPremium: v })
                }
                tooltip="Expected market return over risk-free rate (typically 5-7%)"
              />
              <InputField
                id="beta"
                label="Beta (β)"
                suffix=""
                value={detailedInputs.beta}
                onChange={(v) => onDetailedInputsChange({ ...detailedInputs, beta: v })}
                step="0.1"
                tooltip="Systematic risk relative to market (1.0 = market average)"
              />
              <InputField
                id="cost-of-debt"
                label="Cost of Debt"
                suffix="%"
                value={detailedInputs.costOfDebt}
                onChange={(v) => onDetailedInputsChange({ ...detailedInputs, costOfDebt: v })}
                tooltip="Interest rate on company's debt"
              />
              <InputField
                id="tax-rate"
                label="Tax Rate"
                suffix="%"
                value={detailedInputs.taxRate}
                onChange={(v) => onDetailedInputsChange({ ...detailedInputs, taxRate: v })}
                tooltip="Effective corporate tax rate (Japan: ~30%)"
              />
              <InputField
                id="debt-ratio"
                label="Debt Ratio (D/D+E)"
                suffix="%"
                value={detailedInputs.debtRatio}
                onChange={(v) => onDetailedInputsChange({ ...detailedInputs, debtRatio: v })}
                tooltip="Proportion of debt in capital structure"
              />
            </div>
          </div>
        )}

        <Button onClick={onCalculate} disabled={isCalculating} className="w-full">
          {isCalculating ? 'Calculating...' : 'Calculate WACC'}
        </Button>

        {result && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">WACC</span>
              <Badge variant={mode === 'detailed' ? 'default' : 'secondary'}>
                {mode === 'detailed' ? 'CAPM-Based' : 'Simple'}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-primary">{(result.wacc * 100).toFixed(2)}%</div>
            {result.components && (
              <div className="mt-3 space-y-1 border-t pt-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cost of Equity:</span>
                  <span>{(result.components.costOfEquity * 100).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After-Tax Cost of Debt:</span>
                  <span>{(result.components.afterTaxCostOfDebt * 100).toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface InputFieldProps {
  id: string
  label: string
  suffix: string
  value: number
  onChange: (value: number) => void
  step?: string
  tooltip?: string
}

function InputField({
  id,
  label,
  suffix,
  value,
  onChange,
  step = '0.1',
  tooltip,
}: InputFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 cursor-help text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[200px] text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          className={suffix ? 'pr-8' : ''}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  )
}
