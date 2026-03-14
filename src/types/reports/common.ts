export interface PeriodRange {
  startDate: Date
  endDate: Date
}

export interface ComparisonData {
  current: number
  previous: number
  change: number
  changePercent: number
}

export interface TrendData {
  category: string
  score: number
  status: string
  summary: string
}

export interface ChartDataPoint {
  name: string
  value: number
  previousValue?: number
  color?: string
}

export interface StatusBadge {
  status: 'good' | 'warning' | 'bad'
  label: string
}
