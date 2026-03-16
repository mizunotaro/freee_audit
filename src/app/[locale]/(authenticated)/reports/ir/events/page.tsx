'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/api/fetch-with-timeout'
import type { IREvent, IREventType, IREventStatus } from '@/types/ir-report'

const EVENT_TYPE_LABELS: Record<IREventType, string> = {
  earnings_release: '決算発表',
  briefing: '説明会',
  dividend: '配当発表',
  agm: '株主総会',
}

const EVENT_TYPE_COLORS: Record<IREventType, string> = {
  earnings_release: 'bg-blue-100 text-blue-800',
  briefing: 'bg-green-100 text-green-800',
  dividend: 'bg-yellow-100 text-yellow-800',
  agm: 'bg-purple-100 text-purple-800',
}

const STATUS_LABELS: Record<IREventStatus, string> = {
  scheduled: '予定',
  completed: '完了',
  cancelled: 'キャンセル',
}

const STATUS_COLORS: Record<IREventStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const DAYS_OF_WEEK = ['日', '月', '火', '水', '木', '金', '土']

export default function IREventsPage() {
  const [events, setEvents] = useState<IREvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<IREvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<IREvent | null>(null)

  const [formData, setFormData] = useState({
    eventType: 'earnings_release' as IREventType,
    title: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
  })

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

      const params = new URLSearchParams({
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
      })

      const res = await fetchWithTimeout(`/api/ir/events?${params.toString()}`, {
        timeout: 30000,
      })

      if (!res.ok) {
        throw new Error('イベントの取得に失敗しました')
      }

      const data = await res.json()
      setEvents(data.events || [])
    } catch (error) {
      console.error('Failed to fetch events:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('イベントの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }, [currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const resetForm = () => {
    setFormData({
      eventType: 'earnings_release',
      title: '',
      description: '',
      scheduledDate: '',
      scheduledTime: '',
    })
    setEditingEvent(null)
  }

  const handleOpenForm = (event?: IREvent, date?: Date) => {
    if (event) {
      setEditingEvent(event)
      const eventDate = new Date(event.scheduledDate)
      setFormData({
        eventType: event.eventType,
        title: event.title,
        description: event.description || '',
        scheduledDate: eventDate.toISOString().split('T')[0],
        scheduledTime: eventDate.toTimeString().slice(0, 5),
      })
    } else {
      resetForm()
      if (date) {
        setFormData((prev) => ({
          ...prev,
          scheduledDate: date.toISOString().split('T')[0],
        }))
      }
    }
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const scheduledDateTime = formData.scheduledTime
      ? new Date(`${formData.scheduledDate}T${formData.scheduledTime}:00`)
      : new Date(formData.scheduledDate)

    const data = {
      companyId: 'default',
      eventType: formData.eventType,
      title: formData.title,
      description: formData.description || undefined,
      scheduledDate: scheduledDateTime,
    }

    try {
      const url = editingEvent ? `/api/ir/events/${editingEvent.id}` : '/api/ir/events'
      const method = editingEvent ? 'PATCH' : 'POST'

      const res = await fetchWithTimeout(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        timeout: 30000,
      })

      if (!res.ok) throw new Error('保存に失敗しました')

      toast.success(editingEvent ? '更新しました' : '追加しました')
      setFormOpen(false)
      resetForm()
      fetchEvents()
    } catch (error) {
      console.error('Failed to save event:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('保存に失敗しました')
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return

    try {
      const res = await fetchWithTimeout(`/api/ir/events/${deleteTarget.id}`, {
        method: 'DELETE',
        timeout: 30000,
      })

      if (!res.ok) throw new Error('削除に失敗しました')

      toast.success('削除しました')
      fetchEvents()
    } catch (error) {
      console.error('Failed to delete event:', error)
      if (error instanceof FetchTimeoutError) {
        toast.error('リクエストがタイムアウトしました')
      } else {
        toast.error('削除に失敗しました')
      }
    } finally {
      setDeleteTarget(null)
    }
  }

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    return days
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.scheduledDate)
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      )
    })
  }

  const days = getDaysInMonth()
  const today = new Date()
  const isToday = (date: Date | null) => {
    if (!date) return false
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  if (loading) {
    return (
      <AppLayout title="IRイベントカレンダー">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-96 rounded bg-gray-200"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="IRイベントカレンダー">
      <div className="mb-6">
        <Link
          href="/reports/ir"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          IRレポート一覧に戻る
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[160px] text-center text-lg font-bold">
            {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
          </h2>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            今日
          </Button>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <Plus className="mr-1 h-4 w-4" />
          イベント追加
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b">
            {DAYS_OF_WEEK.map((day, index) => (
              <div
                key={day}
                className={`py-2 text-center text-sm font-medium ${
                  index === 0 ? 'text-red-600' : index === 6 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((date, index) => {
              const dayEvents = date ? getEventsForDate(date) : []
              return (
                <div
                  key={index}
                  className={`min-h-[100px] border-b border-r p-1 ${
                    date ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50'
                  }`}
                  onClick={() => date && handleOpenForm(undefined, date)}
                >
                  {date && (
                    <>
                      <div
                        className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                          isToday(date) ? 'bg-primary-500 font-bold text-white' : 'text-gray-700'
                        }`}
                      >
                        {date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="truncate rounded px-1 py-0.5 text-xs"
                            style={{
                              backgroundColor: EVENT_TYPE_COLORS[event.eventType].split(' ')[0],
                              color: EVENT_TYPE_COLORS[event.eventType].split(' ')[1],
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenForm(event)
                            }}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="px-1 text-xs text-gray-500">
                            +{dayEvents.length - 3}件
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>今月のイベント一覧</CardTitle>
          <CardDescription>
            {currentDate.getFullYear()}年{currentDate.getMonth() + 1}月の予定
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-8 text-center text-gray-500">予定されているイベントはありません</div>
          ) : (
            <div className="space-y-3">
              {events
                .sort(
                  (a, b) =>
                    new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
                )
                .map((event) => {
                  const eventDate = new Date(event.scheduledDate)
                  return (
                    <div
                      key={event.id}
                      className="flex items-start justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-gray-100 text-center">
                          <span className="text-xs text-gray-500">
                            {eventDate.getMonth() + 1}月
                          </span>
                          <span className="font-bold text-gray-900">{eventDate.getDate()}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{event.title}</span>
                            <Badge className={EVENT_TYPE_COLORS[event.eventType]}>
                              {EVENT_TYPE_LABELS[event.eventType]}
                            </Badge>
                            <Badge className={STATUS_COLORS[event.status]}>
                              {STATUS_LABELS[event.status]}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="mt-1 text-sm text-gray-500">{event.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenForm(event)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(event)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'イベント編集' : 'イベント追加'}</DialogTitle>
              <DialogDescription>IRイベントの情報を入力してください</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eventType">イベント種別</Label>
                  <Select
                    value={formData.eventType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, eventType: value as IREventType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">日付</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">タイトル</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduledTime">時間</Label>
                <Input
                  id="scheduledTime"
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">説明</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>イベントの削除</AlertDialogTitle>
            <AlertDialogDescription>
              「{deleteTarget?.title}」を削除しますか？ この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  )
}
