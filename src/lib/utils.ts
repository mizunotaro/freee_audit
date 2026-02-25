import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '-'
  return value.toLocaleString('ja-JP')
}

export function formatCurrency(value: number | undefined | null, currency: string = 'JPY'): string {
  if (value === undefined || value === null) return '-'
  if (currency === 'USD') {
    return (
      '$' + value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    )
  }
  return '¥' + value.toLocaleString('ja-JP')
}

export function formatPercent(value: number | undefined | null, decimals: number = 1): string {
  if (value === undefined || value === null) return '-'
  return value.toFixed(decimals) + '%'
}

export function formatChange(
  current: number,
  previous: number | undefined
): { value: number; formatted: string; trend: 'up' | 'down' | 'neutral' } {
  if (previous === undefined || previous === 0) {
    return { value: 0, formatted: '-', trend: 'neutral' }
  }
  const change = ((current - previous) / Math.abs(previous)) * 100
  const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  return {
    value: change,
    formatted: (change > 0 ? '+' : '') + change.toFixed(1) + '%',
    trend,
  }
}

export function formatMonth(month: number): string {
  return `${month}月`
}

export function formatFiscalYear(fiscalYear: number, month: number): string {
  return `${fiscalYear}年${month}月`
}

export function parseCsv(content: string): string[][] {
  const lines = content.split('\n')
  const result: string[][] = []
  let current: string[] = []
  let inQuotes = false
  let currentValue = ''

  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        current.push(currentValue.trim())
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    current.push(currentValue.trim())
    currentValue = ''
    if (!inQuotes) {
      result.push(current)
      current = []
    }
  }

  return result
}

export function getFiscalYear(date: Date, startMonth: number = 4): number {
  const month = date.getMonth() + 1
  if (month >= startMonth) {
    return date.getFullYear()
  }
  return date.getFullYear() - 1
}

export function getPreviousMonth(
  fiscalYear: number,
  month: number
): { fiscalYear: number; month: number } {
  if (month === 1) {
    return { fiscalYear: fiscalYear - 1, month: 12 }
  }
  return { fiscalYear, month: month - 1 }
}

export function getPreviousYearSameMonth(
  fiscalYear: number,
  month: number
): { fiscalYear: number; month: number } {
  return { fiscalYear: fiscalYear - 1, month }
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

export function roundToDecimal(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals)
  return Math.round(value * multiplier) / multiplier
}

export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return numerator / denominator
}

export function sumValues(values: number[]): number {
  return values.reduce((sum, val) => sum + (val || 0), 0)
}

export function getMonthName(month: number): string {
  const months = [
    '1月',
    '2月',
    '3月',
    '4月',
    '5月',
    '6月',
    '7月',
    '8月',
    '9月',
    '10月',
    '11月',
    '12月',
  ]
  return months[month - 1] || ''
}

export function getMonthNameShort(month: number): string {
  return `${month}月`
}

export function calculateGrowthRate(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}
