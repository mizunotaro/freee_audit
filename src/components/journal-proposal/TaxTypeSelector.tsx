'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TaxType } from '@/types/journal-proposal'

interface TaxTypeSelectorProps {
  value: TaxType
  onChange: (value: TaxType) => void
  disabled?: boolean
  className?: string
}

const TAX_TYPE_OPTIONS: { value: TaxType; label: string }[] = [
  { value: 'taxable_10', label: '課税10%' },
  { value: 'taxable_8', label: '課税8%' },
  { value: 'taxable_reduced_8', label: '軽減税率8%' },
  { value: 'tax_exempt', label: '非課税' },
  { value: 'non_taxable', label: '不課税' },
  { value: 'zero_tax', label: '免税' },
]

const TAX_TYPE_LABELS: Record<TaxType, Record<'ja' | 'en', string>> = {
  taxable_10: { ja: '課税10%', en: 'Taxable 10%' },
  taxable_8: { ja: '課税8%', en: 'Taxable 8%' },
  taxable_reduced_8: { ja: '軽減税率8%', en: 'Reduced 8%' },
  tax_exempt: { ja: '非課税', en: 'Tax Exempt' },
  non_taxable: { ja: '不課税', en: 'Non-Taxable' },
  zero_tax: { ja: '免税', en: 'Zero Tax' },
}

/**
 * A dropdown selector for Japanese tax types.
 *
 * @param props - Component props
 * @param props.value - Currently selected tax type
 * @param props.onChange - Callback when tax type changes
 * @param props.disabled - Whether the selector is disabled
 * @param props.className - Additional CSS classes
 *
 * @example
 * ```tsx
 * <TaxTypeSelector
 *   value="taxable_10"
 *   onChange={(type) => console.log(type)}
 * />
 * ```
 */
export function TaxTypeSelector({ value, onChange, disabled, className }: TaxTypeSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaxType)} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="税区分を選択" />
      </SelectTrigger>
      <SelectContent>
        {TAX_TYPE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Gets the localized label for a tax type.
 *
 * @param taxType - The tax type
 * @param locale - The locale to use ('ja' or 'en')
 * @returns The localized tax type label
 */
export function getTaxTypeLabel(taxType: TaxType, locale: 'ja' | 'en' = 'ja'): string {
  return TAX_TYPE_LABELS[taxType][locale]
}

export { TAX_TYPE_OPTIONS }
