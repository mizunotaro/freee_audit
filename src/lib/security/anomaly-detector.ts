import crypto from 'crypto'
import { MemoryCache } from '@/lib/cache/memory-cache'

const VERSION = '1.0.0'

export interface AnomalyEvent {
  type: AnomalyType
  severity: 'low' | 'medium' | 'high' | 'critical'
  userId?: string
  ip?: string
  description: string
  timestamp: number
  metadata?: Record<string, unknown>
}

export type AnomalyType =
  | 'rapid_api_calls'
  | 'unusual_login_location'
  | 'credential_stuffing'
  | 'privilege_escalation_attempt'
  | 'mass_data_export'
  | 'unusual_time_access'
  | 'concurrent_session_exceeded'
  | 'repeated_auth_failures'
  | 'suspicious_data_modification'
  | 'ai_abuse'

export interface AnomalyRule {
  type: AnomalyType
  severity: AnomalyEvent['severity']
  windowMs: number
  threshold: number
  description: string
}

export interface AnomalyDetectorConfig {
  rules: AnomalyRule[]
  enabledTypes: Set<AnomalyType>
  maxEventsCache: number
}

const DEFAULT_RULES: AnomalyRule[] = [
  {
    type: 'rapid_api_calls',
    severity: 'high',
    windowMs: 60 * 1000,
    threshold: 100,
    description: 'API call rate exceeded threshold',
  },
  {
    type: 'credential_stuffing',
    severity: 'critical',
    windowMs: 15 * 60 * 1000,
    threshold: 10,
    description: 'Multiple failed login attempts detected',
  },
  {
    type: 'repeated_auth_failures',
    severity: 'high',
    windowMs: 60 * 60 * 1000,
    threshold: 20,
    description: 'Repeated authentication failures from same IP',
  },
  {
    type: 'mass_data_export',
    severity: 'high',
    windowMs: 60 * 60 * 1000,
    threshold: 5,
    description: 'Unusual volume of data export operations',
  },
  {
    type: 'privilege_escalation_attempt',
    severity: 'critical',
    windowMs: 60 * 60 * 1000,
    threshold: 3,
    description: 'Repeated privilege escalation attempts',
  },
  {
    type: 'ai_abuse',
    severity: 'medium',
    windowMs: 60 * 60 * 1000,
    threshold: 50,
    description: 'Excessive AI API usage detected',
  },
  {
    type: 'concurrent_session_exceeded',
    severity: 'medium',
    windowMs: 5 * 60 * 1000,
    threshold: 3,
    description: 'Too many concurrent sessions for user',
  },
]

const eventCache = new MemoryCache<AnomalyEvent[]>(1800000)
const triggeredAlerts = new MemoryCache<boolean>(3600000)

function getEventKey(type: AnomalyType, identifier: string): string {
  return `${type}:${identifier}`
}

function getAlertKey(event: AnomalyEvent): string {
  const raw = `${event.type}:${event.userId ?? 'anon'}:${event.ip ?? 'unknown'}:${Math.floor(event.timestamp / 300000)}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

export class AnomalyDetector {
  private config: AnomalyDetectorConfig

  constructor(config?: Partial<AnomalyDetectorConfig>) {
    this.config = {
      rules: config?.rules ?? DEFAULT_RULES,
      enabledTypes: config?.enabledTypes ?? new Set(DEFAULT_RULES.map((r) => r.type)),
      maxEventsCache: config?.maxEventsCache ?? 10000,
    }
  }

  recordEvent(event: Omit<AnomalyEvent, 'timestamp'>): AnomalyEvent | null {
    if (!this.config.enabledTypes.has(event.type)) return null

    const fullEvent: AnomalyEvent = {
      ...event,
      timestamp: Date.now(),
    }

    const identifier = event.userId ?? event.ip ?? 'unknown'
    const key = getEventKey(event.type, identifier)

    const existing = eventCache.get(key) ?? []
    const windowMs = this.getRuleForType(event.type)?.windowMs ?? 60000
    const cutoff = Date.now() - windowMs

    const filtered = existing.filter((e) => e.timestamp > cutoff)
    filtered.push(fullEvent)

    eventCache.set(key, filtered)

    return this.checkThreshold(event.type, identifier, filtered)
  }

  private checkThreshold(
    type: AnomalyType,
    identifier: string,
    events: AnomalyEvent[]
  ): AnomalyEvent | null {
    const rule = this.getRuleForType(type)
    if (!rule) return null

    if (events.length >= rule.threshold) {
      const alertKey = getAlertKey(events[events.length - 1])
      if (triggeredAlerts.has(alertKey)) return null

      const alert: AnomalyEvent = {
        type,
        severity: rule.severity,
        userId: identifier !== 'unknown' ? identifier : undefined,
        description: `${rule.description} (${events.length} events in ${rule.windowMs / 1000}s window)`,
        timestamp: Date.now(),
        metadata: {
          eventCount: events.length,
          threshold: rule.threshold,
          windowMs: rule.windowMs,
        },
      }

      triggeredAlerts.set(alertKey, true)
      return alert
    }

    return null
  }

  private getRuleForType(type: AnomalyType): AnomalyRule | undefined {
    return this.config.rules.find((r) => r.type === type)
  }

  getEvents(type: AnomalyType, identifier: string): AnomalyEvent[] {
    const key = getEventKey(type, identifier)
    return eventCache.get(key) ?? []
  }

  getActiveAlerts(): number {
    return triggeredAlerts.size()
  }

  clearEvents(type?: AnomalyType, identifier?: string): void {
    if (type && identifier) {
      eventCache.delete(getEventKey(type, identifier))
    } else {
      eventCache.clear()
      triggeredAlerts.clear()
    }
  }
}

let detectorInstance: AnomalyDetector | null = null

export function getAnomalyDetector(): AnomalyDetector {
  if (!detectorInstance) {
    detectorInstance = new AnomalyDetector()
  }
  return detectorInstance
}

export function resetAnomalyDetector(): void {
  detectorInstance = null
  eventCache.clear()
  triggeredAlerts.clear()
}

export { VERSION, DEFAULT_RULES }
