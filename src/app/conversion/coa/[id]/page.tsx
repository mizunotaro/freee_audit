'use client'

import { useState, useEffect, useCallback } from 'react'
import { Edit, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConversionLayout } from '@/components/conversion/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import Link from 'next/link'
import type { ChartOfAccounts, ChartOfAccountItem } from '@/types/conversion'

interface PageProps {
  params: Promise<{ id: string }>
}

const CATEGORY_LABELS: Record<string, string> = {
  current_asset: '流動資産',
  fixed_asset: '固定資産',
  deferred_asset: '繰延資産',
  current_liability: '流動負債',
  fixed_liability: '固定負債',
  deferred_liability: '繰延負債',
  equity: '純資産',
  revenue: '収益',
  cogs: '売上原価',
  sga_expense: '販売費及び一般管理費',
  non_operating_income: '営業外収益',
  non_operating_expense: '営業外費用',
  extraordinary_income: '特別利益',
  extraordinary_loss: '特別損失',
}

export default function COADetailPage({ params }: PageProps) {
  const [id, setId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [coa, setCoa] = useState<ChartOfAccounts | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = useState<ChartOfAccountItem | null>(null)

  useEffect(() => {
    params.then((p) => setId(p.id))
  }, [params])

  const fetchCOA = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/conversion/coa/${id}`)
      if (response.ok) {
        const data = await response.json()
        setCoa(data.data)
        const categories = new Set<string>(
          data.data.items?.map((i: ChartOfAccountItem) => i.category) || []
        )
        setExpandedCategories(categories)
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) fetchCOA()
  }, [id, fetchCOA])

  const groupedItems =
    coa?.items?.reduce(
      (acc, item) => {
        if (!acc[item.category]) {
          acc[item.category] = []
        }
        acc[item.category].push(item)
        return acc
      },
      {} as Record<string, ChartOfAccountItem[]>
    ) || {}

  const filteredGroups = Object.entries(groupedItems).reduce(
    (acc, [category, items]) => {
      const filtered = items.filter(
        (item) =>
          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.nameEn.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (filtered.length > 0) {
        acc[category] = filtered
      }
      return acc
    },
    {} as Record<string, ChartOfAccountItem[]>
  )

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories)
    if (next.has(category)) {
      next.delete(category)
    } else {
      next.add(category)
    }
    setExpandedCategories(next)
  }

  const handleExport = async (format: 'csv' | 'excel') => {
    try {
      const response = await fetch(`/api/conversion/coa/${id}/export?format=${format}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${coa?.name || 'coa'}.${format === 'csv' ? 'csv' : 'xlsx'}`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('エクスポートに失敗しました')
    }
  }

  return (
    <ConversionLayout companyId="current">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            {loading ? (
              <>
                <Skeleton className="h-8 w-[200px]" />
                <Skeleton className="mt-2 h-4 w-[150px]" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{coa?.name}</h1>
                  {coa?.isDefault && <Badge variant="secondary">デフォルト</Badge>}
                </div>
                <p className="text-muted-foreground">{coa?.description}</p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport('csv')}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => handleExport('excel')}>
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button asChild>
              <Link href={`/conversion/coa/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                編集
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">会計基準</p>
                <p className="font-medium">{coa?.standard}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">バージョン</p>
                <p className="font-medium">v{coa?.version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">勘定科目数</p>
                <p className="font-medium">{coa?.items?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">作成日</p>
                <p className="font-medium">
                  {coa?.createdAt && new Date(coa.createdAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Input
            placeholder="コードまたは名称で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>勘定科目一覧</CardTitle>
            <CardDescription>
              {filteredGroups ? Object.values(filteredGroups).flat().length : 0} 件
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.entries(filteredGroups).map(([category, items]) => (
                    <div key={category} className="rounded-lg border">
                      <button
                        className="flex w-full items-center justify-between p-3 hover:bg-muted/50"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {CATEGORY_LABELS[category] || category}
                          </span>
                          <Badge variant="outline">{items.length}</Badge>
                        </div>
                      </button>

                      {expandedCategories.has(category) && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">コード</TableHead>
                              <TableHead>科目名</TableHead>
                              <TableHead>英語名</TableHead>
                              <TableHead className="w-[80px]">借/貸</TableHead>
                              <TableHead className="w-[100px]">変換対象</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item) => (
                              <TableRow
                                key={item.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setSelectedItem(item)}
                              >
                                <TableCell className="font-mono text-xs">{item.code}</TableCell>
                                <TableCell>
                                  <div style={{ paddingLeft: `${item.level * 16}px` }}>
                                    {item.name}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {item.nameEn}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {item.normalBalance === 'debit' ? '借方' : '貸方'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.isConvertible ? (
                                    <Badge
                                      variant="secondary"
                                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                                    >
                                      対象
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勘定科目詳細</DialogTitle>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">コード</p>
                  <p className="font-mono">{selectedItem.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">科目名</p>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">英語名</p>
                  <p>{selectedItem.nameEn}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">カテゴリ</p>
                  <p>{CATEGORY_LABELS[selectedItem.category] || selectedItem.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">借方/貸方</p>
                  <p>{selectedItem.normalBalance === 'debit' ? '借方' : '貸方'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">変換対象</p>
                  <p>{selectedItem.isConvertible ? 'はい' : 'いいえ'}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              閉じる
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConversionLayout>
  )
}
