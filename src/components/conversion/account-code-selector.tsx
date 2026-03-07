'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ChartOfAccountItem, AccountCategory } from '@/types/conversion'

interface AccountCodeSelectorProps {
  items: ChartOfAccountItem[]
  value?: string
  onChange: (value: string, item: ChartOfAccountItem) => void
  placeholder?: string
  disabled?: boolean
  categoryFilter?: AccountCategory[]
  showCategoryBadge?: boolean
  showEnglishName?: boolean
}

const CATEGORY_LABELS: Record<AccountCategory, { ja: string; en: string; color: string }> = {
  current_asset: { ja: '流動資産', en: 'Current Asset', color: 'bg-blue-100 text-blue-800' },
  fixed_asset: { ja: '固定資産', en: 'Fixed Asset', color: 'bg-indigo-100 text-indigo-800' },
  deferred_asset: { ja: '繰延資産', en: 'Deferred Asset', color: 'bg-purple-100 text-purple-800' },
  current_liability: {
    ja: '流動負債',
    en: 'Current Liability',
    color: 'bg-orange-100 text-orange-800',
  },
  fixed_liability: { ja: '固定負債', en: 'Fixed Liability', color: 'bg-red-100 text-red-800' },
  deferred_liability: {
    ja: '繰延負債',
    en: 'Deferred Liability',
    color: 'bg-pink-100 text-pink-800',
  },
  equity: { ja: '純資産', en: 'Equity', color: 'bg-green-100 text-green-800' },
  revenue: { ja: '収益', en: 'Revenue', color: 'bg-emerald-100 text-emerald-800' },
  cogs: { ja: '売上原価', en: 'COGS', color: 'bg-amber-100 text-amber-800' },
  sga_expense: { ja: '販管費', en: 'SG&A', color: 'bg-yellow-100 text-yellow-800' },
  non_operating_income: {
    ja: '営業外収益',
    en: 'Non-Op Income',
    color: 'bg-teal-100 text-teal-800',
  },
  non_operating_expense: {
    ja: '営業外費用',
    en: 'Non-Op Expense',
    color: 'bg-rose-100 text-rose-800',
  },
  extraordinary_income: {
    ja: '特別利益',
    en: 'Extraordinary Income',
    color: 'bg-cyan-100 text-cyan-800',
  },
  extraordinary_loss: {
    ja: '特別損失',
    en: 'Extraordinary Loss',
    color: 'bg-red-100 text-red-800',
  },
}

export function AccountCodeSelector({
  items,
  value,
  onChange,
  placeholder = '勘定科目を選択',
  disabled = false,
  categoryFilter,
  showCategoryBadge = true,
  showEnglishName = false,
}: AccountCodeSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredItems = useMemo(() => {
    let result = items

    if (categoryFilter) {
      result = result.filter((item) => categoryFilter.includes(item.category))
    }

    if (search) {
      const lowerSearch = search.toLowerCase()
      result = result.filter(
        (item) =>
          item.code.toLowerCase().includes(lowerSearch) ||
          item.name.toLowerCase().includes(lowerSearch) ||
          item.nameEn.toLowerCase().includes(lowerSearch)
      )
    }

    return result
  }, [items, categoryFilter, search])

  const hierarchicalItems = useMemo(() => {
    return buildHierarchy(filteredItems)
  }, [filteredItems])

  const selectedItem = items.find((item) => item.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedItem ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs text-muted-foreground">{selectedItem.code}</span>
              <span>{selectedItem.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="コードまたは名称で検索..."
            value={search}
            onValueChange={setSearch}
          />

          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm text-muted-foreground">
                該当する勘定科目が見つかりません
              </div>
            </CommandEmpty>

            <CommandGroup>
              <ScrollArea className="h-[300px]">
                {hierarchicalItems.map((item) => (
                  <HierarchicalItem
                    key={item.id}
                    item={item}
                    selectedId={value}
                    onSelect={(id, selected) => {
                      onChange(id, selected)
                      setOpen(false)
                    }}
                    showCategoryBadge={showCategoryBadge}
                    showEnglishName={showEnglishName}
                    level={0}
                  />
                ))}
              </ScrollArea>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

interface HierarchicalItemProps {
  item: ChartOfAccountItem & { children?: ChartOfAccountItem[] }
  selectedId?: string
  onSelect: (id: string, item: ChartOfAccountItem) => void
  showCategoryBadge: boolean
  showEnglishName: boolean
  level: number
}

function HierarchicalItem({
  item,
  selectedId,
  onSelect,
  showCategoryBadge,
  showEnglishName,
  level,
}: HierarchicalItemProps) {
  const [expanded, setExpanded] = useState(level === 0)
  const hasChildren = item.children && item.children.length > 0
  const isSelected = item.id === selectedId
  const categoryInfo = CATEGORY_LABELS[item.category]

  return (
    <div>
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-accent',
          isSelected && 'bg-accent'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => !hasChildren && onSelect(item.id, item)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="rounded p-0.5 hover:bg-muted"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <div className="w-4" />
        )}

        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{item.code}</span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate">{item.name}</span>
            {showCategoryBadge && (
              <Badge variant="outline" className={cn('px-1 py-0 text-[10px]', categoryInfo.color)}>
                {categoryInfo.ja}
              </Badge>
            )}
          </div>
          {showEnglishName && (
            <p className="truncate text-xs text-muted-foreground">{item.nameEn}</p>
          )}
        </div>

        {isSelected && <Check className="h-4 w-4 text-primary" />}
      </div>

      {expanded && hasChildren && (
        <div>
          {item.children!.map((child) => (
            <HierarchicalItem
              key={child.id}
              item={child as ChartOfAccountItem & { children?: ChartOfAccountItem[] }}
              selectedId={selectedId}
              onSelect={onSelect}
              showCategoryBadge={showCategoryBadge}
              showEnglishName={showEnglishName}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function buildHierarchy(
  items: ChartOfAccountItem[]
): (ChartOfAccountItem & { children?: ChartOfAccountItem[] })[] {
  const itemMap = new Map<string, ChartOfAccountItem & { children?: ChartOfAccountItem[] }>()

  items.forEach((item) => {
    itemMap.set(item.id, { ...item, children: [] })
  })

  const roots: (ChartOfAccountItem & { children?: ChartOfAccountItem[] })[] = []

  items.forEach((item) => {
    const node = itemMap.get(item.id)!
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)!
      if (!parent.children) parent.children = []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortByCode = (a: ChartOfAccountItem, b: ChartOfAccountItem) =>
    a.code.localeCompare(b.code, undefined, { numeric: true })

  const sortChildren = (nodes: typeof roots) => {
    nodes.sort(sortByCode)
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        sortChildren(node.children as typeof roots)
      }
    })
  }

  sortChildren(roots)

  return roots
}
