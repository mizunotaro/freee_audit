'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Upload, FileSpreadsheet, MoreHorizontal, Trash2, Edit, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConversionLayout } from '@/components/conversion/layout'
import { StatusBadge } from '@/components/conversion/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import Link from 'next/link'
import type { ChartOfAccounts, AccountingStandard } from '@/types/conversion'

export default function COAListPage() {
  const [loading, setLoading] = useState(true)
  const [coaList, setCoaList] = useState<ChartOfAccounts[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [standardFilter, setStandardFilter] = useState<string>('all')
  const [deleteTarget, setDeleteTarget] = useState<ChartOfAccounts | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchCOAList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (standardFilter !== 'all') {
        params.append('standardId', standardFilter)
      }

      const response = await fetch(`/api/conversion/coa?${params}`)
      if (response.ok) {
        const data = await response.json()
        setCoaList(data.data || [])
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [standardFilter])

  useEffect(() => {
    fetchCOAList()
  }, [fetchCOAList])

  const filteredList = coaList.filter((coa) =>
    coa.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/conversion/coa/${deleteTarget.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('削除しました')
        setCoaList(coaList.filter((c) => c.id !== deleteTarget.id))
        setDeleteTarget(null)
      } else {
        const error = await response.json()
        toast.error(error.error || '削除に失敗しました')
      }
    } catch {
      toast.error('削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  const handleSetDefault = async (coa: ChartOfAccounts) => {
    try {
      const response = await fetch(`/api/conversion/coa/${coa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      })

      if (response.ok) {
        toast.success('デフォルトに設定しました')
        fetchCOAList()
      }
    } catch {
      toast.error('設定に失敗しました')
    }
  }

  const handleDuplicate = async (coa: ChartOfAccounts) => {
    try {
      const response = await fetch('/api/conversion/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...coa,
          name: `${coa.name} (コピー)`,
          isDefault: false,
        }),
      })

      if (response.ok) {
        toast.success('複製しました')
        fetchCOAList()
      }
    } catch {
      toast.error('複製に失敗しました')
    }
  }

  return (
    <ConversionLayout companyId="current">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">勘定科目表管理</h1>
            <p className="text-muted-foreground">Chart of Accounts Management</p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/conversion/coa/import">
                <Upload className="mr-2 h-4 w-4" />
                インポート
              </Link>
            </Button>
            <Button asChild>
              <Link href="/conversion/coa/new">
                <Plus className="mr-2 h-4 w-4" />
                新規作成
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="名称で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={standardFilter} onValueChange={setStandardFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="会計基準" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全て</SelectItem>
                  <SelectItem value="JGAAP">JGAAP</SelectItem>
                  <SelectItem value="USGAAP">USGAAP</SelectItem>
                  <SelectItem value="IFRS">IFRS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>会計基準</TableHead>
                <TableHead>勘定科目数</TableHead>
                <TableHead>バージョン</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>作成日</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[200px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[60px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[40px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[30px]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                filteredList.map((coa) => (
                  <TableRow key={coa.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/conversion/coa/${coa.id}`} className="block">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{coa.name}</span>
                          {coa.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              デフォルト
                            </Badge>
                          )}
                        </div>
                        {coa.description && (
                          <p className="max-w-[300px] truncate text-sm text-muted-foreground">
                            {coa.description}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{coa.standard}</Badge>
                    </TableCell>
                    <TableCell>{coa.items?.length || 0}</TableCell>
                    <TableCell>v{coa.version}</TableCell>
                    <TableCell>
                      <StatusBadge status={coa.isActive ? 'completed' : 'draft'} />
                    </TableCell>
                    <TableCell>{new Date(coa.createdAt).toLocaleDateString('ja-JP')}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/conversion/coa/${coa.id}/edit`}>
                              <Edit className="mr-2 h-4 w-4" />
                              編集
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(coa)}>
                            <Copy className="mr-2 h-4 w-4" />
                            複製
                          </DropdownMenuItem>
                          {!coa.isDefault && (
                            <DropdownMenuItem onClick={() => handleSetDefault(coa)}>
                              <FileSpreadsheet className="mr-2 h-4 w-4" />
                              デフォルトに設定
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(coa)}
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

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>勘定科目表の削除</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.name}」を削除してもよろしいですか？ この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中...' : '削除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConversionLayout>
  )
}
