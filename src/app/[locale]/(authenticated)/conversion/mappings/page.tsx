'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  GitCompare,
  Plus,
  Search,
  CheckCircle2,
  Loader2,
  Sparkles,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { ConversionLayout } from '@/components/conversion/layout'
import { MappingEditor, MappingEditorValue } from '@/components/conversion/mapping-editor'
import { AIAdvisorPanel } from '@/components/conversion/ai-advisor-panel'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AccountMapping, ChartOfAccounts, MappingSuggestion } from '@/types/conversion'

interface MappingStatistics {
  total: number
  approved: number
  pending: number
  needsReview: number
  unmappedCount: number
}

export default function MappingsPage() {
  const [loading, setLoading] = useState(true)
  const [mappings, setMappings] = useState<AccountMapping[]>([])
  const [sourceCoa, setSourceCoa] = useState<ChartOfAccounts | null>(null)
  const [targetCoa, setTargetCoa] = useState<ChartOfAccounts | null>(null)
  const [availableCoas, setAvailableCoas] = useState<ChartOfAccounts[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTargetCoaId, setSelectedTargetCoaId] = useState<string>('')
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'approved' | 'pending'>('all')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [aiSuggestions, setAiSuggestions] = useState<MappingSuggestion[]>([])
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false)

  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [statistics, setStatistics] = useState<MappingStatistics | null>(null)

  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingMappingId, setDeletingMappingId] = useState<string | null>(null)

  const [debouncedSearch, setDebouncedSearch] = useState('')

  const fetchCOAs = useCallback(async () => {
    try {
      const response = await fetch('/api/conversion/coa')
      if (response.ok) {
        const data = await response.json()
        const coas = data.data || []
        setAvailableCoas(coas)

        const jgaapCoa = coas.find((c: ChartOfAccounts) => c.standard === 'JGAAP' && c.isDefault)
        if (jgaapCoa) {
          setSourceCoa(jgaapCoa)
        }

        const targetCoa = coas.find((c: ChartOfAccounts) => c.standard !== 'JGAAP')
        if (targetCoa) {
          setSelectedTargetCoaId(targetCoa.id)
          setTargetCoa(targetCoa)
        }
      }
    } catch {
      toast.error('データの取得に失敗しました')
    }
  }, [])

  const fetchMappings = useCallback(async () => {
    if (!selectedTargetCoaId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('targetCoaId', selectedTargetCoaId)
      if (approvalFilter !== 'all') {
        params.append('isApproved', approvalFilter === 'approved' ? 'true' : 'false')
      }
      params.append('limit', '100')

      const response = await fetch(`/api/conversion/mappings?${params}`)
      if (response.ok) {
        const data = await response.json()
        setMappings(data.data || [])
      }
    } catch {
      toast.error('マッピングの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [selectedTargetCoaId, approvalFilter])

  const fetchStatistics = useCallback(async () => {
    if (!selectedTargetCoaId) return
    try {
      const response = await fetch(
        `/api/conversion/mappings/statistics?targetCoaId=${selectedTargetCoaId}`
      )
      if (response.ok) {
        const data = await response.json()
        const stats = data.data
        setStatistics({
          total: stats.total || 0,
          approved: stats.approved || 0,
          pending: stats.pending || 0,
          needsReview: stats.needsReview || 0,
          unmappedCount: stats.unmappedAccounts?.length || 0,
        })
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error)
    }
  }, [selectedTargetCoaId])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    fetchCOAs()
  }, [fetchCOAs])

  useEffect(() => {
    if (selectedTargetCoaId) {
      fetchMappings()
      fetchStatistics()
    }
  }, [selectedTargetCoaId, approvalFilter, debouncedSearch, fetchMappings, fetchStatistics])

  const fetchAiSuggestions = async () => {
    if (!sourceCoa || !targetCoa) return

    setLoadingAiSuggestions(true)
    try {
      const unmappedCodes = getUnmappedSourceCodes()

      const response = await fetch('/api/conversion/mappings/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCoaId: sourceCoa.id,
          targetCoaId: targetCoa.id,
          targetStandard: targetCoa.standard,
          sourceAccountCodes: unmappedCodes.slice(0, 50),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setAiSuggestions(data.data || [])
      }
    } catch {
      toast.error('AI推奨の取得に失敗しました')
    } finally {
      setLoadingAiSuggestions(false)
    }
  }

  const getUnmappedSourceCodes = useCallback(() => {
    const mappedCodes = new Set(mappings.map((m) => m.sourceAccountCode))
    return (sourceCoa?.items || [])
      .filter((item) => !mappedCodes.has(item.code) && item.isConvertible)
      .map((item) => item.code)
  }, [mappings, sourceCoa])

  const filteredMappings = useMemo(() => {
    return mappings.filter((m) => {
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase()
        return (
          m.sourceAccountCode.toLowerCase().includes(query) ||
          m.sourceAccountName.toLowerCase().includes(query) ||
          m.targetAccountCode.toLowerCase().includes(query) ||
          m.targetAccountName.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [mappings, debouncedSearch])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMappings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredMappings.map((m) => m.id)))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return

    try {
      const response = await fetch('/api/conversion/mappings/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          mappingIds: Array.from(selectedIds),
        }),
      })

      if (response.ok) {
        toast.success(`${selectedIds.size}件を承認しました`)
        setSelectedIds(new Set())
        setShowBulkApproveDialog(false)
        fetchMappings()
        fetchStatistics()
      }
    } catch {
      toast.error('一括承認に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!deletingMappingId) return

    try {
      const response = await fetch(`/api/conversion/mappings/${deletingMappingId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('マッピングを削除しました')
        setShowDeleteDialog(false)
        setDeletingMappingId(null)
        fetchMappings()
        fetchStatistics()
      }
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const applyAiSuggestion = async (suggestion: MappingSuggestion) => {
    const sourceItem = sourceCoa?.items.find((i) => i.code === suggestion.sourceAccountCode)
    const targetItem = targetCoa?.items.find((i) => i.code === suggestion.suggestedTargetCode)

    if (!sourceItem || !targetItem || !sourceCoa || !targetCoa) return

    try {
      const response = await fetch('/api/conversion/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCoaId: sourceCoa.id,
          sourceItemId: sourceItem.id,
          targetCoaId: targetCoa.id,
          targetItemId: targetItem.id,
          mappingType: '1to1',
        }),
      })

      if (response.ok) {
        toast.success('マッピングを作成しました')
        setAiSuggestions((prev) => prev.filter((s) => s !== suggestion))
        fetchMappings()
        fetchStatistics()
      } else {
        const data = await response.json()
        if (data.code === 'DUPLICATE') {
          toast.warning('このマッピングは既に存在します')
          setAiSuggestions((prev) => prev.filter((s) => s !== suggestion))
        } else {
          toast.error('マッピングの作成に失敗しました')
        }
      }
    } catch {
      toast.error('マッピングの作成に失敗しました')
    }
  }

  const handleSaveMapping = async (value: MappingEditorValue) => {
    if (!sourceCoa || !targetCoa) return

    try {
      const url = editingMapping
        ? `/api/conversion/mappings/${editingMapping.id}`
        : '/api/conversion/mappings'
      const method = editingMapping ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCoaId: sourceCoa.id,
          sourceItemId: value.sourceItemId,
          targetCoaId: targetCoa.id,
          targetItemId: value.targetItemId,
          mappingType: value.mappingType,
          conversionRule: value.conversionRule,
          percentage: value.percentage,
          notes: value.notes,
        }),
      })

      if (response.ok) {
        toast.success(editingMapping ? 'マッピングを更新しました' : 'マッピングを作成しました')
        setIsCreating(false)
        setEditingMapping(null)
        fetchMappings()
        fetchStatistics()
      } else {
        const data = await response.json()
        if (data.code === 'DUPLICATE') {
          toast.error('このマッピングは既に存在します')
        } else {
          toast.error('保存に失敗しました')
        }
      }
    } catch {
      toast.error('保存に失敗しました')
    }
  }

  const convertibleCount = sourceCoa?.items?.filter((i) => i.isConvertible).length || 0
  const progressPercent =
    statistics && convertibleCount > 0
      ? Math.round((statistics.approved / convertibleCount) * 100)
      : 0

  return (
    <ConversionLayout companyId="current">
      <div className="grid grid-cols-[1fr_350px] gap-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">マッピング設定</h1>
              <p className="text-muted-foreground">Account Mapping Configuration</p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchAiSuggestions}
                disabled={loadingAiSuggestions || !sourceCoa || !targetCoa}
              >
                {loadingAiSuggestions ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                AI推奨を取得
              </Button>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                新規マッピング
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">マッピング進捗</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {statistics?.approved || 0} / {convertibleCount} 科目
                  </span>
                  <span className="text-sm font-medium">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} />

                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="rounded bg-muted p-2">
                    <p className="text-lg font-bold">{statistics?.total || 0}</p>
                    <p className="text-xs text-muted-foreground">合計</p>
                  </div>
                  <div className="rounded bg-green-50 p-2">
                    <p className="text-lg font-bold text-green-600">{statistics?.approved || 0}</p>
                    <p className="text-xs text-muted-foreground">承認済</p>
                  </div>
                  <div className="rounded bg-yellow-50 p-2">
                    <p className="text-lg font-bold text-yellow-600">{statistics?.pending || 0}</p>
                    <p className="text-xs text-muted-foreground">未承認</p>
                  </div>
                  <div className="rounded bg-red-50 p-2">
                    <p className="text-lg font-bold text-red-600">
                      {statistics?.unmappedCount || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">未マッピング</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="コードまたは名称で検索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                <Select value={selectedTargetCoaId} onValueChange={setSelectedTargetCoaId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="ターゲットCOA" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoas
                      .filter((c) => c.standard !== 'JGAAP')
                      .map((coa) => (
                        <SelectItem key={coa.id} value={coa.id}>
                          {coa.name} ({coa.standard})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select
                  value={approvalFilter}
                  onValueChange={(v) => setApprovalFilter(v as typeof approvalFilter)}
                >
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="承認状態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全て</SelectItem>
                    <SelectItem value="approved">承認済</SelectItem>
                    <SelectItem value="pending">未承認</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
              <span className="text-sm">{selectedIds.size}件選択中</span>
              <Button size="sm" onClick={() => setShowBulkApproveDialog(true)}>
                <CheckCircle2 className="mr-1 h-4 w-4" />
                一括承認
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
                選択解除
              </Button>
            </div>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={
                        selectedIds.size === filteredMappings.length && filteredMappings.length > 0
                      }
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>ソース</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>ターゲット</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>信頼度</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[150px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[150px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[60px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[50px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-[60px]" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-6" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      マッピングがありません
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(mapping.id)}
                          onCheckedChange={() => toggleSelect(mapping.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <code className="rounded bg-muted px-1 text-xs">
                            {mapping.sourceAccountCode}
                          </code>
                          <p className="font-medium">{mapping.sourceAccountName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <GitCompare className="mx-auto h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <div>
                          <code className="rounded bg-muted px-1 text-xs">
                            {mapping.targetAccountCode}
                          </code>
                          <p className="font-medium">{mapping.targetAccountName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{mapping.mappingType}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              mapping.confidence >= 0.9
                                ? 'bg-green-500'
                                : mapping.confidence >= 0.7
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            )}
                          />
                          <span>{Math.round(mapping.confidence * 100)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {'isApproved' in mapping && mapping.isApproved ? (
                          <Badge className="bg-green-100 text-green-800">承認済</Badge>
                        ) : mapping.isManualReview ? (
                          <Badge className="bg-yellow-100 text-yellow-800">要確認</Badge>
                        ) : (
                          <Badge variant="outline">未承認</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingMapping(mapping)}>
                              <Edit className="mr-2 h-4 w-4" />
                              編集
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              詳細
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDeletingMappingId(mapping.id)
                                setShowDeleteDialog(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="sticky top-6 h-fit">
          <AIAdvisorPanel
            projectId="current"
            mappingSuggestions={aiSuggestions}
            onAcceptMappingSuggestion={applyAiSuggestion}
            onRejectMappingSuggestion={(suggestion) => {
              setAiSuggestions((prev) => prev.filter((s) => s !== suggestion))
            }}
            isLoading={loadingAiSuggestions}
          />
        </div>
      </div>

      <Dialog
        open={isCreating || !!editingMapping}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false)
            setEditingMapping(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMapping ? 'マッピング編集' : '新規マッピング'}</DialogTitle>
            <DialogDescription>
              ソース勘定科目とターゲット勘定科目のマッピングを設定します
            </DialogDescription>
          </DialogHeader>
          <MappingEditor
            sourceItems={sourceCoa?.items || []}
            targetItems={targetCoa?.items || []}
            mapping={editingMapping || undefined}
            onSave={handleSaveMapping}
            onCancel={() => {
              setIsCreating(false)
              setEditingMapping(null)
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>一括承認の確認</AlertDialogTitle>
            <AlertDialogDescription>
              選択した{selectedIds.size}件のマッピングを承認しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApprove}>承認</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </ConversionLayout>
  )
}
