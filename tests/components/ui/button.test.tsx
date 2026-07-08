import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Button, buttonVariants } from '@/components/ui/button'

const BASE_TOKENS = ['inline-flex', 'items-center', 'justify-center', 'rounded-md', 'text-sm']

const VARIANT_TOKENS: Record<string, string> = {
  default: 'bg-primary',
  destructive: 'bg-destructive',
  outline: 'border border-input',
  secondary: 'bg-secondary',
  ghost: 'hover:bg-accent',
  link: 'underline-offset-4',
}

const SIZE_TOKENS: Record<string, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
}

describe('ui/button — buttonVariants contract', () => {
  it('returns the base classes for every input', () => {
    const cls = buttonVariants()
    for (const token of BASE_TOKENS) {
      expect(cls).toContain(token)
    }
  })

  it('defaults to the default variant + default size', () => {
    const cls = buttonVariants()
    expect(cls).toContain(VARIANT_TOKENS.default)
    expect(cls).toContain(SIZE_TOKENS.default)
  })

  it('maps every variant to its distinctive class token', () => {
    for (const [variant, token] of Object.entries(VARIANT_TOKENS)) {
      expect(buttonVariants({ variant: variant as never })).toContain(token)
    }
  })

  it('maps every size to its distinctive class token', () => {
    for (const [size, token] of Object.entries(SIZE_TOKENS)) {
      expect(buttonVariants({ size: size as never })).toContain(token)
    }
  })

  it('combines a non-default variant and size simultaneously', () => {
    const cls = buttonVariants({ variant: 'destructive', size: 'lg' })
    expect(cls).toContain(VARIANT_TOKENS.destructive)
    expect(cls).toContain(SIZE_TOKENS.lg)
  })

  it('appends a custom className untouched', () => {
    expect(buttonVariants({ className: 'my-custom' })).toContain('my-custom')
  })
})

describe('ui/button — Button component', () => {
  it('renders a native button with the resolved classes and forwards DOM props', () => {
    const onClick = vi.fn()
    const { getByRole } = render(
      <Button variant="outline" size="sm" onClick={onClick} disabled>
        Click
      </Button>
    )
    const btn = getByRole('button', { name: 'Click' }) as HTMLButtonElement
    expect(btn).toBeInTheDocument()
    expect(btn.className).toContain(VARIANT_TOKENS.outline)
    expect(btn.className).toContain(SIZE_TOKENS.sm)
    expect(btn).toBeDisabled()

    fireEvent.click(btn)
    // disabled buttons do not fire their React onClick.
    expect(onClick).not.toHaveBeenCalled()
  })

  it('fires the click handler when enabled', () => {
    const onClick = vi.fn()
    const { getByRole } = render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders as its child element when asChild is set (Slot passthrough)', () => {
    const { container } = render(
      <Button asChild>
        <a href="/somewhere">Link</a>
      </Button>
    )
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor).toHaveAttribute('href', '/somewhere')
    expect(anchor?.className).toContain(VARIANT_TOKENS.default)
    expect(container.querySelector('button')).toBeNull()
  })
})
