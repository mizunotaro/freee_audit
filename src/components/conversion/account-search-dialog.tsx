'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Check } from 'lucide-react'
import type { ChartOfAccountItem } from '@/types/conversion'

interface AccountSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ChartOfAccountItem[]
  onSelect: (item: ChartOfAccountItem) => void
  selectedId?: string
  title?: string
  description?: string
}

export function AccountSearchDialog({
  open,
  onOpenChange,
  items,
  onSelect,
  selectedId,
  title = '勘定科目検索',
  description = '勘定科目を検索して選択してください',
}: AccountSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items

    const query = searchQuery.toLowerCase()
    return items.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query) ||
        item.nameEn.toLowerCase().includes(query)
    )
  }, [items, searchQuery])

  const handleSelect = (item: ChartOfAccountItem) => {
    onSelect(item)
    onOpenChange(false)
    setSearchQuery('')
  }

  const groupedItems = useMemo(() => {
    const groups: Record<string, ChartOfAccountItem[]> = {}

    for (const item of filteredItems) {
      const category = item.category || 'other'
      if (!groups[category]) {
        groups[category] = []
      }
      groups[category].push(item)
    }

    return groups
  }, [filteredItems])

  const categoryLabels: Record<string, string> = {
    current_asset: '流動資産',
    fixed_asset: '固定資産',
    deferred_asset: '繰延資産',
    current_liability: '流動負債',
    fixed_liability: '固定負債',
    deferred_liability: '繰延負債',
    equity: '純資産',
    revenue: '売上',
    cogs: '売上原価',
    sga_expense: '販売費及び一般管理費',
    non_operating_income: '営業外収益',
    non_operating_expense: '営業外費用',
    extraordinary_income: '特別利益',
    extraordinary_loss: '特別損失',
    other: 'その他',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="コードまたは名称で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="mb-4">
              <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                {categoryLabels[category] || category}
              </h4>
              <div className="space-y-1">
                {categoryItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted ${
                      selectedId === item.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.code}</code>
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.nameEn}</p>
                    </div>
                    {selectedId === item.id && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {filteredItems.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">検索結果がありません</div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
