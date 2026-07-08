import { describe, it, expect } from 'vitest'
import {
  DEFAULT_WIDGET_SIZE,
  MIN_WIDGET_SIZE,
  MAX_WIDGET_SIZE,
  WIDGET_POSITION_OFFSET,
} from '@/components/chat/types'

describe('chat/types — widget size constants', () => {
  it('matches the documented default/min/max sizes', () => {
    expect(DEFAULT_WIDGET_SIZE).toEqual({ width: 380, height: 500 })
    expect(MIN_WIDGET_SIZE).toEqual({ width: 300, height: 400 })
    expect(MAX_WIDGET_SIZE).toEqual({ width: 600, height: 800 })
  })

  it('keeps the default within the [min, max] clamping envelope (both axes)', () => {
    for (const axis of ['width', 'height'] as const) {
      expect(MIN_WIDGET_SIZE[axis]).toBeLessThanOrEqual(DEFAULT_WIDGET_SIZE[axis])
      expect(DEFAULT_WIDGET_SIZE[axis]).toBeLessThanOrEqual(MAX_WIDGET_SIZE[axis])
    }
  })

  it('keeps min strictly smaller than max so resizing has a usable range', () => {
    expect(MIN_WIDGET_SIZE.width).toBeLessThan(MAX_WIDGET_SIZE.width)
    expect(MIN_WIDGET_SIZE.height).toBeLessThan(MAX_WIDGET_SIZE.height)
  })
})

describe('chat/types — WIDGET_POSITION_OFFSET', () => {
  it('is a positive offset used to keep the widget inside its boundary', () => {
    expect(WIDGET_POSITION_OFFSET).toBeGreaterThan(0)
    expect(WIDGET_POSITION_OFFSET).toBe(20)
  })
})
