import { describe, it, expect } from 'vitest'
import {
  UNIVERSAL_CONSTRAINTS,
  CONSTRAINTS_EN,
  getConstraints,
} from '@/lib/ai/personas/prompts/constraints'

describe('UNIVERSAL_CONSTRAINTS', () => {
  it('should be a non-empty string', () => {
    expect(UNIVERSAL_CONSTRAINTS.length).toBeGreaterThan(0)
  })

  it('should contain all 8 principles in Japanese', () => {
    expect(UNIVERSAL_CONSTRAINTS).toContain('中立性')
    expect(UNIVERSAL_CONSTRAINTS).toContain('根拠明示')
    expect(UNIVERSAL_CONSTRAINTS).toContain('不確実性の開示')
    expect(UNIVERSAL_CONSTRAINTS).toContain('代替案提示')
    expect(UNIVERSAL_CONSTRAINTS).toContain('リスク開示')
    expect(UNIVERSAL_CONSTRAINTS).toContain('専門用語の定義')
    expect(UNIVERSAL_CONSTRAINTS).toContain('前提条件の明示')
    expect(UNIVERSAL_CONSTRAINTS).toContain('データソースの明示')
  })

  it('should contain analysis principles header', () => {
    expect(UNIVERSAL_CONSTRAINTS).toContain('分析の基本原則')
  })
})

describe('CONSTRAINTS_EN', () => {
  it('should be a non-empty string', () => {
    expect(CONSTRAINTS_EN.length).toBeGreaterThan(0)
  })

  it('should contain all 8 principles in English', () => {
    expect(CONSTRAINTS_EN).toContain('Neutrality')
    expect(CONSTRAINTS_EN).toContain('Evidence-Based')
    expect(CONSTRAINTS_EN).toContain('Uncertainty Disclosure')
    expect(CONSTRAINTS_EN).toContain('Alternative Options')
    expect(CONSTRAINTS_EN).toContain('Risk Disclosure')
    expect(CONSTRAINTS_EN).toContain('Technical Terms')
    expect(CONSTRAINTS_EN).toContain('Assumptions')
    expect(CONSTRAINTS_EN).toContain('Data Sources')
  })

  it('should contain analysis principles header', () => {
    expect(CONSTRAINTS_EN).toContain('Fundamental Analysis Principles')
  })
})

describe('getConstraints', () => {
  it('should return Japanese constraints for ja', () => {
    const result = getConstraints('ja')
    expect(result).toBe(UNIVERSAL_CONSTRAINTS)
  })

  it('should return English constraints for en', () => {
    const result = getConstraints('en')
    expect(result).toBe(CONSTRAINTS_EN)
  })
})
