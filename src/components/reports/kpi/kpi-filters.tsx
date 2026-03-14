'use client'

interface KPIFiltersProps {
  fiscalYear: number
  month: number
  onFiscalYearChange: (year: number) => void
  onMonthChange: (month: number) => void
}

export function KPIFilters({
  fiscalYear,
  month,
  onFiscalYearChange,
  onMonthChange,
}: KPIFiltersProps) {
  return (
    <div className="mb-6 flex items-center space-x-4">
      <select
        value={fiscalYear}
        onChange={(e) => onFiscalYearChange(parseInt(e.target.value))}
        className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
      >
        {[2022, 2023, 2024, 2025, 2026].map((y) => (
          <option key={y} value={y}>
            {y}年度
          </option>
        ))}
      </select>
      <select
        value={month}
        onChange={(e) => onMonthChange(parseInt(e.target.value))}
        className="focus:border-primary-500 focus:ring-primary-500 rounded-md border-gray-300 shadow-sm"
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
          <option key={m} value={m}>
            {m}月
          </option>
        ))}
      </select>
    </div>
  )
}
