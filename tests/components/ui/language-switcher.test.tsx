import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { locales } from '@/lib/i18n'

describe('ui/language-switcher — closed state', () => {
  it('shows the current locale label on the toggle button and keeps the menu closed', () => {
    const { queryByText, getByRole } = render(
      <LanguageSwitcher currentLocale="ja" onLocaleChange={vi.fn()} />
    )

    const toggle = getByRole('button')
    expect(toggle).toHaveTextContent('日本語')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // The non-current label is not rendered until opened.
    expect(queryByText('English')).toBeNull()
  })

  it('applies the forwarded className to the wrapper', () => {
    const { container } = render(
      <LanguageSwitcher currentLocale="ja" onLocaleChange={vi.fn()} className="ml-2" />
    )
    expect(container.firstChild).toHaveClass('ml-2')
  })
})

describe('ui/language-switcher — open menu', () => {
  it('renders a button for every supported locale and highlights the current one', () => {
    const { getAllByText } = render(
      <LanguageSwitcher currentLocale="ja" onLocaleChange={vi.fn()} />
    )

    fireEvent.click(getAllByText('日本語')[0])

    for (const locale of locales) {
      const label = locale === 'ja' ? '日本語' : 'English'
      expect(getAllByText(label).length).toBeGreaterThan(0)
    }

    // The current-locale option carries the active styling.
    const jaOption = getAllByText('日本語')[1]
    expect(jaOption).toHaveClass('bg-blue-50')
  })

  it('invokes onLocaleChange with the chosen locale and closes the menu', () => {
    const onLocaleChange = vi.fn()
    const { getByText, queryByText } = render(
      <LanguageSwitcher currentLocale="ja" onLocaleChange={onLocaleChange} />
    )

    fireEvent.click(getByText('日本語'))
    fireEvent.click(getByText('English'))

    expect(onLocaleChange).toHaveBeenCalledTimes(1)
    expect(onLocaleChange).toHaveBeenCalledWith('en')
    // Menu closed again after selection.
    expect(queryByText('English')).toBeNull()
  })

  it('closes when the backdrop is clicked without changing locale', () => {
    const onLocaleChange = vi.fn()
    const { container, queryByText } = render(
      <LanguageSwitcher currentLocale="ja" onLocaleChange={onLocaleChange} />
    )

    fireEvent.click(container.querySelector('button')!)
    expect(queryByText('English')).not.toBeNull()

    fireEvent.click(container.querySelector('.fixed.inset-0')!)
    expect(queryByText('English')).toBeNull()
    expect(onLocaleChange).not.toHaveBeenCalled()
  })
})
