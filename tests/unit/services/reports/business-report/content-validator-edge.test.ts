import {
  validateGeneratedContent,
  calculateConfidence,
  checkLegalTerminology,
  validateCompleteReport,
} from '@/services/reports/business-report/content-validator'

describe('validateGeneratedContent (exact boundaries)', () => {
  describe('minLength boundary (auditor.opinion: min 50, no keywords/patterns)', () => {
    it('passes with no warnings when content length equals minLength', () => {
      const result = validateGeneratedContent('auditor.opinion', 'a'.repeat(50))
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })

    it('warns on short content one char below minLength', () => {
      const result = validateGeneratedContent('auditor.opinion', 'a'.repeat(49))
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('文字数が不足')
    })
  })

  describe('maxLength boundary (auditor.opinion: max 5000)', () => {
    it('stays valid when content length equals maxLength', () => {
      const result = validateGeneratedContent('auditor.opinion', 'a'.repeat(5000))
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('errors exactly one char over maxLength', () => {
      const result = validateGeneratedContent('auditor.opinion', 'a'.repeat(5001))
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].code).toBe('CONTENT_TOO_LONG')
      expect(result.errors[0].message).toContain('5001')
      expect(result.errors[0].message).toContain('5000')
    })
  })

  describe('placeholder threshold (productionOrders: maxLength only)', () => {
    it('does not warn when exactly 3 〇〇 placeholders are present (boundary)', () => {
      const result = validateGeneratedContent('companyStatus.productionOrders', '〇〇'.repeat(3))
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('warns when a 4th 〇〇 placeholder appears', () => {
      const result = validateGeneratedContent('companyStatus.productionOrders', '〇〇'.repeat(4))
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('プレースホルダー')
    })

    it('warns when a 4th {{...}} placeholder appears', () => {
      const result = validateGeneratedContent(
        'companyStatus.productionOrders',
        '{{a}}{{b}}{{c}}{{d}}'
      )
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('プレースホルダー')
    })
  })
})

describe('calculateConfidence (penalty math)', () => {
  it('is exactly 1.0 for clean content with source data', () => {
    const confidence = calculateConfidence('auditor.opinion', 'a'.repeat(60), true)
    expect(confidence).toBe(1)
  })

  it('is clamped to 0 for maximally degraded content', () => {
    const confidence = calculateConfidence(
      'companyStatus.businessPerformance',
      '〇〇△△[]'.repeat(20),
      false
    )
    expect(confidence).toBe(0)
  })

  it('deducts 0.05 per [] placeholder (calculateConfidence-only pattern)', () => {
    const clean = calculateConfidence('auditor.opinion', 'a'.repeat(60), true)
    const withPlaceholders = calculateConfidence(
      'auditor.opinion',
      '[]'.repeat(2) + 'a'.repeat(60),
      true
    )
    expect(clean).toBe(1)
    expect(withPlaceholders).toBe(0.9)
  })

  it('never exceeds 1.0 even with no penalties', () => {
    expect(calculateConfidence('auditor.opinion', 'a'.repeat(60), true)).toBeLessThanOrEqual(1)
  })
})

describe('checkLegalTerminology', () => {
  it('always returns an empty missing array (field is currently unused)', () => {
    const result = checkLegalTerminology('取締役会と貸借対照表について説明します。')
    expect(result.used).toContain('取締役会')
    expect(result.used).toContain('貸借対照表')
    expect(result.missing).toEqual([])
  })

  it('returns empty used and missing arrays when no legal terms appear', () => {
    const result = checkLegalTerminology('nothing legal here at all')
    expect(result.used).toEqual([])
    expect(result.missing).toEqual([])
  })
})

describe('validateCompleteReport (completeness math)', () => {
  it('treats whitespace-only content as missing even when raw length >= 50', () => {
    const result = validateCompleteReport({
      'companyStatus.businessDescription': '   '.repeat(20),
    })
    expect(result.isValid).toBe(false)
    expect(result.completeness).toBe(0)
    expect(result.missingSections).toContain('companyStatus.businessDescription')
    expect(result.warnings).toContain('必須セクションの100%が未入力です')
  })

  it('computes completeness as filledCount/requiredCount*100', () => {
    const result = validateCompleteReport({
      'officers.directors': 'a'.repeat(60),
    })
    expect(result.isValid).toBe(false)
    expect(result.completeness).toBe(12.5)
    expect(result.missingSections).toHaveLength(7)
    expect(result.warnings).toContain('必須セクションの87.5%が未入力です')
  })

  it('counts a section filled with exactly 50 non-space chars as complete', () => {
    const result = validateCompleteReport({
      'companyStatus.businessDescription': 'a'.repeat(50),
    })
    expect(result.completeness).toBe(12.5)
    expect(result.missingSections).not.toContain('companyStatus.businessDescription')
  })
})
