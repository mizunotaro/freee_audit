'use client'

import { useState, useCallback } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AccountCodeSelector } from './account-code-selector'

import type {
  ChartOfAccountItem,
  AccountMapping,
  MappingType,
  ConversionRule,
} from '@/types/conversion'

interface MappingEditorProps {
  sourceItems: ChartOfAccountItem[]
  targetItems: ChartOfAccountItem[]
  mapping?: AccountMapping
  onSave: (mapping: MappingEditorValue) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
  aiSuggestion?: {
    targetCode: string
    confidence: number
    reasoning: string
  }
}

export interface MappingEditorValue {
  sourceItemId: string
  targetItemId: string
  mappingType: MappingType
  conversionRule?: ConversionRule
  percentage?: number
  notes?: string
}

const MAPPING_TYPE_LABELS: Record<MappingType, { label: string; description: string }> = {
  '1to1': {
    label: '1対1',
    description: '単一の勘定科目に直接マッピング',
  },
  '1toN': {
    label: '1対N（分割）',
    description: '複数の勘定科目に配分',
  },
  Nto1: {
    label: 'N対1（統合）',
    description: '複数の勘定科目を統合',
  },
  complex: {
    label: '条件付き',
    description: '条件に基づいて振分',
  },
}

export function MappingEditor({
  sourceItems,
  targetItems,
  mapping,
  onSave,
  onDelete,
  onCancel,
  aiSuggestion,
}: MappingEditorProps) {
  const [loading, setLoading] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [sourceItem, setSourceItem] = useState<ChartOfAccountItem | null>(
    mapping
      ? sourceItems.find(
          (i) => i.id === mapping.sourceAccountId || i.id === mapping.sourceItemId
        ) || null
      : null
  )
  const [targetItem, setTargetItem] = useState<ChartOfAccountItem | null>(
    mapping
      ? targetItems.find(
          (i) => i.id === mapping.targetAccountId || i.id === mapping.targetItemId
        ) || null
      : null
  )
  const [mappingType, setMappingType] = useState<MappingType>(mapping?.mappingType || '1to1')
  const percentage = mapping?.percentage || 100
  const [notes, setNotes] = useState(mapping?.notes || '')

  const [splitTargets, setSplitTargets] = useState<
    Array<{
      itemId: string
      percentage: number
    }>
  >(
    mapping?.mappingType === '1toN'
      ? [{ itemId: mapping.targetAccountId || mapping.targetItemId || '', percentage: 100 }]
      : []
  )

  const [conditions, setConditions] = useState<
    Array<{
      field: string
      operator: string
      value: string
      targetItemId: string
    }>
  >([])

  const isValid = useCallback(() => {
    if (!sourceItem) return false

    if (mappingType === '1to1') {
      return !!targetItem
    }

    if (mappingType === '1toN') {
      return (
        splitTargets.length > 0 &&
        splitTargets.every((t) => t.itemId) &&
        splitTargets.reduce((sum, t) => sum + t.percentage, 0) === 100
      )
    }

    if (mappingType === 'complex') {
      return conditions.length > 0 && conditions.every((c) => c.targetItemId)
    }

    return true
  }, [sourceItem, targetItem, mappingType, splitTargets, conditions])

  const handleSave = async () => {
    if (!isValid()) return

    setLoading(true)
    try {
      const value: MappingEditorValue = {
        sourceItemId: sourceItem!.id,
        targetItemId: mappingType === '1toN' ? '' : targetItem!.id,
        mappingType,
        percentage: mappingType === '1to1' ? undefined : percentage,
        notes: notes || undefined,
      }

      if (mappingType === '1toN') {
        value.conversionRule = {
          type: 'percentage',
          percentage: splitTargets.reduce((sum, t) => sum + t.percentage, 0),
        }
      }

      if (mappingType === 'complex') {
        value.conversionRule = {
          type: 'formula',
          conditions: conditions.map((c) => ({
            field: c.field,
            operator: c.operator as 'equals' | 'contains' | 'gt' | 'lt' | 'between',
            value: c.value,
            targetAccountId: c.targetItemId,
          })),
        }
      }

      await onSave(value)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setLoading(true)
    try {
      await onDelete()
      setShowDeleteDialog(false)
    } finally {
      setLoading(false)
    }
  }

  const addSplitTarget = () => {
    setSplitTargets([...splitTargets, { itemId: '', percentage: 0 }])
  }

  const updateSplitTarget = (
    index: number,
    field: 'itemId' | 'percentage',
    value: string | number
  ) => {
    const updated = [...splitTargets]
    updated[index] = { ...updated[index], [field]: value }
    setSplitTargets(updated)
  }

  const removeSplitTarget = (index: number) => {
    setSplitTargets(splitTargets.filter((_, i) => i !== index))
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return
    const suggested = targetItems.find((i) => i.code === aiSuggestion.targetCode)
    if (suggested) {
      setTargetItem(suggested)
      setMappingType('1to1')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mapping ? 'マッピング編集' : '新規マッピング'}</CardTitle>
        <CardDescription>
          ソース勘定科目とターゲット勘定科目のマッピングを設定します
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {aiSuggestion && !mapping && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">AI推奨</Badge>
                <span className="text-sm">
                  信頼度: {(aiSuggestion.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <Button size="sm" onClick={applyAiSuggestion}>
                推奨を適用
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{aiSuggestion.reasoning}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>ソース勘定科目</Label>
          <AccountCodeSelector
            items={sourceItems}
            value={sourceItem?.id}
            onChange={(id, item) => setSourceItem(item)}
            placeholder="JGAAP勘定科目を選択"
            disabled={!!mapping}
          />
        </div>

        <div className="space-y-2">
          <Label>マッピングタイプ</Label>
          <Select value={mappingType} onValueChange={(v) => setMappingType(v as MappingType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MAPPING_TYPE_LABELS).map(([type, info]) => (
                <SelectItem key={type} value={type}>
                  <div className="flex flex-col">
                    <span>{info.label}</span>
                    <span className="text-xs text-muted-foreground">{info.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mappingType === '1to1' && (
          <div className="space-y-2">
            <Label>ターゲット勘定科目</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AccountCodeSelector
                  items={targetItems}
                  value={targetItem?.id}
                  onChange={(id, item) => setTargetItem(item)}
                  placeholder="USGAAP/IFRS勘定科目を選択"
                  showEnglishName
                />
              </div>
            </div>
          </div>
        )}

        {mappingType === '1toN' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>分割先勘定科目</Label>
              <Button size="sm" variant="outline" onClick={addSplitTarget}>
                <Plus className="mr-1 h-4 w-4" />
                追加
              </Button>
            </div>

            <div className="space-y-3">
              {splitTargets.map((target, index) => (
                <div key={index} className="flex items-end gap-2">
                  <div className="flex-1">
                    <AccountCodeSelector
                      items={targetItems}
                      value={target.itemId}
                      onChange={(_id, _item) => updateSplitTarget(index, 'itemId', _id)}
                      placeholder="勘定科目を選択"
                      showEnglishName
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">配分%</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={target.percentage}
                      onChange={(e) =>
                        updateSplitTarget(index, 'percentage', Number(e.target.value))
                      }
                    />
                  </div>
                  {splitTargets.length > 1 && (
                    <Button size="icon" variant="ghost" onClick={() => removeSplitTarget(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {splitTargets.reduce((sum, t) => sum + t.percentage, 0) !== 100 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>配分の合計が100%になりません</span>
              </div>
            )}
          </div>
        )}

        {mappingType === 'complex' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>条件ルール</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setConditions([
                    ...conditions,
                    {
                      field: 'description',
                      operator: 'contains',
                      value: '',
                      targetItemId: '',
                    },
                  ])
                }
              >
                <Plus className="mr-1 h-4 w-4" />
                条件追加
              </Button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="grid grid-cols-[1fr_auto_1fr_1fr_auto] items-end gap-2">
                  <div>
                    <Label className="text-xs">フィールド</Label>
                    <Select
                      value={condition.field}
                      onValueChange={(v) => {
                        const updated = [...conditions]
                        updated[index].field = v
                        setConditions(updated)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="description">摘要</SelectItem>
                        <SelectItem value="partnerName">取引先名</SelectItem>
                        <SelectItem value="amount">金額</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">条件</Label>
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => {
                        const updated = [...conditions]
                        updated[index].operator = v
                        setConditions(updated)
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">＝</SelectItem>
                        <SelectItem value="contains">含む</SelectItem>
                        <SelectItem value="gt">＞</SelectItem>
                        <SelectItem value="lt">＜</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">値</Label>
                    <Input
                      value={condition.value}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[index].value = e.target.value
                        setConditions(updated)
                      }}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">→ ターゲット</Label>
                    <AccountCodeSelector
                      items={targetItems}
                      value={condition.targetItemId}
                      onChange={(id) => {
                        const updated = [...conditions]
                        updated[index].targetItemId = id
                        setConditions(updated)
                      }}
                      placeholder="勘定科目"
                    />
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>メモ（任意）</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="マッピングに関する補足情報"
            rows={3}
          />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {mapping && onDelete && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                disabled={loading}
              >
                削除
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!isValid() || loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </CardContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>マッピングの削除</AlertDialogTitle>
            <AlertDialogDescription>
              このマッピングを削除してもよろしいですか？ この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
