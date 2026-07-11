export interface Rng {
  next(): number
  int(minInclusive: number, maxInclusive: number): number
  pick<T>(items: readonly T[]): T
  bool(probabilityTrue?: number): boolean
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  if (state === 0) state = 0x9e3779b9

  const next = (): number => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    bool: (p = 0.5) => next() < p,
  }
}
