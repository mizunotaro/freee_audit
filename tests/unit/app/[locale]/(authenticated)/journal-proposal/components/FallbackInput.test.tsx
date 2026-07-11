import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  FallbackInput,
  type ManualInputData,
} from '@/app/[locale]/(authenticated)/journal-proposal/components/FallbackInput'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Radix <Select> is a UI boundary that does not behave in jsdom (pointer-capture
// portals). For this component the tax-rate Select IS part of the logic under
// test — its onValueChange drives the rate used by calculateTaxAmount — so we
// replace the primitives with a real native <select> built from the component's
// own <SelectItem> values. That keeps the value -> onValueChange wiring live and
// fully drivable, instead of a blind pass-through that would hide that logic.
vi.mock('@/components/ui/select', () => {
  const React: typeof import('react') = require('react')
  const SelectItem = () => null

  function collectItems(node: React.ReactNode): string[] {
    const items: string[] = []
    const walk = (n: React.ReactNode) => {
      React.Children.forEach(n, (child) => {
        if (!React.isValidElement(child)) return
        if (child.type === SelectItem) {
          items.push(child.props.value)
          return
        }
        if (child.props && child.props.children) walk(child.props.children)
      })
    }
    walk(node)
    return items
  }

  const Select = ({ value, onValueChange, children }: any) =>
    React.createElement(
      'select',
      {
        'data-testid': 'tax-rate-select',
        value,
        onChange: (e: { target: { value: string } }) => onValueChange(e.target.value),
      },
      collectItems(children).map((v: string) =>
        React.createElement('option', { key: v, value: v }, v)
      )
    )
  const Pass = ({ children }: any) => children ?? null
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue: Pass,
  }
})

function renderFallback(
  overrides: { onSubmit?: ReturnType<typeof vi.fn>; isProcessing?: boolean } = {}
) {
  const onSubmit = overrides.onSubmit ?? vi.fn()
  const isProcessing = overrides.isProcessing ?? false
  const utils = render(
    <FallbackInput
      onSubmit={onSubmit as (data: ManualInputData) => void}
      isProcessing={isProcessing}
    />
  )
  return {
    ...utils,
    onSubmit,
    form: () => utils.container.querySelector('form') as HTMLFormElement,
    dateInput: () => screen.getByLabelText('fields.date') as HTMLInputElement,
    vendorInput: () => screen.getByLabelText('fields.vendor') as HTMLInputElement,
    totalAmountInput: () => screen.getByLabelText('fields.totalAmount') as HTMLInputElement,
    taxAmountInput: () => screen.getByLabelText('fields.taxAmount') as HTMLInputElement,
    descriptionInput: () => screen.getByLabelText('fields.description') as HTMLTextAreaElement,
    taxRateSelect: () => screen.getByTestId('tax-rate-select') as HTMLSelectElement,
    submitButton: () => screen.getByRole('button', { name: 'submit' }),
  }
}

beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-06-15T10:30:00.000Z'))
})

afterAll(() => {
  vi.useRealTimers()
})

describe('FallbackInput — initial render', () => {
  it('renders the title and description copy', () => {
    const { container } = renderFallback()
    expect(container).toHaveTextContent('title')
    expect(container).toHaveTextContent('description')
  })

  it('renders every labelled form field', () => {
    const {
      dateInput,
      vendorInput,
      totalAmountInput,
      taxAmountInput,
      descriptionInput,
      taxRateSelect,
    } = renderFallback()
    expect(dateInput()).toBeInTheDocument()
    expect(vendorInput()).toBeInTheDocument()
    expect(totalAmountInput()).toBeInTheDocument()
    expect(taxAmountInput()).toBeInTheDocument()
    expect(descriptionInput()).toBeInTheDocument()
    expect(taxRateSelect()).toBeInTheDocument()
  })

  it('defaults the date to today (ISO date, split on T)', () => {
    expect(renderFallback().dateInput()).toHaveValue('2024-06-15')
  })

  it('starts every numeric field at zero, rendered empty via the "|| \'\'" idiom', () => {
    const { totalAmountInput, taxAmountInput } = renderFallback()
    expect(totalAmountInput().value).toBe('')
    expect(taxAmountInput().value).toBe('')
  })

  it('marks date, vendor and totalAmount as required', () => {
    const { dateInput, vendorInput, totalAmountInput } = renderFallback()
    expect(dateInput()).toBeRequired()
    expect(vendorInput()).toBeRequired()
    expect(totalAmountInput()).toBeRequired()
  })

  it('defaults the tax rate to 10% and the submit button to enabled', () => {
    const { taxRateSelect, submitButton } = renderFallback()
    expect(taxRateSelect()).toHaveValue('0.1')
    expect(submitButton()).toBeEnabled()
    expect(submitButton()).toHaveTextContent('submit')
  })
})

describe('FallbackInput — isProcessing contract', () => {
  it('disables the submit button and shows the submitting label while processing', () => {
    const { getByRole } = renderFallback({ isProcessing: true })
    const button = getByRole('button', { name: 'submitting' })
    expect(button).toBeDisabled()
  })

  it('re-enables the button and restores the submit label once processing clears', () => {
    const { rerender, getByRole } = renderFallback({ isProcessing: true })
    expect(getByRole('button', { name: 'submitting' })).toBeDisabled()
    rerender(<FallbackInput onSubmit={vi.fn()} isProcessing={false} />)
    const button = getByRole('button', { name: 'submit' })
    expect(button).toBeEnabled()
  })
})

