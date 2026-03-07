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
import type { ConvertedCashFlow } from '@/types/conversion'

interface CashFlowTableProps {
  data: ConvertedCashFlow
  showSource?: boolean
  className?: string
}

export function CashFlowTable({ data, showSource = false, className }: CashFlowTableProps) {
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
          {renderSection(
            '営業活動によるキャッシュフロー',
            data.operatingActivities,
            data.netCashFromOperating
          )}
          {renderSection(
            '投資活動によるキャッシュフロー',
            data.investingActivities,
            data.netCashFromInvesting
          )}
          {renderSection(
            '財務活動によるキャッシュフロー',
            data.financingActivities,
            data.netCashFromFinancing
          )}
          {renderSubtotal('現金及び現金同等物の純増減', data.netChangeInCash)}
        </TableBody>
      </Table>
    </div>
  )
}
