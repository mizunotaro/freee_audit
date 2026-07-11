import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'

vi.mock('next/font/google', () => ({
  Inter: vi.fn((opts: Record<string, unknown> = {}) => ({
    className: '__mock_inter_className__',
    variable: '__mock_inter_variable__',
    style: { fontFamily: '__mock_inter_style__' },
    _opts: opts,
  })),
}))

import RootLayout, { metadata } from '@/app/layout'
import { Inter } from 'next/font/google'

const mockedInter = vi.mocked(Inter)

const parse = (children: ReactNode): Document => {
  const markup = renderToStaticMarkup(<RootLayout>{children}</RootLayout>)
  return new DOMParser().parseFromString(markup, 'text/html')
}

describe('RootLayout (src/app/layout.tsx)', () => {
  describe('metadata export', () => {
    it('exposes the product title', () => {
      expect(metadata.title).toBe('freee_audit - 会計監査システム')
    })

    it('exposes the localized description', () => {
      expect(metadata.description).toBe('会計freee仕訳監査・レポートシステム')
    })

    it('is a plain object with exactly the documented keys', () => {
      expect(metadata).toEqual({
        title: 'freee_audit - 会計監査システム',
        description: '会計freee仕訳監査・レポートシステム',
      })
    })
  })

  describe('next/font/google wiring', () => {
    it('registers the Inter loader once at module load with the latin subset and --font-inter variable', () => {
      expect(mockedInter).toHaveBeenCalledTimes(1)
      expect(mockedInter).toHaveBeenCalledWith({
        subsets: ['latin'],
        variable: '--font-inter',
      })
    })

    it('is a module singleton: repeated renders do not re-invoke the loader', () => {
      parse(<span>a</span>)
      parse(<span>b</span>)

      expect(mockedInter).toHaveBeenCalledTimes(1)
    })
  })

  describe('<html> element', () => {
    it('sets the Japanese locale via the lang attribute', () => {
      expect(
        parse(<span />)
          .querySelector('html')
          ?.getAttribute('lang')
      ).toBe('ja')
    })

    it('emits exactly one <html> element', () => {
      expect(parse(<span />).querySelectorAll('html')).toHaveLength(1)
    })
  })

  describe('<body> element', () => {
    it('derives its font class from next/font (proves dynamic inter.variable wiring)', () => {
      expect(parse(<span />).querySelector('body')?.className).toContain('__mock_inter_variable__')
    })

    it.each([
      ['min-h-screen', 'min-h-screen'],
      ['bg-background', 'bg-background'],
      ['font-sans', 'font-sans'],
      ['antialiased', 'antialiased'],
    ])('applies the static %s class independent of the font loader', (_label, cls) => {
      const className = parse(<span />).querySelector('body')?.className ?? ''
      expect(className.split(/\s+/)).toContain(cls)
    })

    it('composes the full expected className', () => {
      expect(parse(<span />).querySelector('body')?.className).toBe(
        '__mock_inter_variable__ min-h-screen bg-background font-sans antialiased'
      )
    })
  })

  describe('children rendering (SSR path)', () => {
    it('places a single child inside <body>', () => {
      const doc = parse(<main>child-marker</main>)
      expect(doc.querySelector('body main')?.textContent).toBe('child-marker')
    })

    it('renders arbitrarily nested children', () => {
      const doc = parse(
        <div>
          <section>
            <p>deep-child</p>
          </section>
        </div>
      )
      expect(doc.querySelector('body p')?.textContent).toBe('deep-child')
    })

    it('renders multiple sibling children in document order', () => {
      const doc = parse(
        <>
          <span>first</span>
          <span>second</span>
          <span>third</span>
        </>
      )
      expect(doc.querySelector('body')?.textContent).toBe('firstsecondthird')
      expect(doc.querySelectorAll('body span')).toHaveLength(3)
    })
  })

  describe('edge cases & fail-safe behavior', () => {
    it('keeps the <html>/<body> skeleton when children is null', () => {
      const doc = parse(null)
      expect(doc.querySelector('html')).not.toBeNull()
      expect(doc.querySelector('body')).not.toBeNull()
    })

    it('keeps the <html>/<body> skeleton for an empty fragment', () => {
      const doc = parse(<></>)
      expect(doc.querySelector('html')).not.toBeNull()
      expect(doc.querySelector('body')).not.toBeNull()
    })

    it('serializes a numeric child as text content', () => {
      expect(parse(42).querySelector('body')?.textContent).toBe('42')
    })

    it('preserves locale and all static body classes even with empty children (fail-safe skeleton)', () => {
      const doc = parse(null)
      expect(doc.querySelector('html')?.getAttribute('lang')).toBe('ja')
      const className = doc.querySelector('body')?.className ?? ''
      for (const cls of ['min-h-screen', 'bg-background', 'font-sans', 'antialiased']) {
        expect(className.split(/\s+/)).toContain(cls)
      }
    })
  })
})
