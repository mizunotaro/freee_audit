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
import type { ConvertedProfitLoss } from '@/types/conversion'

interface ProfitLossTableProps {
  data: ConvertedProfitLoss
  showSource?: boolean
  className?: string
}

export function ProfitLossTable({ data, showSource = false, className }: ProfitLossTableProps) {
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
    total?: number
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
      {total !== undefined && (
        <TableRow className="bg-muted/30 font-medium">
          <TableCell colSpan={showSource ? 3 : 2} className="text-right">
            {title} 合計
          </TableCell>
          <TableCell className="text-right">{formatAmount(total)}</TableCell>
        </TableRow>
      )}
    </>
  )

  const renderSubtotal = (label: string, amount: number) => (
    <TableRow className="bg-primary/5 font-medium">
      <TableCell colSpan={showSource ? 3 : 2} className="text-right">
        {label}
      </TableCell>
      <TableCell className="text-right">{formatAmount(amount)}</TableCell>
    </TableRow>
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
          {renderSection('売上高', data.revenue)}
          {renderSubtotal(
            '売上高合計',
            data.revenue.reduce((sum, item) => sum + item.amount, 0)
          )}

          {renderSection('売上原価', data.costOfSales)}
          {renderSubtotal('売上総利益', data.grossProfit)}

          {renderSection('販売費及び一般管理費', data.sgaExpenses)}
          {renderSubtotal('営業利益', data.operatingIncome)}

          {renderSection('営業外収益', data.nonOperatingIncome)}
          {renderSection('営業外費用', data.nonOperatingExpenses)}
          {renderSubtotal('経常利益', data.ordinaryIncome)}

          {renderSubtotal('税引前当期純利益', data.incomeBeforeTax)}
          {renderSubtotal('当期純利益', data.netIncome)}
        </TableBody>
      </Table>
    </div>
  )
}