describe('FallbackInput — field updates', () => {
  it('writes each edited field into the submitted payload', () => {
    const { onSubmit, dateInput, vendorInput, totalAmountInput, descriptionInput, submitButton } =
      renderFallback()

    fireEvent.change(dateInput(), { target: { value: '2024-01-20' } })
    fireEvent.change(vendorInput(), { target: { value: 'Acme Corp' } })
    fireEvent.change(totalAmountInput(), { target: { value: '1100' } })
    fireEvent.change(descriptionInput(), { target: { value: 'Consulting fee' } })
    fireEvent.click(submitButton())

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const data = onSubmit.mock.calls[0][0] as ManualInputData
    expect(data).toMatchObject({
      date: '2024-01-20',
      vendor: 'Acme Corp',
      totalAmount: 1100,
      description: 'Consulting fee',
    })
  })

  it('coerces numeric input through Number() (empty clears the display)', () => {
    const { totalAmountInput, taxAmountInput } = renderFallback()

    fireEvent.change(totalAmountInput(), { target: { value: '2500' } })
    expect(totalAmountInput().value).toBe('2500')
    fireEvent.change(totalAmountInput(), { target: { value: '' } })
    expect(totalAmountInput().value).toBe('')

    fireEvent.change(taxAmountInput(), { target: { value: '777' } })
    expect(taxAmountInput().value).toBe('777')
  })
})

describe('FallbackInput — tax rate selection', () => {
  it('exposes the three configured rates as options', () => {
    const select = renderFallback().taxRateSelect()
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toEqual(['0.1', '0.08', '0'])
  })

  it('converts the chosen string value to a number on change', () => {
    const { vendorInput, totalAmountInput, taxRateSelect, onSubmit, submitButton } =
      renderFallback()
    fireEvent.change(vendorInput(), { target: { value: 'Vendor' } })
    fireEvent.change(totalAmountInput(), { target: { value: '1000' } })
    fireEvent.change(taxRateSelect(), { target: { value: '0.08' } })
    fireEvent.click(submitButton())
    expect((onSubmit.mock.calls[0][0] as ManualInputData).taxRate).toBe(0.08)
  })
})

describe('FallbackInput — calculateTaxAmount (on blur of totalAmount)', () => {
  it('rounds total * 10% into the tax-amount field on blur', () => {
    const { totalAmountInput, taxAmountInput } = renderFallback()
    fireEvent.change(totalAmountInput(), { target: { value: '1100' } })
    fireEvent.blur(totalAmountInput())
    expect(taxAmountInput().value).toBe('110')
  })

  it('uses the 8% rate when the rate is changed before blurring', () => {
    const { totalAmountInput, taxRateSelect, taxAmountInput } = renderFallback()
    fireEvent.change(totalAmountInput(), { target: { value: '1000' } })
    fireEvent.change(taxRateSelect(), { target: { value: '0.08' } })
    fireEvent.blur(totalAmountInput())
    expect(taxAmountInput().value).toBe('80')
  })

  it('produces 0 (shown empty) for the 0% rate', () => {
    const { totalAmountInput, taxRateSelect, taxAmountInput } = renderFallback()
    fireEvent.change(totalAmountInput(), { target: { value: '1000' } })
    fireEvent.change(taxRateSelect(), { target: { value: '0' } })
    fireEvent.blur(totalAmountInput())
    expect(taxAmountInput().value).toBe('')
  })

  it('rounds half-values up (Math.round semantics)', () => {
    const { totalAmountInput, taxAmountInput } = renderFallback()
    fireEvent.change(totalAmountInput(), { target: { value: '105' } })
    fireEvent.blur(totalAmountInput())
    const expected = Math.round(105 * 0.1)
    expect(expected).toBe(11)
    expect(taxAmountInput().value).toBe(String(expected))
  })
})

describe('FallbackInput — submission', () => {
  it('emits a complete ManualInputData payload including items: []', () => {
    const onSubmit = vi.fn()
    const { dateInput, vendorInput, totalAmountInput, submitButton } = renderFallback({ onSubmit })

    fireEvent.change(dateInput(), { target: { value: '2024-03-01' } })
    fireEvent.change(vendorInput(), { target: { value: 'Vendor' } })
    fireEvent.change(totalAmountInput(), { target: { value: '1000' } })
    fireEvent.blur(totalAmountInput())
    fireEvent.click(submitButton())

    expect(onSubmit.mock.calls[0][0]).toEqual<ManualInputData>({
      date: '2024-03-01',
      vendor: 'Vendor',
      totalAmount: 1000,
      taxAmount: 100,
      taxRate: 0.1,
      description: '',
      items: [],
    })
  })

  it('calls preventDefault so the native form does not reload', () => {
    const onSubmit = vi.fn()
    const { container } = renderFallback({ onSubmit })
    const form = container.querySelector('form') as HTMLFormElement
    const preventDefault = vi.fn()
    const event = new Event('submit', { bubbles: true, cancelable: true })
    event.preventDefault = preventDefault
    fireEvent(form, event)
    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('fail-safe: native required validation blocks submission while required fields are empty', () => {
    const onSubmit = vi.fn()
    const { submitButton } = renderFallback({ onSubmit })
    fireEvent.click(submitButton())
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('preserves a manually-entered tax amount on submit', () => {
    const onSubmit = vi.fn()
    const { vendorInput, totalAmountInput, taxAmountInput, submitButton } = renderFallback({
      onSubmit,
    })
    fireEvent.change(vendorInput(), { target: { value: 'Vendor' } })
    fireEvent.change(totalAmountInput(), { target: { value: '1000' } })
    fireEvent.change(taxAmountInput(), { target: { value: '95' } })
    fireEvent.click(submitButton())
    expect((onSubmit.mock.calls[0][0] as ManualInputData).taxAmount).toBe(95)
  })
})
