'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface ManualInputData {
  date: string
  vendor: string
  totalAmount: number
  taxAmount: number
  taxRate: number
  description: string
  items: Array<{ name: string; amount: number }>
}

interface FallbackInputProps {
  onSubmit: (data: ManualInputData) => void
  isProcessing: boolean
}

export function FallbackInput({ onSubmit, isProcessing }: FallbackInputProps) {
  const t = useTranslations('journalProposal.fallback')

  const [formData, setFormData] = useState<ManualInputData>({
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    totalAmount: 0,
    taxAmount: 0,
    taxRate: 0.1,
    description: '',
    items: [],
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const calculateTaxAmount = () => {
    const taxAmount = Math.round(formData.totalAmount * formData.taxRate)
    setFormData((prev) => ({ ...prev, taxAmount }))
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-amber-800">{t('title')}</h3>
      <p className="mb-4 text-sm text-amber-700">{t('description')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="date">{t('fields.date')}</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>

          <div>
            <Label htmlFor="vendor">{t('fields.vendor')}</Label>
            <Input
              id="vendor"
              type="text"
              value={formData.vendor}
              onChange={(e) => setFormData((prev) => ({ ...prev, vendor: e.target.value }))}
              placeholder={t('placeholders.vendor')}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="totalAmount">{t('fields.totalAmount')}</Label>
            <Input
              id="totalAmount"
              type="number"
              value={formData.totalAmount || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, totalAmount: Number(e.target.value) }))
              }
              onBlur={calculateTaxAmount}
              min={0}
              required
            />
          </div>

          <div>
            <Label htmlFor="taxRate">{t('fields.taxRate')}</Label>
            <Select
              value={formData.taxRate.toString()}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, taxRate: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.1">10%</SelectItem>
                <SelectItem value="0.08">8%</SelectItem>
                <SelectItem value="0">0%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="taxAmount">{t('fields.taxAmount')}</Label>
            <Input
              id="taxAmount"
              type="number"
              value={formData.taxAmount || ''}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, taxAmount: Number(e.target.value) }))
              }
              min={0}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">{t('fields.description')}</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('placeholders.description')}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={isProcessing}>
            {isProcessing ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>
    </div>
  )
}
