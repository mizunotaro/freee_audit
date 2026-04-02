import { describe, it, expect } from 'vitest'
import {
  JSON_OUTPUT_FORMAT,
  OUTPUT_FORMAT_EN,
  getOutputFormat,
} from '@/lib/ai/personas/prompts/output-formats'

describe('JSON_OUTPUT_FORMAT', () => {
  it('should be a non-empty string', () => {
    expect(JSON_OUTPUT_FORMAT.length).toBeGreaterThan(0)
  })

  it('should contain Japanese content', () => {
    expect(JSON_OUTPUT_FORMAT).toContain('出力フォーマット')
    expect(JSON_OUTPUT_FORMAT).toContain('結論')
  })

  it('should contain JSON structure', () => {
    expect(JSON_OUTPUT_FORMAT).toContain('conclusion')
    expect(JSON_OUTPUT_FORMAT).toContain('confidence')
    expect(JSON_OUTPUT_FORMAT).toContain('reasoning')
    expect(JSON_OUTPUT_FORMAT).toContain('risks')
    expect(JSON_OUTPUT_FORMAT).toContain('alternatives')
    expect(JSON_OUTPUT_FORMAT).toContain('recommendedAction')
  })

  it('should contain field constraints', () => {
    expect(JSON_OUTPUT_FORMAT).toContain('フィールド制約')
  })
})

describe('OUTPUT_FORMAT_EN', () => {
  it('should be a non-empty string', () => {
    expect(OUTPUT_FORMAT_EN.length).toBeGreaterThan(0)
  })

  it('should contain English content', () => {
    expect(OUTPUT_FORMAT_EN).toContain('Output Format')
    expect(OUTPUT_FORMAT_EN).toContain('Conclusion')
  })

  it('should contain JSON structure', () => {
    expect(OUTPUT_FORMAT_EN).toContain('conclusion')
    expect(OUTPUT_FORMAT_EN).toContain('confidence')
    expect(OUTPUT_FORMAT_EN).toContain('reasoning')
    expect(OUTPUT_FORMAT_EN).toContain('risks')
  })

  it('should contain field constraints', () => {
    expect(OUTPUT_FORMAT_EN).toContain('Field Constraints')
  })
})

describe('getOutputFormat', () => {
  it('should return Japanese format for ja', () => {
    const result = getOutputFormat('ja')
    expect(result).toBe(JSON_OUTPUT_FORMAT)
  })

  it('should return English format for en', () => {
    const result = getOutputFormat('en')
    expect(result).toBe(OUTPUT_FORMAT_EN)
  })
})
