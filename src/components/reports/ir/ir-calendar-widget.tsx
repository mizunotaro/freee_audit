'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { IREvent } from '@/types/reports/ir-report'

export interface IRCalendarWidgetProps {
  events: IREvent[]
  title?: string
  language?: 'ja' | 'en'
  onEventClick?: (event: IREvent) => void
}

const EVENT_TYPE_COLORS: Record<IREvent['type'], string> = {
  earnings: 'bg-blue-500',
  presentation: 'bg-green-500',
  meeting: 'bg-purple-500',
  dividend: 'bg-yellow-500',
  other: 'bg-gray-500',
}

const EVENT_TYPE_LABELS: Record<IREvent['type'], Record<'ja' | 'en', string>> = {
  earnings: { ja: '決算発表', en: 'Earnings' },
  presentation: { ja: '説明会', en: 'Presentation' },
  meeting: { ja: '株主総会', en: 'Meeting' },
  dividend: { ja: '配当', en: 'Dividend' },
  other: { ja: 'その他', en: 'Other' },
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function IRCalendarWidget({
  events,
  title = 'IRイベントカレンダー',
  language = 'ja',
  onEventClick,
}: IRCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = React.useState(new Date())

  const weekdays = language === 'ja' ? WEEKDAYS_JA : WEEKDAYS_EN

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days: (number | null)[] = []

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i)
    }

    return days
  }

  const getEventsForDay = (day: number) => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    return events.filter((event) => event.date.startsWith(dateStr))
  }

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const formatMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    if (language === 'ja') {
      return `${year}年${month}月`
    }
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }

  const days = getDaysInMonth(currentDate)
  const today = new Date()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {formatMonth(currentDate)}
            </span>
            <Button variant="ghost" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((day) => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}

          {days.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="h-12" />
            }

            const dayEvents = getEventsForDay(day)
            const isToday =
              today.getFullYear() === currentDate.getFullYear() &&
              today.getMonth() === currentDate.getMonth() &&
              today.getDate() === day

            return (
              <div
                key={day}
                className={`h-12 rounded-md border p-1 ${
                  isToday ? 'border-primary bg-primary/10' : 'border-transparent'
                }`}
              >
                <div className={`text-xs ${isToday ? 'font-bold text-primary' : ''}`}>{day}</div>
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div
                      key={event.id}
                      className={`h-1.5 w-1.5 rounded-full ${EVENT_TYPE_COLORS[event.type]} cursor-pointer`}
                      onClick={() => onEventClick?.(event)}
                      title={event.title}
                    />
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[8px] text-muted-foreground">
                      +{dayEvents.length - 2}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {events.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="mb-2 text-sm font-medium">
              {language === 'en' ? 'Upcoming Events' : '今後のイベント'}
            </h4>
            <div className="space-y-2">
              {events
                .filter((event) => new Date(event.date) >= today)
                .slice(0, 3)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                    onClick={() => onEventClick?.(event)}
                  >
                    <div className={`h-2 w-2 rounded-full ${EVENT_TYPE_COLORS[event.type]}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString(
                          language === 'ja' ? 'ja-JP' : 'en-US'
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {EVENT_TYPE_LABELS[event.type][language]}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default IRCalendarWidget
