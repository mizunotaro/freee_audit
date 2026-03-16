'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Plus, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface TaxPayment {
  id: string
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNumber?: string
  note?: string
}

interface TaxSchedule {
  id: string
  taxType: string
  fiscalYear: number
  dueDate: string
  amount?: number
  status: string
  filedDate?: string
  paidDate?: string
  note?: string
  payments?: TaxPayment[]
}

const taxTypeLabels: Record<string, string> = {
  corporate: '法人税',
  withholding: '源泉徴収税',
  depreciation: '償却資産税',
  consumption: '消費税',
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500',
  FILED: 'bg-blue-500',
  PAID: 'bg-green-500',
}

const statusLabels: Record<string, string> = {
  PENDING: '未処理',
  FILED: '申告済み',
  PAID: '支払済み',
}

export default function TaxPage() {
  const [schedules, setSchedules] = useState<TaxSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear())
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string>('')

  const [formData, setFormData] = useState({
    taxType: 'corporate',
    dueDate: '',
    amount: '',
    note: '',
  })

  const [paymentData, setPaymentData] = useState({
    paymentDate: '',
    amount: '',
    paymentMethod: 'bank_transfer',
    referenceNumber: '',
    note: '',
  })

  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId')
    if (storedCompanyId) {
      setCompanyId(storedCompanyId)
    }
  }, [])

  const fetchSchedules = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tax/schedules?companyId=${companyId}&fiscalYear=${fiscalYear}`)
      const data = await res.json()
      setSchedules(data)
    } catch (error) {
      console.error('Error fetching tax schedules:', error)
    } finally {
      setLoading(false)
    }
  }, [companyId, fiscalYear])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleAddSchedule = async () => {
    if (!companyId) return

    try {
      const res = await fetch('/api/tax/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          taxType: formData.taxType,
          fiscalYear,
          dueDate: formData.dueDate,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          note: formData.note,
        }),
      })

      if (res.ok) {
        await fetchSchedules()
        setIsAddDialogOpen(false)
        setFormData({ taxType: 'corporate', dueDate: '', amount: '', note: '' })
      }
    } catch (error) {
      console.error('Error adding tax schedule:', error)
    }
  }

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/tax/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          filedDate: status === 'FILED' ? new Date().toISOString() : undefined,
          paidDate: status === 'PAID' ? new Date().toISOString() : undefined,
        }),
      })

      if (res.ok) {
        await fetchSchedules()
      }
    } catch (error) {
      console.error('Error updating tax schedule:', error)
    }
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('この税金スケジュールを削除しますか？')) return

    try {
      const res = await fetch(`/api/tax/schedules/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchSchedules()
      }
    } catch (error) {
      console.error('Error deleting tax schedule:', error)
    }
  }

  const handleAddPayment = async () => {
    if (!selectedScheduleId) return

    try {
      const res = await fetch(`/api/tax/schedules/${selectedScheduleId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate: paymentData.paymentDate,
          amount: parseFloat(paymentData.amount),
          paymentMethod: paymentData.paymentMethod,
          referenceNumber: paymentData.referenceNumber,
          note: paymentData.note,
        }),
      })

      if (res.ok) {
        await fetchSchedules()
        setIsPaymentDialogOpen(false)
        setPaymentData({
          paymentDate: '',
          amount: '',
          paymentMethod: 'bank_transfer',
          referenceNumber: '',
          note: '',
        })
      }
    } catch (error) {
      console.error('Error adding tax payment:', error)
    }
  }

  const handleGenerateDefault = async () => {
    if (!companyId) return

    const fiscalYearEndMonth = 12

    try {
      const res = await fetch('/api/tax/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          fiscalYearEndMonth,
          fiscalYear,
        }),
      })

      if (res.ok) {
        await fetchSchedules()
      }
    } catch (error) {
      console.error('Error generating default schedules:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const formatAmount = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount)
  }

  const getTotalPaid = (payments?: TaxPayment[]) => {
    if (!payments) return 0
    return payments.reduce((sum, p) => sum + p.amount, 0)
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">税金管理</h1>
          <p className="text-muted-foreground">年間税金スケジュールの管理</p>
        </div>
        <div className="flex gap-2">
          <Select value={fiscalYear.toString()} onValueChange={(v) => setFiscalYear(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}年度
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateDefault} variant="outline">
            <CalendarDays className="mr-2 h-4 w-4" />
            デフォルト生成
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>税金スケジュール追加</DialogTitle>
                <DialogDescription>新しい税金スケジュールを追加します</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="taxType" className="text-right">
                    税金種別
                  </Label>
                  <Select
                    value={formData.taxType}
                    onValueChange={(v) => setFormData({ ...formData, taxType: v })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corporate">法人税</SelectItem>
                      <SelectItem value="withholding">源泉徴収税</SelectItem>
                      <SelectItem value="depreciation">償却資産税</SelectItem>
                      <SelectItem value="consumption">消費税</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dueDate" className="text-right">
                    期限日
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">
                    金額
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="col-span-3"
                    placeholder="任意"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="note" className="text-right">
                    メモ
                  </Label>
                  <Textarea
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="col-span-3"
                    placeholder="任意"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddSchedule}>追加</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未処理</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter((s) => s.status === 'PENDING').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">申告済み</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter((s) => s.status === 'FILED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">支払済み</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter((s) => s.status === 'PAID').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">合計金額</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatAmount(schedules.reduce((sum, s) => sum + (s.amount || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>税金スケジュール一覧</CardTitle>
          <CardDescription>{fiscalYear}年度の税金スケジュール</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center">読み込み中...</div>
          ) : schedules.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              税金スケジュールがありません。「デフォルト生成」ボタンをクリックして、標準的な税金スケジュールを生成してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>税金種別</TableHead>
                  <TableHead>期限日</TableHead>
                  <TableHead>予定金額</TableHead>
                  <TableHead>支払済み</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{taxTypeLabels[schedule.taxType]}</div>
                        {schedule.note && (
                          <div className="text-sm text-muted-foreground">{schedule.note}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(schedule.dueDate)}</TableCell>
                    <TableCell>{formatAmount(schedule.amount)}</TableCell>
                    <TableCell>{formatAmount(getTotalPaid(schedule.payments))}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[schedule.status]}>
                        {statusLabels[schedule.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {schedule.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleUpdateStatus(schedule.id, 'FILED')}
                          >
                            申告
                          </Button>
                        )}
                        {schedule.status === 'FILED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedScheduleId(schedule.id)
                              setIsPaymentDialogOpen(true)
                            }}
                          >
                            支払記録
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>支払記録の追加</DialogTitle>
            <DialogDescription>税金の支払記録を追加します</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentDate" className="text-right">
                支払日
              </Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentData.paymentDate}
                onChange={(e) => setPaymentData({ ...paymentData, paymentDate: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentAmount" className="text-right">
                支払金額
              </Label>
              <Input
                id="paymentAmount"
                type="number"
                value={paymentData.amount}
                onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentMethod" className="text-right">
                支払方法
              </Label>
              <Select
                value={paymentData.paymentMethod}
                onValueChange={(v) => setPaymentData({ ...paymentData, paymentMethod: v })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">銀行振込</SelectItem>
                  <SelectItem value="cash">現金</SelectItem>
                  <SelectItem value="e_tax">e-Tax</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="referenceNumber" className="text-right">
                参照番号
              </Label>
              <Input
                id="referenceNumber"
                value={paymentData.referenceNumber}
                onChange={(e) =>
                  setPaymentData({ ...paymentData, referenceNumber: e.target.value })
                }
                className="col-span-3"
                placeholder="任意"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentNote" className="text-right">
                メモ
              </Label>
              <Textarea
                id="paymentNote"
                value={paymentData.note}
                onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
                className="col-span-3"
                placeholder="任意"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddPayment}>追加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
