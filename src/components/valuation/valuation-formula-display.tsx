'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Calculator, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { CalculationStep } from '@/services/valuation/types'

interface ValuationFormulaDisplayProps {
  steps: CalculationStep[]
  title?: string
  maxDepth?: number
  className?: string
}

export function ValuationFormulaDisplay({
  steps,
  title = 'Calculation Steps',
  maxDepth = 3,
  className,
}: ValuationFormulaDisplayProps) {
  return (
    <div className={cn('rounded-lg border', className)}>
      <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-medium">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {steps.length} steps
        </Badge>
      </div>
      <ScrollArea className="max-h-[400px]">
        <div className="p-4">
          {steps.map((step, index) => (
            <FormulaStepItem
              key={step.id}
              step={step}
              depth={0}
              maxDepth={maxDepth}
              index={index}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

interface FormulaStepItemProps {
  step: CalculationStep
  depth: number
  maxDepth: number
  index: number
}

function FormulaStepItem({ step, depth, maxDepth, index }: FormulaStepItemProps) {
  const [isOpen, setIsOpen] = useState(depth === 0)
  const hasChildren = step.children && step.children.length > 0
  const indentStyle = { paddingLeft: `${depth * 16}px` }

  if (depth > maxDepth) return null

  return (
    <div style={indentStyle} className="mb-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={cn(
            'rounded-lg border transition-colors',
            isOpen ? 'bg-muted/30' : 'hover:bg-muted/20'
          )}
        >
          <CollapsibleTrigger className="flex w-full items-start gap-2 p-3 text-left">
            <div className="mt-0.5 flex-shrink-0">
              {hasChildren ? (
                isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )
              ) : (
                <div className="flex h-4 w-4 items-center justify-center text-xs text-muted-foreground">
                  {index + 1}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">{step.name}</span>
                {step.unit && (
                  <Badge variant="outline" className="text-xs">
                    {step.unit}
                  </Badge>
                )}
              </div>

              {step.formula && (
                <div className="mb-1 overflow-x-auto rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                  {step.formula}
                </div>
              )}

              {step.formulaWithValues && (
                <div className="overflow-x-auto rounded bg-blue-50 px-2 py-1 font-mono text-xs text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  {step.formulaWithValues}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-right">
              <div className="text-sm font-bold">{formatResult(step.output, step.unit)}</div>
            </div>
          </CollapsibleTrigger>

          {hasChildren && (
            <CollapsibleContent>
              <div className="border-t px-3 pb-3 pt-2">
                {step.description && (
                  <div className="mb-3 flex items-start gap-2 rounded bg-muted/50 p-2 text-xs">
                    <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">{step.description}</span>
                  </div>
                )}
                {step.children?.map((child, childIndex) => (
                  <FormulaStepItem
                    key={child.id}
                    step={child}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                    index={childIndex}
                  />
                ))}
              </div>
            </CollapsibleContent>
          )}
        </div>
      </Collapsible>
    </div>
  )
}

function formatResult(value: number, unit?: string): string {
  const formattedValue = formatNumber(value)
  if (unit === 'currency' || unit === 'MM JPY') {
    return `${formattedValue} MM JPY`
  }
  if (unit === 'percent' || unit === '%') {
    return `${formattedValue}%`
  }
  if (unit === 'multiple' || unit === 'x') {
    return `${formattedValue}x`
  }
  return formattedValue
}

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e9) {
    return `${(num / 1e9).toFixed(2)}B`
  }
  if (Math.abs(num) >= 1e6) {
    return `${(num / 1e6).toFixed(2)}M`
  }
  if (Math.abs(num) >= 1e3) {
    return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  if (Math.abs(num) < 0.01 && num !== 0) {
    return num.toExponential(2)
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 4 })
}
