#!/usr/bin/env node
// auto-pm verification gate (diff-scoped) for freee_audit
// Usage: node scripts/autopm_verify.mjs --changed-only [--base origin/master]
//
// Exit codes:
//   0  = success (all relevant gates passed)
//   1  = verification failed (gate caught a defect in the diff)
//   78 = no diff (signal: nothing to verify; treat as fail in PR context)
//   2  = infrastructure error (tool missing, git failure, etc.)
//
// Honours LESSON 5 / 27 / 36: per-task gates scope to the diff, never whole-repo.
// TypeScript runs whole-repo (no per-file mode) but only failures touching
// changed files are surfaced — pre-existing errors elsewhere never poison the gate.

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const args = parseArgs(process.argv.slice(2))
const BASE = args.base ?? 'origin/master'
const VERBOSE = !!args.verbose

const STEP_TIMEOUT_MS = 10 * 60 * 1000

// pnpm invocation prefix — uses `pnpm` if on PATH, else falls back to `corepack pnpm`.
// Resolved at startup in main().
let PNPM = 'pnpm'

const EXIT_OK = 0
const EXIT_FAIL = 1
const EXIT_NO_DIFF = 78
const EXIT_INFRA = 2

const summary = {
  base: BASE,
  changedFiles: [],
  steps: [],
  exitCode: null,
}

main().catch(err => {
  console.error('[autopm_verify] fatal:', err?.stack ?? err)
  summary.exitCode = EXIT_INFRA
  emitSummary()
  process.exit(EXIT_INFRA)
})

async function detectPnpm() {
  const direct = await runCmd('pnpm --version')
  if (direct.code === 0) return 'pnpm'
  const corep = await runCmd('corepack pnpm --version')
  if (corep.code === 0) return 'corepack pnpm'
  return null
}

async function main() {
  const detected = await detectPnpm()
  if (!detected) {
    log('FATAL: neither `pnpm` nor `corepack pnpm` is invocable')
    summary.exitCode = EXIT_INFRA
    emitSummary()
    process.exit(EXIT_INFRA)
  }
  PNPM = detected
  log(`pnpm invocation: ${PNPM}`)
  const changed = await collectChangedFiles()
  summary.changedFiles = changed

  if (changed.length === 0) {
    log('no diff vs base — exiting with 78')
    summary.exitCode = EXIT_NO_DIFF
    emitSummary()
    process.exit(EXIT_NO_DIFF)
  }

  log(`changed files (${changed.length}):`)
  for (const f of changed) log(`  • ${f}`)

  const buckets = classifyChanged(changed)
  log(`buckets: ${JSON.stringify({
    ts: buckets.ts.length,
    tests: buckets.tests.length,
    python: buckets.python.length,
    r: buckets.r.length,
    prisma: buckets.prisma.length,
    other: buckets.other.length,
  })}`)

  let ok = true

  // Step 1: TypeScript (whole-repo, error filter by changed files)
  if (buckets.ts.length > 0 || buckets.tests.length > 0) {
    const step = await runTypecheckFiltered(new Set([...buckets.ts, ...buckets.tests]))
    summary.steps.push(step)
    if (!step.ok) ok = false
  } else {
    summary.steps.push({ name: 'typecheck', ok: true, skipped: 'no TS/TSX diff' })
  }

  // Step 2: ESLint on changed TS/TSX files
  if (buckets.ts.length > 0 || buckets.tests.length > 0) {
    const targets = [...buckets.ts, ...buckets.tests].filter(f => existsSync(absPath(f)))
    if (targets.length === 0) {
      summary.steps.push({ name: 'eslint', ok: true, skipped: 'no extant TS targets' })
    } else {
      const step = await runEslint(targets)
      summary.steps.push(step)
      if (!step.ok) ok = false
    }
  } else {
    summary.steps.push({ name: 'eslint', ok: true, skipped: 'no TS/TSX diff' })
  }

  // Step 3: Vitest on resolved tests
  if (buckets.ts.length > 0 || buckets.tests.length > 0) {
    const tests = resolveTestFiles(buckets.ts, buckets.tests)
    if (tests.length === 0) {
      summary.steps.push({ name: 'vitest', ok: true, skipped: 'no related tests resolved', resolved: [] })
    } else {
      const step = await runVitest(tests)
      summary.steps.push(step)
      if (!step.ok) ok = false
    }
  } else {
    summary.steps.push({ name: 'vitest', ok: true, skipped: 'no TS/TSX diff' })
  }

  // Step 4: Python (only if python-service changed)
  if (buckets.python.length > 0) {
    const step = await runPytestSubset(buckets.python)
    summary.steps.push(step)
    if (!step.ok) ok = false
  }

  // Step 5: R (warn-only in Phase 0)
  if (buckets.r.length > 0) {
    summary.steps.push({ name: 'rtest', ok: true, skipped: 'r-service changes (Phase 0: warn only)' })
  }

  // Step 6: Prisma schema validate
  if (buckets.prisma.length > 0) {
    const step = await runPrismaValidate()
    summary.steps.push(step)
    if (!step.ok) ok = false
  }

  summary.exitCode = ok ? EXIT_OK : EXIT_FAIL
  emitSummary()
  process.exit(ok ? EXIT_OK : EXIT_FAIL)
}

