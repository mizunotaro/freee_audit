'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ConvertedBalanceSheet } from '@/types/conversion'

interface BalanceSheetTableProps {
  data: ConvertedBalanceSheet
  showSource?: boolean
  className?: string
}

export function BalanceSheetTable({ data, showSource = false, className }: BalanceSheetTableProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ja-JP').format(amount)
  }

  const renderSection = (
    title: string,
    items: Array<{
      code: string
      name: string
      nameEn: string
      amount: number
      sourceAccountCode?: string
    }>,
    total: number
  ) => (
    <>
      <TableRow className="bg-muted/50">
        <TableCell colSpan={showSource ? 4 : 3} className="font-semibold">
          {title}
        </TableCell>
      </TableRow>
      {items.map((item, index) => (
        <TableRow key={index}>
          <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
          <TableCell>{item.name}</TableCell>
          {showSource && (
            <TableCell className="text-muted-foreground">{item.sourceAccountCode || '-'}</TableCell>
          )}
          <TableCell className="text-right">{formatAmount(item.amount)}</TableCell>
        </TableRow>
      ))}
      <TableRow className="bg-muted/30 font-medium">
        <TableCell colSpan={showSource ? 3 : 2} className="text-right">
          {title} 合計
        </TableCell>
        <TableCell className="text-right">{formatAmount(total)}</TableCell>
      </TableRow>
    </>
  )

  return (
    <div className={cn('rounded-lg border', className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">コード</TableHead>
            <TableHead>科目名</TableHead>
            {showSource && <TableHead className="w-24">ソース</TableHead>}
            <TableHead className="w-32 text-right">金額</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderSection('資産', data.assets, data.totalAssets)}
          {renderSection('負債', data.liabilities, data.totalLiabilities)}
          {renderSection('株主資本', data.equity, data.totalEquity)}
        </TableBody>
      </Table>
    </div>
  )
}
