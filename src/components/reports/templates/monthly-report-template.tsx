'use client'

import type { MultiMonthReport, ReportSection, ReportTableRow } from '@/types'
import { formatCurrency, Currency } from '@/services/currency'

interface MultiMonthReportTableProps {
  report: MultiMonthReport
  currency?: Currency
  language?: 'ja' | 'en'
}

export function MultiMonthReportTable({
  report,
  currency = 'JPY',
  language = 'ja',
}: MultiMonthReportTableProps) {
  const formatValue = (value: number, sectionType: string) => {
    if (sectionType === 'kpi') {
      return value.toFixed(1)
    }
    return formatCurrency(value, currency, language === 'en' ? 'en' : 'ja')
  }

  return (
    <div className="overflow-x-auto rounded-lg bg-white shadow">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="sticky left-0 z-10 min-w-[180px] border-b border-gray-200 bg-gray-100 px-4 py-3 text-left font-semibold">
              勘定科目
            </th>
            {report.months.map((m) => (
              <th
                key={m}
                className="min-w-[100px] border-b border-gray-200 px-3 py-3 text-right font-semibold"
              >
                {m}月
              </th>
            ))}
            <th className="min-w-[110px] border-b border-gray-200 bg-blue-50 px-3 py-3 text-right font-semibold">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {report.sections.map((section) => (
            <SectionRows key={section.type} section={section} formatValue={formatValue} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SectionRowsProps {
  section: ReportSection
  formatValue: (value: number, sectionType: string) => string
}

function SectionRows({ section, formatValue }: SectionRowsProps) {
  const showAverage = section.type === 'pl' || section.type === 'kpi'

  return (
    <>
      <tr className="bg-gray-50">
        <td
          colSpan={section.rows[0]?.values.length + (showAverage ? 3 : 2)}
          className="sticky left-0 z-10 border-b border-t-2 border-gray-300 bg-gray-50 px-4 py-2 font-bold text-gray-700"
        >
          【{section.title}】
        </td>
      </tr>
      {section.rows.map((row, idx) => (
        <Row
          key={`${section.type}-${idx}`}
          row={row}
          sectionType={section.type}
          formatValue={formatValue}
          showAverage={showAverage}
        />
      ))}
    </>
  )
}

interface RowProps {
  row: ReportTableRow
  sectionType: string
  formatValue: (value: number, sectionType: string) => string
  showAverage: boolean
}

function Row({ row, sectionType, formatValue, showAverage }: RowProps) {
  const getRowStyle = () => {
    switch (row.rowType) {
      case 'subtotal':
        return 'bg-gray-50 font-semibold border-t border-dashed border-gray-300'
      case 'total':
        return 'bg-blue-50 font-bold border-t-2 border-blue-300'
      default:
        return 'border-b border-gray-100'
    }
  }

  const getNameStyle = () => {
    const base = 'sticky left-0 z-10 bg-inherit px-4 py-2 '
    const indent = row.indent > 0 ? 'pl-8 ' : ''
    const weight = row.rowType === 'item' ? '' : 'font-semibold '
    return base + indent + weight
  }

  return (
    <tr className={getRowStyle()}>
      <td className={getNameStyle()}>
        {row.rowType === 'subtotal' && '─ '}
        {row.rowType === 'total' && '━ '}
        {row.name}
      </td>
      {row.values.map((value, i) => (
        <td key={i} className="border-b border-gray-100 px-3 py-2 text-right">
          {formatValue(value, sectionType)}
        </td>
      ))}
      <td className="border-b border-gray-100 bg-blue-50/50 px-3 py-2 text-right font-semibold">
        {formatValue(row.total ?? 0, sectionType)}
      </td>
      {showAverage && (
        <td className="border-b border-gray-100 bg-green-50/50 px-3 py-2 text-right">
          {formatValue(row.average ?? 0, sectionType)}
        </td>
      )}
    </tr>
  )
}

export default MultiMonthReportTable
