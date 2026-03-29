import crypto from 'crypto'
import { MemoryCache } from '@/lib/cache/memory-cache'

const VERSION = '1.0.0'

export interface PromptThreat {
  type: PromptThreatType
  severity: 'low' | 'medium' | 'high' | 'critical'
  pattern: string
  matchedText: string
  position: number
}

export type PromptThreatType =
  | 'role_override'
  | 'instruction_injection'
  | 'data_exfiltration'
  | 'jailbreak'
  | 'encoding_attack'
  | 'template_injection'
  | 'context_manipulation'
  | 'pii_extraction'

export interface PromptGuardResult {
  safe: boolean
  threats: PromptThreat[]
  sanitizedInput: string
  riskScore: number
}

interface GuardRule {
  type: PromptThreatType
  severity: PromptThreat['severity']
  patterns: RegExp[]
  sanitizer?: (text: string) => string
}

const _INJECTION_CACHE_MAX = 5000
const injectionCache = new MemoryCache<{ result: PromptGuardResult }>(300000)

const GUARD_RULES: GuardRule[] = [
  {
    type: 'role_override',
    severity: 'critical',
    patterns: [
      /ignore\s+(all\s+)?previous\s+(instructions?|prompts?)/i,
      /forget\s+(all\s+)?previous\s+(instructions?|prompts?)/i,
      /disregard\s+(all\s+)?previous/i,
      /you\s+are\s+now\s+(?:a|an)\s+/i,
      /new\s+instructions?\s*:/i,
      /system\s*:\s*/i,
      /(?:act|pretend|behave)\s+as\s+(?:if\s+you\s+are\s+)?(?:a|an)\s+/i,
      /(?:from\s+now\s+on|starting\s+now)\s*,?\s*you\s+/i,
    ],
  },
  {
    type: 'instruction_injection',
    severity: 'high',
    patterns: [
      /(?:print|output|show|display|write|return)\s+(?:me\s+)?(?:the\s+)?(?:system|initial|original|hidden|secret)\s+(?:prompt|instruction|message)/i,
      /(?:reveal|expose|share|tell\s+me)\s+(?:your|the)\s+(?:system|hidden|secret)\s+(?:prompt|instruction)/i,
      /\[\/?system\]/i,
      /<\s*\/?\s*system\s*>/i,
      /###\s*system/i,
      /\bexecute\s*\(/i,
      /\beval\s*\(/i,
      /\bFunction\s*\(/i,
    ],
  },
  {
    type: 'data_exfiltration',
    severity: 'critical',
    patterns: [
      /(?:send|transmit|post|fetch|request)\s+.*(?:to|towards?)\s+(?:https?:\/\/|ftp:\/\/)/i,
      /(?:api\.openai|api\.anthropic)\.com/i,
      /xmlhttprequest/i,
      /fetch\s*\(\s*['"]/i,
      /\bURL\s*\(/i,
      /document\.cookie/i,
      /localStorage|sessionStorage/i,
    ],
  },
  {
    type: 'jailbreak',
    severity: 'critical',
    patterns: [
      /DAN\s+(?:mode|jailbreak)/i,
      /(?:enabled|switch|toggle)\s+(?:developer|god|admin|root)\s+mode/i,
      /bypass\s+(?:safety|security|filter|guard|restriction)/i,
      /(?:hack|exploit|circumvent|override)\s+(?:the\s+)?(?:limit|guard|safety|security|filter)/i,
      /(?:anything|everything)\s+I\s+(?:say|tell|ask)\s+/i,
      /no\s+(?:rules|restrictions|limits|boundaries|filters)\s+apply/i,
    ],
  },
  {
    type: 'encoding_attack',
    severity: 'high',
    patterns: [
      /\\u[0-9a-fA-F]{4}/,
      /\\x[0-9a-fA-F]{2}/,
      /&#x?[0-9a-fA-F]+;/,
      // eslint-disable-next-line no-control-regex
      /\x00/u,
      /%[0-9a-fA-F]{2}%[0-9a-fA-F]{2}/,
    ],
  },
  {
    type: 'template_injection',
    severity: 'high',
    patterns: [/\{\{.*?\}\}/, /\$\{.*?\}/, /<%.*?%>/, /\{%.*?%\}/],
  },
  {
    type: 'context_manipulation',
    severity: 'medium',
    patterns: [
      /(?:inject|insert|append|prepend)\s+(?:this|the\s+following)\s+(?:into|to)\s+(?:the\s+)?(?:context|prompt|system)/i,
      /(?:above|below|following|preceding)\s+(?:text|instructions?|prompt)\s+(?:is|are)\s+(?:the|actually)\s+/i,
    ],
  },
  {
    type: 'pii_extraction',
    severity: 'medium',
    patterns: [
      /(?:give|provide|list|show)\s+me\s+(?:all\s+)?(?:user|customer|client|employee)\s+(?:data|information|records|details)/i,
      /(?:dump|export|extract)\s+(?:the\s+)?(?:database|users?|records?|table)/i,
    ],
  },
]

function computeInputHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function sanitizeMatchedText(text: string): string {
  return text.length > 100 ? text.slice(0, 100) + '...' : text
}

function sanitizeInput(input: string): string {
  let sanitized = input

  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, '')
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/gu, '')
  sanitized = sanitized.replace(/[\u202A-\u202E]/gu, '')
  sanitized = sanitized.normalize('NFC')

  return sanitized
}

function calculateRiskScore(threats: PromptThreat[]): number {
  if (threats.length === 0) return 0

  const severityScores: Record<string, number> = {
    critical: 40,
    high: 25,
    medium: 15,
    low: 5,
  }

  let score = 0
  for (const threat of threats) {
    score += severityScores[threat.severity] ?? 10
  }

  return Math.min(100, score)
}

export function scanPrompt(input: string): PromptGuardResult {
  const sanitizedInput = sanitizeInput(input)
  const threats: PromptThreat[] = []
  const searchSpace = sanitizedInput

  for (const rule of GUARD_RULES) {
    for (const pattern of rule.patterns) {
      const match = pattern.exec(searchSpace)
      if (match) {
        threats.push({
          type: rule.type,
          severity: rule.severity,
          pattern: pattern.source,
          matchedText: sanitizeMatchedText(match[0]),
          position: match.index,
        })
      }
    }
  }

  const riskScore = calculateRiskScore(threats)

  return {
    safe: riskScore < 50,
    threats,
    sanitizedInput,
    riskScore,
  }
}

export function guardPrompt(input: string): PromptGuardResult {
  if (!input || typeof input !== 'string') {
    return {
      safe: false,
      threats: [],
      sanitizedInput: '',
      riskScore: 100,
    }
  }

  if (input.length > 100000) {
    return {
      safe: false,
      threats: [
        {
          type: 'context_manipulation',
          severity: 'high',
          pattern: 'input_length',
          matchedText: `Input length ${input.length} exceeds 100000`,
          position: 0,
        },
      ],
      sanitizedInput: '',
      riskScore: 80,
    }
  }

  const cacheKey = computeInputHash(input)
  const cached = injectionCache.get(cacheKey)
  if (cached) {
    return cached.result
  }

  const result = scanPrompt(input)

  injectionCache.set(cacheKey, { result })

  return result
}

export function getGuardStats(): { cacheSize: number; version: string } {
  return {
    cacheSize: injectionCache.size(),
    version: VERSION,
  }
}

export { VERSION, GUARD_RULES }

export function clearPromptGuardCache(): void {
  injectionCache.clear()
}
