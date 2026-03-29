import { describe, it, expect, beforeEach } from 'vitest'
import {
  AnomalyDetector,
  resetAnomalyDetector,
  DEFAULT_RULES,
} from '@/lib/security/anomaly-detector'

describe('AnomalyDetector', () => {
  let detector: AnomalyDetector

  beforeEach(() => {
    resetAnomalyDetector()
    detector = new AnomalyDetector()
  })

  describe('recordEvent', () => {
    it('should not trigger alert below threshold', () => {
      for (let i = 0; i < 5; i++) {
        const alert = detector.recordEvent({
          type: 'rapid_api_calls',
          severity: 'high',
          userId: 'user-1',
          description: 'API call',
        })
        expect(alert).toBeNull()
      }
    })

    it('should trigger alert at threshold', () => {
      const rule = DEFAULT_RULES.find((r) => r.type === 'credential_stuffing')!

      for (let i = 0; i < rule.threshold - 1; i++) {
        const noAlert = detector.recordEvent({
          type: 'credential_stuffing',
          severity: 'critical',
          ip: '192.168.1.1',
          description: 'Failed login',
        })
        expect(noAlert).toBeNull()
      }

      const finalAlert = detector.recordEvent({
        type: 'credential_stuffing',
        severity: 'critical',
        ip: '192.168.1.1',
        description: 'Failed login',
      })

      expect(finalAlert).not.toBeNull()
      expect(finalAlert!.severity).toBe('critical')
      expect(finalAlert!.type).toBe('credential_stuffing')
    })

    it('should deduplicate alerts within same window', () => {
      const rule = DEFAULT_RULES.find((r) => r.type === 'credential_stuffing')!
      for (let i = 0; i < rule.threshold; i++) {
        detector.recordEvent({
          type: 'credential_stuffing',
          severity: 'critical',
          ip: '10.0.0.1',
          description: 'Failed login',
        })
      }

      const alert1 = detector.recordEvent({
        type: 'credential_stuffing',
        severity: 'critical',
        ip: '10.0.0.1',
        description: 'Failed login extra',
      })

      expect(alert1).toBeNull()
    })

    it('should track events by different identifiers independently', () => {
      for (let i = 0; i < 50; i++) {
        detector.recordEvent({
          type: 'rapid_api_calls',
          severity: 'high',
          userId: 'user-A',
          description: 'API call',
        })
        detector.recordEvent({
          type: 'rapid_api_calls',
          severity: 'high',
          userId: 'user-B',
          description: 'API call',
        })
      }

      const eventsA = detector.getEvents('rapid_api_calls', 'user-A')
      const eventsB = detector.getEvents('rapid_api_calls', 'user-B')
      expect(eventsA.length).toBe(50)
      expect(eventsB.length).toBe(50)
    })
  })

  describe('getActiveAlerts', () => {
    it('should return 0 when no alerts triggered', () => {
      expect(detector.getActiveAlerts()).toBe(0)
    })
  })

  describe('clearEvents', () => {
    it('should clear events by type and identifier', () => {
      detector.recordEvent({
        type: 'rapid_api_calls',
        severity: 'high',
        userId: 'user-1',
        description: 'API call',
      })
      detector.clearEvents('rapid_api_calls', 'user-1')
      expect(detector.getEvents('rapid_api_calls', 'user-1')).toHaveLength(0)
    })
  })

  describe('DEFAULT_RULES', () => {
    it('should have expected default rules', () => {
      const types = DEFAULT_RULES.map((r) => r.type)
      expect(types).toContain('rapid_api_calls')
      expect(types).toContain('credential_stuffing')
      expect(types).toContain('repeated_auth_failures')
      expect(types).toContain('mass_data_export')
      expect(types).toContain('ai_abuse')
    })
  })
})
