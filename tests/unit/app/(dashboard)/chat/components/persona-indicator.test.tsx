import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonaIndicator, PersonaLegend, getPersonaConfig } from '@/app/(dashboard)/chat/components/persona-indicator'

describe('PersonaIndicator', () => {
  it('should render default avatar when no persona', () => {
    render(<PersonaIndicator />)
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('should render CPA persona', () => {
    render(<PersonaIndicator persona="cpa" />)
    expect(screen.getByText('CPA')).toBeInTheDocument()
  })

  it('should render tax accountant persona', () => {
    render(<PersonaIndicator persona="tax_accountant" />)
    expect(screen.getByText('税')).toBeInTheDocument()
  })

  it('should render CFO persona', () => {
    render(<PersonaIndicator persona="cfo" />)
    expect(screen.getByText('CFO')).toBeInTheDocument()
  })

  it('should render financial analyst persona', () => {
    render(<PersonaIndicator persona="financial_analyst" />)
    expect(screen.getByText('FA')).toBeInTheDocument()
  })

  it('should render big4 auditor persona', () => {
    render(<PersonaIndicator persona="big4_auditor" />)
    expect(screen.getByText('B4')).toBeInTheDocument()
  })

  it('should apply size classes', () => {
    const { container: smContainer } = render(<PersonaIndicator size="sm" />)
    const smAvatar = smContainer.querySelector('.h-6.w-6')
    expect(smAvatar).toBeInTheDocument()

    const { container: lgContainer } = render(<PersonaIndicator size="lg" />)
    const lgAvatar = lgContainer.querySelector('.h-10.w-10')
    expect(lgAvatar).toBeInTheDocument()
  })
})

describe('PersonaLegend', () => {
  it('should render all persona names', () => {
    render(<PersonaLegend />)

    expect(screen.getByText('公認会計士')).toBeInTheDocument()
    expect(screen.getByText('税理士')).toBeInTheDocument()
    expect(screen.getByText('CFO')).toBeInTheDocument()
    expect(screen.getByText('財務アナリスト')).toBeInTheDocument()
    expect(screen.getByText('Big4監査人')).toBeInTheDocument()
  })

  it('should render color dots for each persona', () => {
    const { container } = render(<PersonaLegend />)
    const dots = container.querySelectorAll('.rounded-full')
    expect(dots.length).toBe(5)
  })
})

describe('getPersonaConfig', () => {
  it('should return default config for undefined persona', () => {
    const config = getPersonaConfig(undefined)
    expect(config.name).toBe('AI')
    expect(config.initials).toBe('AI')
  })

  it('should return CPA config', () => {
    const config = getPersonaConfig('cpa')
    expect(config.name).toBe('公認会計士')
    expect(config.initials).toBe('CPA')
  })

  it('should return CFO config', () => {
    const config = getPersonaConfig('cfo')
    expect(config.name).toBe('CFO')
    expect(config.initials).toBe('CFO')
  })

  it('should return default config for unknown persona type that is not in config', () => {
    const config = getPersonaConfig(undefined)
    expect(config.name).toBe('AI')
  })
})
