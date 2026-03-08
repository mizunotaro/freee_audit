import { describe, it, expect } from 'vitest'
import { getStatusLabel, type ProposalStatus } from '@/components/journal-proposal/StatusBadge'

describe('StatusBadge', () => {
  describe('getStatusLabel', () => {
    it('should return Japanese label by default', () => {
      expect(getStatusLabel('draft')).toBe('下書き')
      expect(getStatusLabel('pending')).toBe('確認待ち')
      expect(getStatusLabel('approved')).toBe('承認済み')
      expect(getStatusLabel('rejected')).toBe('却下済み')
      expect(getStatusLabel('exported')).toBe('転送済み')
    })

    it('should return English label when locale is en', () => {
      expect(getStatusLabel('draft', 'en')).toBe('Draft')
      expect(getStatusLabel('pending', 'en')).toBe('Pending Review')
      expect(getStatusLabel('approved', 'en')).toBe('Approved')
      expect(getStatusLabel('rejected', 'en')).toBe('Rejected')
      expect(getStatusLabel('exported', 'en')).toBe('Exported')
    })
  })

  describe('STATUS_LABELS completeness', () => {
    const statuses: ProposalStatus[] = ['draft', 'pending', 'approved', 'rejected', 'exported']

    it('should have labels for all statuses in Japanese', () => {
      statuses.forEach((status) => {
        expect(() => getStatusLabel(status, 'ja')).not.toThrow()
        expect(getStatusLabel(status, 'ja')).toBeTruthy()
      })
    })

    it('should have labels for all statuses in English', () => {
      statuses.forEach((status) => {
        expect(() => getStatusLabel(status, 'en')).not.toThrow()
        expect(getStatusLabel(status, 'en')).toBeTruthy()
      })
    })
  })
})