// -------- helpers --------

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--changed-only') out.changedOnly = true
    else if (a === '--verbose') out.verbose = true
    else if (a === '--base') out.base = argv[++i]
    else if (a.startsWith('--base=')) out.base = a.slice('--base='.length)
    else out._.push(a)
  }
  return out
}

function log(msg) {
  process.stderr.write(`[autopm_verify] ${msg}\n`)
}

function absPath(p) {
  return resolve(ROOT, p)
}

function norm(p) {
  return p.split(sep).join('/')
}

function runCmd(cmd, { capture = true, timeout = STEP_TIMEOUT_MS } = {}) {
  return new Promise(resolveP => {
    const child = spawn(cmd, { cwd: ROOT, shell: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    let stdout = ''
    let stderr = ''
    const t = setTimeout(() => {
      child.kill('SIGKILL')
      resolveP({ code: 124, stdout, stderr: stderr + `\n[timeout after ${timeout}ms]` })
    }, timeout)
    child.stdout.on('data', d => {
      const s = d.toString()
      if (capture) stdout += s
      if (VERBOSE) process.stdout.write(s)
    })
    child.stderr.on('data', d => {
      const s = d.toString()
      if (capture) stderr += s
      if (VERBOSE) process.stderr.write(s)
    })
    child.on('error', err => {
      clearTimeout(t)
      resolveP({ code: 127, stdout, stderr: stderr + `\n[spawn error: ${err.message}]` })
    })
    child.on('close', code => {
      clearTimeout(t)
      resolveP({ code: code ?? 1, stdout, stderr })
    })
  })
}

async function collectChangedFiles() {
  const sets = new Set()
  // Committed diff vs base (only if base resolves; else fall back to HEAD~1 or empty)
  const baseOk = (await runCmd(`git rev-parse --verify --quiet "${BASE}"`)).code === 0
  if (baseOk) {
    const r = await runCmd(`git diff --name-only --diff-filter=ACMR "${BASE}...HEAD"`)
    if (r.code === 0) r.stdout.split(/\r?\n/).forEach(l => l && sets.add(l))
  } else {
    log(`base "${BASE}" not resolvable; skipping committed-diff collection`)
  }
  // Uncommitted (working tree vs index) and index vs HEAD
  const wtree = await runCmd('git diff --name-only --diff-filter=ACMR HEAD')
  if (wtree.code === 0) wtree.stdout.split(/\r?\n/).forEach(l => l && sets.add(l))
  // Untracked (new files not yet added)
  const untrack = await runCmd('git ls-files -o --exclude-standard')
  if (untrack.code === 0) untrack.stdout.split(/\r?\n/).forEach(l => l && sets.add(l))
  return [...sets].map(norm).sort()
}

function classifyChanged(files) {
  const ts = []
  const tests = []
  const python = []
  const r = []
  const prisma = []
  const other = []
  for (const f of files) {
    if (/\.(test|spec)\.(ts|tsx)$/.test(f)) tests.push(f)
    else if (/\.(ts|tsx)$/.test(f) && f.startsWith('src/')) ts.push(f)
    else if (f.startsWith('python-service/')) python.push(f)
    else if (f.startsWith('r-service/')) r.push(f)
    else if (f === 'prisma/schema.prisma') prisma.push(f)
    else other.push(f)
  }
  return { ts, tests, python, r, prisma, other }
}

function resolveTestFiles(srcFiles, changedTests) {
  const out = new Set(changedTests.filter(t => existsSync(absPath(t))))
  for (const f of srcFiles) {
    const rel = f.replace(/^src\//, '').replace(/\.(ts|tsx)$/, '')
    const stems = new Set([rel])
    if (rel.startsWith('app/api/')) {
      stems.add(rel.replace(/^app\//, ''))           // api/<rest>
      stems.add(rel.replace(/^app\/api\//, 'api/'))  // api/<rest> (alt)
    }
    for (const stem of stems) {
      for (const root of ['tests/unit', 'tests/integration', 'tests/components', 'tests/api', 'tests/performance', 'tests/benchmark', 'tests/e2e']) {
        for (const ext of ['.test.ts', '.test.tsx']) {
          const p = `${root}/${stem}${ext}`
          if (existsSync(absPath(p))) out.add(p)
        }
        // subdir style: src/foo/bar/index.ts → tests/unit/foo/bar/*.test.ts
        const subdir = `${root}/${stem}`
        if (existsSync(absPath(subdir))) {
          for (const child of safeReaddir(absPath(subdir))) {
            if (/\.test\.(ts|tsx)$/.test(child)) out.add(`${subdir}/${child}`)
          }
        }
      }
    }
  }
  return [...out].sort()
}

function safeReaddir(p) {
  try {
    if (!statSync(p).isDirectory()) return []
    return readdirSync(p)
  } catch {
    return []
  }
}

async function runTypecheckFiltered(changedSet) {
  log('typecheck: pnpm exec tsc --noEmit (whole repo, errors filtered to changed files)')
  const r = await runCmd(`${PNPM} exec tsc --noEmit --pretty false`)
  const lines = (r.stdout + '\n' + r.stderr).split(/\r?\n/)
  const errRe = /^(.+?\.tsx?)\((\d+),(\d+)\): (error|warning) TS(\d+):/
  const allErrors = []
  const relevant = []
  for (const line of lines) {
    const m = line.match(errRe)
    if (!m) continue
    allErrors.push(line)
    const path = norm(m[1])
    // strip any leading "./" or absolute prefix
    const rel = path.replace(/^.*?\/?(?=src\/|tests\/|prisma\/|scripts\/)/, '')
    if (changedSet.has(rel) || changedSet.has(path)) relevant.push(line)
  }
  const ok = relevant.length === 0
  log(`typecheck: total errors=${allErrors.length}, relevant to diff=${relevant.length}`)
  if (!ok) {
    log('--- relevant typecheck errors ---')
    relevant.slice(0, 50).forEach(l => log('  ' + l))
  }
  return {
    name: 'typecheck',
    ok,
    totalErrors: allErrors.length,
    relevantErrors: relevant.length,
    sample: relevant.slice(0, 20),
    rawExit: r.code,
  }
}

async function runEslint(files) {
  log(`eslint: ${files.length} files`)
  const quoted = files.map(f => `"${f}"`).join(' ')
  const r = await runCmd(`${PNPM} exec eslint --max-warnings=0 ${quoted}`)
  return {
    name: 'eslint',
    ok: r.code === 0,
    rawExit: r.code,
    tail: tail(r.stdout + r.stderr, 60),
    files,
  }
}

async function runVitest(testFiles) {
  log(`vitest: ${testFiles.length} resolved test files`)
  if (VERBOSE) testFiles.forEach(t => log('  → ' + t))
  const quoted = testFiles.map(f => `"${f}"`).join(' ')
  const r = await runCmd(`${PNPM} exec vitest run ${quoted}`)
  return {
    name: 'vitest',
    ok: r.code === 0,
    rawExit: r.code,
    tail: tail(r.stdout + r.stderr, 80),
    resolved: testFiles,
  }
}

async function runPytestSubset(pythonFiles) {
  const subdirs = new Set()
  for (const f of pythonFiles) {
    const m = f.match(/^python-service\/(?:tests|app)\/?([^\/]*)/)
    if (m) subdirs.add(m[1] || '')
  }
  log(`pytest: python-service (changed paths: ${pythonFiles.length})`)
  const r = await runCmd('cd python-service && python -m pytest -q tests')
  return {
    name: 'pytest',
    ok: r.code === 0 || r.code === 5, // 5 = no tests collected (allow)
    rawExit: r.code,
    tail: tail(r.stdout + r.stderr, 80),
  }
}

async function runPrismaValidate() {
  log('prisma: pnpm exec prisma validate')
  const r = await runCmd(`${PNPM} exec prisma validate`)
  return {
    name: 'prisma-validate',
    ok: r.code === 0,
    rawExit: r.code,
    tail: tail(r.stdout + r.stderr, 40),
  }
}

function tail(text, n) {
  const lines = text.split(/\r?\n/)
  return lines.slice(-n).join('\n')
}

function emitSummary() {
  const json = JSON.stringify(summary, null, 2)
  process.stdout.write('\n===== AUTOPM VERIFY SUMMARY =====\n' + json + '\n=================================\n')
}
