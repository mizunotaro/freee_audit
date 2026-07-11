import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import {
  failure,
  success,
  type Result,
  type AppError,
  createAppError,
  ERROR_CODES,
} from '@/types/result'

const SUITE = 'perf-bench-01'
const HERE = dirname(fileURLToPath(import.meta.url))
const BENCH_DIR = resolve(HERE, '..')
const ARTIFACT_DIR = join(BENCH_DIR, '.artifacts')
const MERGED_REPORT = join(ARTIFACT_DIR, 'bench-report.json')

export interface BenchResult {
  name: string
  inputSize: number
  iterations: number
  samplesMs: number[]
  assertion: 'passed' | 'failed'
  meta?: Record<string, unknown>
}

const BenchResultSchema = z.object({
  name: z.string().min(1),
  inputSize: z.number(),
  iterations: z.number().int().min(1),
  samplesMs: z.array(z.number().nonnegative()),
  assertion: z.enum(['passed', 'failed']),
  meta: z.record(z.unknown()).optional(),
})

export interface BenchStats {
  minMs: number
  medianMs: number
  meanMs: number
  p95Ms: number
  maxMs: number
}

export interface BenchSection extends BenchStats {
  name: string
  suite: typeof SUITE
  inputSize: number
  iterations: number
  samplesMs: number[]
  assertion: 'passed' | 'failed'
  meta?: Record<string, unknown>
}

function computeStats(samples: number[]): BenchStats {
  const sorted = [...samples].sort((a, b) => a - b)
  const n = sorted.length
  const round = (v: number) => Math.round(v * 10000) / 10000
  const mean = samples.reduce((s, x) => s + x, 0) / n
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const p95 = sorted[Math.min(n - 1, Math.floor(0.95 * n))]
  return {
    minMs: round(sorted[0]),
    medianMs: round(median),
    meanMs: round(mean),
    p95Ms: round(p95),
    maxMs: round(sorted[n - 1]),
  }
}

function readMerged(): Record<string, BenchSection> {
  try {
    if (!existsSync(MERGED_REPORT)) return {}
    const raw = readFileSync(MERGED_REPORT, 'utf8')
    const parsed = JSON.parse(raw) as { suites?: Record<string, BenchSection> }
    return parsed.suites ?? {}
  } catch {
    return {}
  }
}

/**
 * Records one benchmark result: writes a per-section JSON file and merges it
 * into the shared `bench-report.json` artifact. Returns the absolute path of the
 * merged report so callers can surface it.
 */
export function recordBench(result: BenchResult): Result<string, AppError> {
  const parsed = BenchResultSchema.safeParse(result)
  if (!parsed.success) {
    return failure(
      createAppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid bench result input', {
        details: { issues: parsed.error.issues },
      })
    )
  }

  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true })
    const stats = computeStats(result.samplesMs)
    const section: BenchSection = {
      name: result.name,
      suite: SUITE,
      inputSize: result.inputSize,
      iterations: result.iterations,
      samplesMs: result.samplesMs.map((v) => Math.round(v * 10000) / 10000),
      assertion: result.assertion,
      meta: result.meta,
      ...stats,
    }

    writeFileSync(
      join(ARTIFACT_DIR, `${result.name}.json`),
      JSON.stringify(section, null, 2) + '\n',
      'utf8'
    )

    const suites = readMerged()
    suites[result.name] = section
    const report = {
      suite: SUITE,
      generatedAt: new Date().toISOString(),
      suites,
    }
    writeFileSync(MERGED_REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8')

    return success(MERGED_REPORT)
  } catch (err) {
    const cause = err instanceof Error ? err : new Error(String(err))
    return failure(
      createAppError(ERROR_CODES.DATABASE_ERROR, 'Failed to write bench artifact', { cause })
    )
  }
}
