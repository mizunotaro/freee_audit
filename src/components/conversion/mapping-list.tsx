'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit, Trash2, Check, Eye, GitCompare } from 'lucide-react'
import type { AccountMapping } from '@/types/conversion'
import { ConfidenceIndicator } from './confidence-indicator'

interface MappingListProps {
  mappings: AccountMapping[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onApprove: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function MappingList({
  mappings,
  selectedIds,
  onSelectionChange,
  onApprove,
  onDelete,
}: MappingListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)

  const allSelected = mappings.length > 0 && selectedIds.length === mappings.length
  const someSelected = selectedIds.length > 0 && selectedIds.length < mappings.length

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([])
    } else {
      onSelectionChange(mappings.map((m) => m.id))
    }
  }

  const handleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    try {
      await onApprove(id)
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このマッピングを削除しますか？')) return
    setProcessingId(id)
    try {
      await onDelete(id)
    } finally {
      setProcessingId(null)
    }
  }

  const getMappingTypeBadge = (type: string) => {
    const variants: Record<
      string,
      { label: string; variant: 'default' | 'secondary' | 'outline' }
    > = {
      '1to1': { label: '1:1', variant: 'default' },
      '1toN': { label: '1:N', variant: 'secondary' },
      Nto1: { label: 'N:1', variant: 'secondary' },
      complex: { label: '複合', variant: 'outline' },
    }
    const config = variants[type] ?? { label: type, variant: 'outline' }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (mappings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">マッピングがありません</p>
        <p className="mt-1 text-sm text-muted-foreground">
          AI推論を実行するか、手動でマッピングを作成してください
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="すべて選択"
                className={someSelected ? 'opacity-50' : ''}
              />
            </TableHead>
            <TableHead>ソース勘定科目</TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>ターゲット勘定科目</TableHead>
            <TableHead className="w-24">タイプ</TableHead>
            <TableHead className="w-32">信頼度</TableHead>
            <TableHead className="w-24">状態</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mappings.map((mapping) => (
            <TableRow
              key={mapping.id}
              className={selectedIds.includes(mapping.id) ? 'bg-muted/50' : ''}
            >
              <TableCell>
                <Checkbox
                  checked={selectedIds.includes(mapping.id)}
                  onCheckedChange={() => handleSelectOne(mapping.id)}
                  aria-label="選択"
                />
              </TableCell>
              <TableCell>
                <div>
                  <code className="rounded bg-muted px-1 text-xs">{mapping.sourceAccountCode}</code>
                  <p className="font-medium">{mapping.sourceAccountName}</p>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <GitCompare className="mx-auto h-4 w-4 text-muted-foreground" />
              </TableCell>
              <TableCell>
                <div>
                  <code className="rounded bg-muted px-1 text-xs">{mapping.targetAccountCode}</code>
                  <p className="font-medium">{mapping.targetAccountName}</p>
                </div>
              </TableCell>
              <TableCell>{getMappingTypeBadge(mapping.mappingType)}</TableCell>
              <TableCell>
                <ConfidenceIndicator confidence={mapping.confidence} size="sm" />
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
                    <Button variant="ghost" size="sm" disabled={processingId === mapping.id}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/conversion/mappings/${mapping.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        編集
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/conversion/mappings/${mapping.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        詳細
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleApprove(mapping.id)}>
                      <Check className="mr-2 h-4 w-4" />
                      承認
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(mapping.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      削除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
