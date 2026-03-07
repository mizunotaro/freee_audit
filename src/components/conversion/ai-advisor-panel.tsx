'use client'

import { useState } from 'react'
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  BookOpen,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import type {
  MappingSuggestion,
  AdjustmentRecommendation,
  RiskAssessment,
} from '@/types/conversion'

interface AIAdvisorPanelProps {
  projectId: string
  mappingSuggestions?: MappingSuggestion[]
  adjustmentRecommendations?: AdjustmentRecommendation[]
  riskAssessments?: RiskAssessment[]
  onAcceptMappingSuggestion?: (suggestion: MappingSuggestion) => void
  onRejectMappingSuggestion?: (suggestion: MappingSuggestion) => void
  onAcceptAdjustment?: (adjustment: AdjustmentRecommendation) => void
  isLoading?: boolean
}

export function AIAdvisorPanel({
  projectId: _projectId,
  mappingSuggestions = [],
  adjustmentRecommendations = [],
  riskAssessments = [],
  onAcceptMappingSuggestion,
  onRejectMappingSuggestion,
  onAcceptAdjustment,
  isLoading = false,
}: AIAdvisorPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['mappings', 'adjustments', 'risks'])
  )

  const toggleSection = (section: string) => {
    const next = new Set(expandedSections)
    if (next.has(section)) {
      next.delete(section)
    } else {
      next.add(section)
    }
    setExpandedSections(next)
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3">
        <Sparkles className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-medium">AI アドバイザー</h3>
          <p className="text-sm text-muted-foreground">
            会計基準変換の専門家としてアドバイスを提供
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 p-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4 p-4">
            <Collapsible
              open={expandedSections.has('mappings')}
              onOpenChange={() => toggleSection('mappings')}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">マッピング推奨</span>
                  <Badge variant="secondary">{mappingSuggestions.length}</Badge>
                </div>
                {expandedSections.has('mappings') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-3 pt-2">
                {mappingSuggestions.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">推奨はありません</p>
                ) : (
                  mappingSuggestions.map((suggestion, index) => (
                    <MappingSuggestionCard
                      key={index}
                      suggestion={suggestion}
                      onAccept={() => onAcceptMappingSuggestion?.(suggestion)}
                      onReject={() => onRejectMappingSuggestion?.(suggestion)}
                    />
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible
              open={expandedSections.has('adjustments')}
              onOpenChange={() => toggleSection('adjustments')}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">調整仕訳推奨</span>
                  <Badge variant="secondary">{adjustmentRecommendations.length}</Badge>
                </div>
                {expandedSections.has('adjustments') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-3 pt-2">
                {adjustmentRecommendations.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">推奨はありません</p>
                ) : (
                  adjustmentRecommendations.map((adjustment, index) => (
                    <AdjustmentCard
                      key={index}
                      adjustment={adjustment}
                      onAccept={() => onAcceptAdjustment?.(adjustment)}
                    />
                  ))
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            <Collapsible
              open={expandedSections.has('risks')}
              onOpenChange={() => toggleSection('risks')}
            >
              <CollapsibleTrigger className="flex w-full items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">リスク評価</span>
                  <Badge variant="secondary">{riskAssessments.length}</Badge>
                </div>
                {expandedSections.has('risks') ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </CollapsibleTrigger>

              <CollapsibleContent className="space-y-3 pt-2">
                {riskAssessments.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">リスクは検出されませんでした</p>
                ) : (
                  riskAssessments.map((risk, index) => <RiskCard key={index} risk={risk} />)
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function MappingSuggestionCard({
  suggestion,
  onAccept,
  onReject,
}: {
  suggestion: MappingSuggestion
  onAccept: () => void
  onReject: () => void
}) {
  const confidencePercent = Math.round(suggestion.confidence * 100)

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-1 text-xs">{suggestion.sourceAccountCode}</code>
            <span className="font-medium">{suggestion.sourceAccountName}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>→</span>
            <code className="rounded bg-muted px-1 text-xs">{suggestion.suggestedTargetCode}</code>
            <span>{suggestion.suggestedTargetName}</span>
          </div>
        </div>

        <Badge
          variant={
            confidencePercent >= 90 ? 'default' : confidencePercent >= 70 ? 'secondary' : 'outline'
          }
        >
          {confidencePercent}%
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">{suggestion.reasoning}</p>

      {suggestion.alternatives && suggestion.alternatives.length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">代替案: </span>
          {suggestion.alternatives.map((alt, i) => (
            <span key={i} className="text-muted-foreground">
              {alt.code} ({Math.round(alt.confidence * 100)}%)
              {i < suggestion.alternatives.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onAccept}>
          <Check className="mr-1 h-3 w-3" />
          採用
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          <X className="mr-1 h-3 w-3" />
          却下
        </Button>
      </div>
    </div>
  )
}

function AdjustmentCard({
  adjustment,
  onAccept,
}: {
  adjustment: AdjustmentRecommendation
  onAccept: () => void
}) {
  const priorityConfig = {
    high: { label: '高', color: 'text-red-600 bg-red-50' },
    medium: { label: '中', color: 'text-yellow-600 bg-yellow-50' },
    low: { label: '低', color: 'text-gray-600 bg-gray-50' },
  }

  const config = priorityConfig[adjustment.priority]

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Badge className={config.color}>{config.label}優先度</Badge>
          <h4 className="font-medium">{adjustment.title}</h4>
        </div>
      </div>

      <p className="text-sm">{adjustment.description}</p>

      {adjustment.estimatedImpact && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {adjustment.estimatedImpact.assetChange !== undefined && (
            <div>
              <span className="text-muted-foreground">資産変動:</span>{' '}
              <span
                className={
                  adjustment.estimatedImpact.assetChange >= 0 ? 'text-green-600' : 'text-red-600'
                }
              >
                {adjustment.estimatedImpact.assetChange >= 0 ? '+' : ''}
                {adjustment.estimatedImpact.assetChange.toLocaleString()}
              </span>
            </div>
          )}
          {adjustment.estimatedImpact.netIncomeChange !== undefined && (
            <div>
              <span className="text-muted-foreground">純利益変動:</span>{' '}
              <span
                className={
                  adjustment.estimatedImpact.netIncomeChange >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {adjustment.estimatedImpact.netIncomeChange >= 0 ? '+' : ''}
                {adjustment.estimatedImpact.netIncomeChange.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="text-sm text-muted-foreground">{adjustment.reasoning}</p>

      {adjustment.references && adjustment.references.length > 0 && (
        <div className="text-xs text-muted-foreground">
          参照: {adjustment.references.join(', ')}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onAccept}>
          <Check className="mr-1 h-3 w-3" />
          調整を追加
        </Button>
      </div>
    </div>
  )
}

function RiskCard({ risk }: { risk: RiskAssessment }) {
  const levelConfig = {
    low: { label: '低', color: 'border-green-200 bg-green-50' },
    medium: { label: '中', color: 'border-yellow-200 bg-yellow-50' },
    high: { label: '高', color: 'border-red-200 bg-red-50' },
  }

  const config = levelConfig[risk.riskLevel]

  return (
    <div className={cn('rounded-lg border p-3', config.color)}>
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="outline">{config.label}リスク</Badge>
        <span className="font-medium">{risk.category}</span>
      </div>

      <p className="mb-2 text-sm">{risk.description}</p>

      <div className="text-sm">
        <span className="font-medium">緩和策:</span>{' '}
        <span className="text-muted-foreground">{risk.mitigationSuggestion}</span>
      </div>
    </div>
  )
}
