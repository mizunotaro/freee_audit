'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { formatPercent } from '@/lib/utils'

interface KPIGaugeProps {
  value: number
  target: number
  label: string
  unit?: string
  size?: number
}

export function KPIGauge({ value, target, label, unit = '%', size = 200 }: KPIGaugeProps) {
  const percentage = Math.min((value / target) * 100, 100)
  const remaining = 100 - percentage

  const getStatusColor = (pct: number) => {
    if (pct >= 100) return '#10b981'
    if (pct >= 80) return '#3b82f6'
    if (pct >= 60) return '#f59e0b'
    return '#ef4444'
  }

  const data = [
    { value: percentage, color: getStatusColor(percentage) },
    { value: remaining, color: '#e5e7eb' },
  ]

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size / 2 + 20 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={size / 3}
              outerRadius={size / 2.5}
              paddingAngle={0}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatPercent(value)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-4 text-center">
        <div className="text-2xl font-bold" style={{ color: getStatusColor(percentage) }}>
          {value.toFixed(1)}
          {unit}
        </div>
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-xs text-gray-400">
          目標: {target}
          {unit}
        </div>
      </div>
    </div>
  )
}

interface KPIRingProps {
  value: number
  max: number
  label: string
  color?: string
  size?: number
}

export function KPIRing({ value, max, label, color = '#3b82f6', size = 120 }: KPIRingProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const remaining = 100 - percentage

  const data = [
    { value: percentage, color },
    { value: remaining, color: '#e5e7eb' },
  ]

  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size / 3}
              outerRadius={size / 2.5}
              paddingAngle={0}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-16 text-center">
        <div className="text-xl font-bold" style={{ color }}>
          {formatPercent(percentage)}
        </div>
        <div className="text-xs text-gray-600">{label}</div>
      </div>
    </div>
  )
}

interface KPIBarProps {
  label: string
  value: number
  target: number
  unit?: string
  showValue?: boolean
}

export function KPIBar({ label, value, target, unit = '%', showValue = true }: KPIBarProps) {
  const percentage = Math.min((value / target) * 100, 150)

  const getStatusColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-500'
    if (pct >= 80) return 'bg-blue-500'
    if (pct >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {showValue && (
          <span className="text-sm font-medium text-gray-900">
            {value.toFixed(1)}
            {unit}
          </span>
        )}
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-200">
        <div
          className={`h-2.5 rounded-full ${getStatusColor(percentage)}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between">
        <span className="text-xs text-gray-400">
          目標: {target}
          {unit}
        </span>
        <span className="text-xs text-gray-400">{percentage.toFixed(0)}%</span>
      </div>
    </div>
  )
}

interface KPICardProps {
  title: string
  value: number | string
  previousValue?: number
  unit?: string
  trend?: 'up' | 'down' | 'neutral'
  description?: string
}

export function KPICard({
  title,
  value,
  previousValue,
  unit = '',
  trend,
  description,
}: KPICardProps) {
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-600'
    if (trend === 'down') return 'text-red-600'
    return 'text-gray-600'
  }

  const getTrendIcon = () => {
    if (trend === 'up') return '↑'
    if (trend === 'down') return '↓'
    return ''
  }

  const calculateChange = () => {
    if (previousValue === undefined || typeof value !== 'number') return null
    const change = ((value - previousValue) / Math.abs(previousValue)) * 100
    return change
  }

  const change = calculateChange()

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="mb-2 text-sm font-medium text-gray-500">{title}</div>
      <div className="flex items-baseline">
        <span className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {unit}
        </span>
        {change !== null && (
          <span className={`ml-2 text-sm ${getTrendColor()}`}>
            {getTrendIcon()} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      {description && <div className="mt-2 text-sm text-gray-500">{description}</div>}
    </div>
  )
}
