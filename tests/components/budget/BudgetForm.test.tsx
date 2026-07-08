import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BudgetForm } from '@/components/budget/BudgetForm'

const toastCalls = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastCalls.success,
    error: toastCalls.error,
  },
}))

// The component renders a department <SelectItem value=""> (the "なし" option), which
// @radix-ui/react-select refuses in jsdom. The Select is a UI boundary, not the logic
// under test — replace the primitives with pass-throughs so the form handling
// (validation, submit payload, toast, create/edit modes) is exercised faithfully.
vi.mock('@/components/ui/select', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => children ?? null
  return {
    Select: Passthrough,
    SelectContent: Passthrough,
    SelectItem: Passthrough,
    SelectTrigger: Passthrough,
    SelectValue: Passthrough,
  }
})

interface Budget {
  id: string
  fiscalYear: number
  month: number
  accountCode: string
  accountName: string
  amount: number
  departmentId?: string | null
}

const BUDGET: Budget = {
  id: 'b1',
  fiscalYear: 2024,
  month: 6,
  accountCode: '400',
  accountName: '売上高',
  amount: 1000,
  departmentId: 'HQ',
}

function jsonRes(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => body } as unknown as Response
}

function renderForm(overrides: { budget?: Budget | null } = {}) {
  const onSuccess = vi.fn()
  const onOpenChange = vi.fn()
  const utils = render(
    <BudgetForm
      open
      onOpenChange={onOpenChange}
      budget={overrides.budget ?? null}
      fiscalYear={2024}
      month={6}
      onSuccess={onSuccess}
    />
  )
  return { ...utils, onSuccess, onOpenChange }
}

const codeInput = () => screen.getByPlaceholderText('例: 400') as HTMLInputElement
const nameInput = () => screen.getByPlaceholderText('例: 売上高') as HTMLInputElement
const amountInput = () => document.body.querySelector('input[type="number"]') as HTMLInputElement

describe('BudgetForm — mode rendering', () => {
  it('renders the create-mode title and enabled inputs', () => {
    renderForm()
    expect(screen.getByText('予算新規登録')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument()
    expect(codeInput()).not.toBeDisabled()
    expect(nameInput()).not.toBeDisabled()
  })

  it('renders the edit-mode title, submit label, and disabled + pre-filled inputs', () => {
    renderForm({ budget: BUDGET })
    expect(screen.getByText('予算編集')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument()
    expect(codeInput()).toBeDisabled()
    expect(codeInput()).toHaveValue('400')
    expect(nameInput()).toBeDisabled()
  })
})

describe('BudgetForm — client-side validation', () => {
  it('blocks submit and surfaces field errors for empty required fields', async () => {
    global.fetch = vi.fn()
    const { getByText } = renderForm()

    fireEvent.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => {
      expect(getByText('勘定科目コードを入力してください')).toBeInTheDocument()
    })
    expect(getByText('勘定科目名を入力してください')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('BudgetForm — create submission', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    toastCalls.success.mockClear()
    toastCalls.error.mockClear()
  })

  it('POSTs a create payload, toasts success, and closes the dialog', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ success: true }))
    const { onSuccess, onOpenChange } = renderForm()

    fireEvent.change(codeInput(), { target: { value: '400' } })
    fireEvent.change(nameInput(), { target: { value: '売上高' } })
    fireEvent.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(init.body as string)
    expect(body.action).toBe('create')
    expect(body.data).toMatchObject({
      fiscalYear: 2024,
      month: 6,
      accountCode: '400',
      accountName: '売上高',
      amount: 0,
      departmentId: null,
    })

    await waitFor(() => expect(toastCalls.success).toHaveBeenCalledWith('予算を登録しました'))
    expect(onSuccess).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('toasts an error and keeps the dialog open when the create request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ error: 'boom' }, false))
    const { onSuccess, onOpenChange } = renderForm()

    fireEvent.change(codeInput(), { target: { value: '400' } })
    fireEvent.change(nameInput(), { target: { value: '売上高' } })
    fireEvent.click(screen.getByRole('button', { name: '登録' }))

    await waitFor(() => expect(toastCalls.error).toHaveBeenCalledWith('登録に失敗しました'))
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()
  })
})

describe('BudgetForm — edit submission', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    toastCalls.success.mockClear()
    toastCalls.error.mockClear()
  })

  it('PUTs an update payload with id + amount when editing', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ success: true }))

    renderForm({ budget: BUDGET })

    fireEvent.change(amountInput(), { target: { value: '5000' } })
    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ]
    const body = JSON.parse(init.body as string)
    expect(init.method).toBe('PUT')
    expect(body).toEqual({ id: 'b1', amount: 5000, departmentId: 'HQ' })

    await waitFor(() => expect(toastCalls.success).toHaveBeenCalledWith('予算を更新しました'))
  })
})
