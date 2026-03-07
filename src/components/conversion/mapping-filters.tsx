'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Filter } from 'lucide-react'

export interface MappingFilterValues {
  search?: string
  mappingType?: string
  isApproved?: string
  isManualReview?: string
  minConfidence?: number
  sourceCoaId?: string
  targetCoaId?: string
}

interface MappingFiltersProps {
  filters: MappingFilterValues
  onFiltersChange: (filters: MappingFilterValues) => void
  sourceCoas: Array<{ id: string; name: string }>
  targetCoas: Array<{ id: string; name: string }>
}

export function MappingFilters({
  filters,
  onFiltersChange,
  sourceCoas,
  targetCoas,
}: MappingFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<MappingFilterValues>(filters)

  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== '')

  const handleApply = () => {
    onFiltersChange(localFilters)
    setIsOpen(false)
  }

  const handleClear = () => {
    const cleared: MappingFilterValues = {}
    setLocalFilters(cleared)
    onFiltersChange(cleared)
    setIsOpen(false)
  }

  const updateFilter = (key: keyof MappingFilterValues, value: unknown) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value === '' || value === undefined ? undefined : value,
    }))
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          フィルター
          {hasActiveFilters && (
            <span className="ml-2 rounded-full bg-primary px-2 text-xs text-primary-foreground">
              {Object.values(filters).filter((v) => v !== undefined && v !== '').length}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>フィルター</SheetTitle>
          <SheetDescription>マッピングの絞り込み条件を設定</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <Label>検索</Label>
            <Input
              placeholder="勘定科目名またはコード"
              value={localFilters.search ?? ''}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label>ソースCOA</Label>
            <Select
              value={localFilters.sourceCoaId ?? ''}
              onValueChange={(v) => updateFilter('sourceCoaId', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべて</SelectItem>
                {sourceCoas.map((coa) => (
                  <SelectItem key={coa.id} value={coa.id}>
                    {coa.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ターゲットCOA</Label>
            <Select
              value={localFilters.targetCoaId ?? ''}
              onValueChange={(v) => updateFilter('targetCoaId', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべて</SelectItem>
                {targetCoas.map((coa) => (
                  <SelectItem key={coa.id} value={coa.id}>
                    {coa.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>マッピングタイプ</Label>
            <Select
              value={localFilters.mappingType ?? ''}
              onValueChange={(v) => updateFilter('mappingType', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべて</SelectItem>
                <SelectItem value="1to1">1対1</SelectItem>
                <SelectItem value="1toN">1対多</SelectItem>
                <SelectItem value="Nto1">多対1</SelectItem>
                <SelectItem value="complex">複合</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>承認状態</Label>
            <Select
              value={localFilters.isApproved ?? ''}
              onValueChange={(v) => updateFilter('isApproved', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべて</SelectItem>
                <SelectItem value="true">承認済み</SelectItem>
                <SelectItem value="false">未承認</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>要レビュー</Label>
            <Select
              value={localFilters.isManualReview ?? ''}
              onValueChange={(v) => updateFilter('isManualReview', v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="すべて" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">すべて</SelectItem>
                <SelectItem value="true">要レビュー</SelectItem>
                <SelectItem value="false">レビュー不要</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>最低信頼度: {localFilters.minConfidence ?? 0}%</Label>
            <Slider
              value={[localFilters.minConfidence ?? 0]}
              onValueChange={([v]) => updateFilter('minConfidence', v)}
              max={100}
              step={5}
              className="mt-1.5"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleApply} className="flex-1">
              適用
            </Button>
            <Button variant="outline" onClick={handleClear}>
              クリア
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
