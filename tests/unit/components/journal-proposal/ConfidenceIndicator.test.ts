import { describe, it, expect } from 'vitest'
import {
  getConfidenceLevel,
  getConfidenceColor,
} from '@/components/journal-proposal/ConfidenceIndicator'
import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

describe('ConfidenceIndicator', () => {
  const thresholds = JOURNAL_PROPOSAL_CONFIG.confidence.thresholds

  describe('getConfidenceLevel', () => {
    it('should return "high" for confidence >= 0.9', () => {
      expect(getConfidenceLevel(0.9)).toBe('high')
      expect(getConfidenceLevel(0.95)).toBe('high')
      expect(getConfidenceLevel(1.0)).toBe('high')
    })

    it('should return "medium" for confidence >= 0.7 and < 0.9', () => {
      expect(getConfidenceLevel(0.7)).toBe('medium')
      expect(getConfidenceLevel(0.8)).toBe('medium')
      expect(getConfidenceLevel(0.89)).toBe('medium')
    })

    it('should return "low" for confidence >= 0.5 and < 0.7', () => {
      expect(getConfidenceLevel(0.5)).toBe('low')
      expect(getConfidenceLevel(0.6)).toBe('low')
      expect(getConfidenceLevel(0.69)).toBe('low')
    })

    it('should return "very-low" for confidence < 0.5', () => {
      expect(getConfidenceLevel(0.0)).toBe('very-low')
      expect(getConfidenceLevel(0.3)).toBe('very-low')
      expect(getConfidenceLevel(0.49)).toBe('very-low')
    })

    it('should use thresholds from config', () => {
      expect(getConfidenceLevel(thresholds.high)).toBe('high')
      expect(getConfidenceLevel(thresholds.medium - 0.01)).toBe('low')
      expect(getConfidenceLevel(thresholds.low - 0.01)).toBe('very-low')
    })
  })

  describe('getConfidenceColor', () => {
    it('should return green for high confidence', () => {
      expect(getConfidenceColor(0.9)).toBe('text-green-600')
      expect(getConfidenceColor(1.0)).toBe('text-green-600')
    })

    it('should return yellow for medium confidence', () => {
      expect(getConfidenceColor(0.7)).toBe('text-yellow-600')
      expect(getConfidenceColor(0.8)).toBe('text-yellow-600')
    })

    it('should return orange for low confidence', () => {
      expect(getConfidenceColor(0.5)).toBe('text-orange-600')
      expect(getConfidenceColor(0.6)).toBe('text-orange-600')
    })

    it('should return red for very-low confidence', () => {
      expect(getConfidenceColor(0.0)).toBe('text-red-600')
      expect(getConfidenceColor(0.4)).toBe('text-red-600')
    })
  })
})
