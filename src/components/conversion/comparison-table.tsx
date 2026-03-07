'use client'

import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface ComparisonItem {
  sourceCode: string
  sourceName: string
  sourceAmount: number
  targetCode: string
  targetName: string
  targetAmount: number
  difference: number
  differencePercent: number
}

interface ComparisonTableProps {
  title: string
  items: ComparisonItem[]
  currency?: string
  showPercentage?: boolean
  highlightThreshold?: number
}

export function ComparisonTable({
  title,
  items,
  currency: _currency = '円',
  showPercentage = true,
  highlightThreshold = 5,
}: ComparisonTableProps) {
  const formatAmount = (amount: number) => {
    return amount.toLocaleString()
  }

  const formatPercent = (percent: number) => {
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(1)}%`
  }

  const getDifferenceIcon = (percent: number) => {
    if (Math.abs(percent) < 0.1) return <Minus className="h-3 w-3" />
    return percent > 0 ? (
      <TrendingUp className="h-3 w-3 text-green-600" />
    ) : (
      <TrendingDown className="h-3 w-3 text-red-600" />
    )
  }

  const isSignificant = (percent: number) => {
    return Math.abs(percent) >= highlightThreshold
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>

      <ScrollArea className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead colSpan={3} className="bg-muted/50">
                変換元
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead colSpan={3} className="bg-muted/50">
                変換後
              </TableHead>
              {showPercentage && <TableHead className="bg-muted/50 text-right">差異</TableHead>}
            </TableRow>
            <TableRow>
              <TableHead className="w-[80px]">コード</TableHead>
              <TableHead>科目名</TableHead>
              <TableHead className="text-right">金額</TableHead>
              <TableHead></TableHead>
              <TableHead className="w-[80px]">コード</TableHead>
              <TableHead>科目名</TableHead>
              <TableHead className="text-right">金額</TableHead>
              {showPercentage && <TableHead className="text-right">%</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={index}
                className={cn(isSignificant(item.differencePercent) && 'bg-yellow-50')}
              >
                <TableCell className="font-mono text-xs">{item.sourceCode}</TableCell>
                <TableCell>{item.sourceName}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatAmount(item.sourceAmount)}
                </TableCell>

                <TableCell className="text-center">
                  <ArrowRight className="mx-auto h-4 w-4 text-muted-foreground" />
                </TableCell>

                <TableCell className="font-mono text-xs">{item.targetCode}</TableCell>
                <TableCell>{item.targetName}</TableCell>
                <TableCell className="text-right font-mono">
                  {formatAmount(item.targetAmount)}
                </TableCell>

                {showPercentage && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {getDifferenceIcon(item.differencePercent)}
                      <span
                        className={cn(
                          'font-mono text-sm',
                          item.differencePercent > 0 && 'text-green-600',
                          item.differencePercent < 0 && 'text-red-600'
                        )}
                      >
                        {formatPercent(item.differencePercent)}
                      </span>
                      {isSignificant(item.differencePercent) && (
                        <Badge variant="outline" className="text-xs">
                          要確認
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
