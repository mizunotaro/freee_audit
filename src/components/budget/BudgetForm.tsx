'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const budgetFormSchema = z.object({
  fiscalYear: z.number().min(2000).max(2100),
  month: z.number().min(1).max(12),
  accountCode: z.string().min(1, '勘定科目コードを入力してください'),
  accountName: z.string().min(1, '勘定科目名を入力してください'),
  amount: z.number().min(0, '金額は0以上で入力してください'),
  departmentId: z.string().optional(),
})

type BudgetFormValues = z.infer<typeof budgetFormSchema>

interface Budget {
  id: string
  fiscalYear: number
  month: number
  accountCode: string
  accountName: string
  amount: number
  departmentId?: string | null
}

interface BudgetFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget?: Budget | null
  fiscalYear: number
  month: number
  onSuccess: () => void
}

const DEPARTMENTS = [
  { value: '', label: 'なし' },
  { value: 'HQ', label: '本社' },
  { value: 'SALES', label: '営業部' },
  { value: 'ADMIN', label: '管理部' },
  { value: 'DEV', label: '開発部' },
  { value: 'MFG', label: '製造部' },
]

export function BudgetForm({
  open,
  onOpenChange,
  budget,
  fiscalYear,
  month,
  onSuccess,
}: BudgetFormProps) {
  const isEditing = !!budget

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      fiscalYear,
      month,
      accountCode: '',
      accountName: '',
      amount: 0,
      departmentId: '',
    },
  })

  useEffect(() => {
    if (budget) {
      form.reset({
        fiscalYear: budget.fiscalYear,
        month: budget.month,
        accountCode: budget.accountCode,
        accountName: budget.accountName,
        amount: budget.amount,
        departmentId: budget.departmentId || '',
      })
    } else {
      form.reset({
        fiscalYear,
        month,
        accountCode: '',
        accountName: '',
        amount: 0,
        departmentId: '',
      })
    }
  }, [budget, fiscalYear, month, form])

  const onSubmit = async (values: BudgetFormValues) => {
    try {
      if (isEditing && budget) {
        const res = await fetch('/api/reports/budget', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: budget.id,
            amount: values.amount,
            departmentId: values.departmentId || null,
          }),
        })
        if (!res.ok) throw new Error('更新に失敗しました')
        toast.success('予算を更新しました')
      } else {
        const res = await fetch('/api/reports/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            data: {
              fiscalYear: values.fiscalYear,
              month: values.month,
              accountCode: values.accountCode,
              accountName: values.accountName,
              amount: values.amount,
              departmentId: values.departmentId || null,
            },
          }),
        })
        if (!res.ok) throw new Error('登録に失敗しました')
        toast.success('予算を登録しました')
      }
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      toast.error(isEditing ? '更新に失敗しました' : '登録に失敗しました')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '予算編集' : '予算新規登録'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fiscalYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>年度</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={field.value.toString()}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="年度選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[2022, 2023, 2024, 2025, 2026].map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}年度
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>月</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(parseInt(v))}
                      value={field.value.toString()}
                      disabled={isEditing}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="月選択" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {m}月
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="accountCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>勘定科目コード</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isEditing} placeholder="例: 400" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>勘定科目名</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isEditing} placeholder="例: 売上高" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>金額</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>部門</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="部門選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept.value} value={dept.value}>
                          {dept.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                キャンセル
              </Button>
              <Button type="submit">{isEditing ? '更新' : '登録'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
