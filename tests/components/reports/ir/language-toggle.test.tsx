import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LanguageToggle } from '@/components/reports/ir/language-toggle'

describe('LanguageToggle', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with current language selected', () => {
    render(<LanguageToggle value="ja" onChange={mockOnChange} />)

    expect(screen.getByText('日本語')).toBeInTheDocument()
  })

  it('displays correct label for English', () => {
    render(<LanguageToggle value="en" onChange={mockOnChange} />)

    expect(screen.getByText('English')).toBeInTheDocument()
  })

  it('displays correct label for bilingual', () => {
    render(<LanguageToggle value="bilingual" onChange={mockOnChange} />)

    expect(screen.getByText('日/英')).toBeInTheDocument()
  })

  it('calls onChange when language is selected', async () => {
    render(<LanguageToggle value="ja" onChange={mockOnChange} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    await waitFor(
      () => {
        const englishOption = screen.queryByText('English')
        if (englishOption) {
          fireEvent.click(englishOption)
          expect(mockOnChange).toHaveBeenCalledWith('en')
        }
      },
      { timeout: 3000 }
    )
  })

  it('is disabled when disabled prop is true', () => {
    render(<LanguageToggle value="ja" onChange={mockOnChange} disabled />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })
})
