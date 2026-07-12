import { describe, it, expect } from 'vitest'
import { routing, Link, redirect, usePathname, useRouter, getPathname } from '@/i18n/routing'

describe('src/i18n/routing', () => {
  describe('routing config', () => {
    it('declares exactly the supported locales in canonical order', () => {
      expect(routing.locales).toEqual(['ja', 'en'])
    })

    it('exposes locales as a two-element array', () => {
      expect(Array.isArray(routing.locales)).toBe(true)
      expect(routing.locales).toHaveLength(2)
    })

    it('uses ja as the default locale', () => {
      expect(routing.defaultLocale).toBe('ja')
    })

    it('always prefixes the locale to every routed path', () => {
      expect(routing.localePrefix).toBe('always')
    })

    it('keeps the default locale consistent with the first locale entry', () => {
      expect(routing.locales[0]).toBe(routing.defaultLocale)
    })

    it('declares every locale the rest of the app may route to', () => {
      expect(routing.locales).toContain('ja')
      expect(routing.locales).toContain('en')
    })
  })

  describe('navigation exports', () => {
    it('exports a Link React component', () => {
      expect(Link).toBeDefined()
      expect(typeof Link).toBe('object')
      // React library components carry the react element $$typeof marker
      expect((Link as { $$typeof?: unknown }).$$typeof).toBeDefined()
    })

    it('exports a redirect function', () => {
      expect(redirect).toBeDefined()
      expect(typeof redirect).toBe('function')
    })

    it('exports a usePathname hook', () => {
      expect(usePathname).toBeDefined()
      expect(typeof usePathname).toBe('function')
    })

    it('exports a useRouter hook', () => {
      expect(useRouter).toBeDefined()
      expect(typeof useRouter).toBe('function')
    })

    it('exports a getPathname function', () => {
      expect(getPathname).toBeDefined()
      expect(typeof getPathname).toBe('function')
    })

    it('exports five distinct navigation members', () => {
      const members = [Link, redirect, usePathname, useRouter, getPathname]
      expect(new Set(members).size).toBe(members.length)
    })
  })

  describe('getPathname (behavioral wiring to the routing config)', () => {
    // These assertions prove the navigation helpers are bound to OUR routing
    // config (localePrefix: 'always') and actually localize a path — not just
    // that some function was exported.
    it('prefixes the default ja locale to a top-level path', () => {
      expect(getPathname({ locale: 'ja', href: '/dashboard' })).toBe('/ja/dashboard')
    })

    it('prefixes the en locale to a top-level path', () => {
      expect(getPathname({ locale: 'en', href: '/dashboard' })).toBe('/en/dashboard')
    })

    it('preserves nested path segments under the locale prefix', () => {
      expect(getPathname({ locale: 'ja', href: '/reports/monthly' })).toBe('/ja/reports/monthly')
    })

    it('localizes the login route used by middleware', () => {
      expect(getPathname({ locale: 'en', href: '/login' })).toBe('/en/login')
    })

    it('applies the locale prefix exactly once', () => {
      const result = getPathname({ locale: 'en', href: '/login' })
      const occurrences = result.split('/en').length - 1
      expect(occurrences).toBe(1)
    })

    it('localizes the root path', () => {
      const result = getPathname({ locale: 'ja', href: '/' })
      expect(result).toMatch(/^\/ja\/?$/)
      expect(result.startsWith('/ja')).toBe(true)
    })
  })
})
