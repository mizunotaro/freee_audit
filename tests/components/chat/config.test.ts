import { describe, it, expect } from 'vitest'
import {
  calculateProgress,
  estimateRemaining,
  DEFAULT_CHAT_CONFIG,
  PROGRESS_STAGES,
  type ChatProgressStage,
} from '@/components/chat/config'

const PROCESSING_STAGES: ChatProgressStage[] = [
  'connecting',
  'analyzing',
  'searching',
  'synthesizing',
  'generating',
]
const STAGE_MS = 10000

describe('chat/config — DEFAULT_CHAT_CONFIG', () => {
  it('exposes sane timeout/limit defaults', () => {
    expect(DEFAULT_CHAT_CONFIG).toEqual({
      connectionTimeoutMs: 10000,
      processingTimeoutMs: 120000,
      streamingChunkMs: 30000,
      maxMessageLength: 4000,
      enableProgressAnimation: true,
    })
  })

  it('keeps every timeout strictly positive so AbortController actually fires', () => {
    expect(DEFAULT_CHAT_CONFIG.connectionTimeoutMs).toBeGreaterThan(0)
    expect(DEFAULT_CHAT_CONFIG.processingTimeoutMs).toBeGreaterThan(0)
    expect(DEFAULT_CHAT_CONFIG.streamingChunkMs).toBeGreaterThan(0)
  })
})

describe('chat/config — PROGRESS_STAGES weights', () => {
  it('declares a label/description/weight triple for every known stage', () => {
    const all: ChatProgressStage[] = ['idle', ...PROCESSING_STAGES, 'complete', 'error']
    for (const stage of all) {
      const info = PROGRESS_STAGES[stage]
      expect(typeof info.label).toBe('string')
      expect(info.label.length).toBeGreaterThan(0)
      expect(typeof info.weight).toBe('number')
      expect(info.weight).toBeGreaterThanOrEqual(0)
    }
  })

  it('concentrates all weight on the five processing stages so they sum to 1.0', () => {
    const total = PROCESSING_STAGES.reduce((sum, s) => sum + PROGRESS_STAGES[s].weight, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('zeroes the weight of terminal/idle stages so they contribute nothing', () => {
    expect(PROGRESS_STAGES.idle.weight).toBe(0)
    expect(PROGRESS_STAGES.complete.weight).toBe(0)
    expect(PROGRESS_STAGES.error.weight).toBe(0)
  })
})

describe('chat/config — calculateProgress', () => {
  it('returns 100 only for the complete stage', () => {
    expect(calculateProgress('complete', 0)).toBe(100)
    expect(calculateProgress('complete', 99999)).toBe(100)
  })

  it('returns 0 for idle and error regardless of elapsed time', () => {
    expect(calculateProgress('idle', 0)).toBe(0)
    expect(calculateProgress('error', 50000)).toBe(0)
  })

  it('starts each processing stage at the cumulative weight of prior stages (elapsed 0)', () => {
    const expectedBase = [0, 10, 30, 60, 80]
    PROCESSING_STAGES.forEach((stage, i) => {
      expect(calculateProgress(stage, 0)).toBe(expectedBase[i])
    })
  })

  it('reaches the stage ceiling once a full stage-window (10s) elapses', () => {
    // generating's raw ceiling (100) is itself clamped to the 95% cap.
    const expectedCeiling = [10, 30, 60, 80, 95]
    PROCESSING_STAGES.forEach((stage, i) => {
      expect(calculateProgress(stage, STAGE_MS)).toBe(expectedCeiling[i])
    })
  })

  it('clamps elapsed time per stage so it never overshoots the ceiling', () => {
    PROCESSING_STAGES.forEach((stage) => {
      const ceiling = calculateProgress(stage, STAGE_MS)
      expect(calculateProgress(stage, STAGE_MS * 5)).toBe(ceiling)
    })
  })

  it('interpolates linearly within a stage window', () => {
    const start = calculateProgress('analyzing', 0)
    const mid = calculateProgress('analyzing', STAGE_MS / 2)
    const end = calculateProgress('analyzing', STAGE_MS)
    expect(mid).toBe(start + (end - start) / 2)
  })

  it('caps the visible bar at 95% even at the final stage ceiling (100)', () => {
    expect(calculateProgress('generating', STAGE_MS)).toBe(95)
    expect(calculateProgress('generating', STAGE_MS * 10)).toBe(95)
  })
})

describe('chat/config — estimateRemaining', () => {
  const AVG = DEFAULT_CHAT_CONFIG.processingTimeoutMs

  it('stays undefined during the grace window (first 3s) to avoid flicker', () => {
    expect(estimateRemaining(0, AVG)).toBeUndefined()
    expect(estimateRemaining(2999, AVG)).toBeUndefined()
  })

  it('reports avg - elapsed once past the grace window', () => {
    expect(estimateRemaining(3000, AVG)).toBe(AVG - 3000)
    expect(estimateRemaining(60000, AVG)).toBe(AVG - 60000)
  })

  it('returns undefined when the estimate would be non-positive', () => {
    expect(estimateRemaining(AVG, AVG)).toBeUndefined()
    expect(estimateRemaining(AVG + 5000, AVG)).toBeUndefined()
  })
})
