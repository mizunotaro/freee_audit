#!/usr/bin/env node
// test-quality-report.mjs — assertion-strength auditor for the coverage-gap (cov-*) test wave.
//
// Anti-inflation scan: finds test files that lift coverage numbers without genuinely
// asserting behavior. Flags, per `it`/`test`:
//   - assertion-free      : runs but calls `expect(...)` zero times (pure fake-green)
//   - weak-truthiness (A) : every matcher is toBeDefined/toBeTruthy — the classic lazy
//                           "it exists / it rendered" check that asserts no content.
//                           HIGH-confidence inflation suspect (the pattern named in scope).
//   - weak-nullish   (B)  : every matcher is toBeNull/toBeUndefined/toBeFalsy. Often the
//                           CORRECT assertion (e.g. a deliberate cache-miss return) —
//                           LOW confidence; surfaced for human judgment, scored lightly.
//   - snapshot-only       : every matcher is a snapshot matcher (toMatch(Snapshot|...))
//   - disabled            : skipped/todo/x-prefixed (contributes no runtime coverage)
//
// Dep-free: Node >= 20 builtins only. Scope is derived from git by default (the set of
// test files ADDED by cov-* merge PRs), or supplied explicitly via args.
//
// Usage:
//   node scripts/test-quality-report.mjs                  # scan the cov-* wave (git-derived)
//   node scripts/test-quality-report.mjs --json           # machine-readable output
//   node scripts/test-quality-report.mjs -n 30            # show top-30 weakest files
//   node scripts/test-quality-report.mjs path/a.test.ts path/b.test.ts   # explicit files
//   node scripts/test-quality-report.mjs --from-list files.txt           # newline-separated
//
// Exit codes: 0 = report produced (weak tests found is NOT a failure — it is the point);
//             1 = no test files resolved to scan; 2 = infrastructure error (git unavailable).

import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Weak-matcher vocabulary
// Tier A (high-confidence inflation): "it exists" assertions that check no content.
const WEAK_TRUTHY = new Set(['toBeDefined', 'toBeTruthy'])
// Tier B (low-confidence): nullish assertions — frequently the correct expectation.
const WEAK_NULLISH = new Set(['toBeNull', 'toBeUndefined', 'toBeFalsy'])
const WEAK_MATCHERS = new Set([...WEAK_TRUTHY, ...WEAK_NULLISH])
const SNAPSHOT_MATCHERS = new Set([
  'toMatchSnapshot',
  'toMatchInlineSnapshot',
  'toThrowErrorMatchingSnapshot',
  'toMatchFileSnapshot',
])

// ---------------------------------------------------------------------------
// Source preprocessing: replace comment and string/template-literal *contents*
// with spaces (length- and newline-preserving) so structural scanning sees real
// code while keywords inside strings/comments never inflate counts.
// ---------------------------------------------------------------------------
function stripCommentsAndStrings(src) {
  let out = ''
  const n = src.length
  let i = 0
  let state = 'code' // code | line | block | sq | dq | tmpl
  while (i < n) {
    const c = src[i]
    const c2 = src[i + 1]
    if (state === 'code') {
      if (c === '/' && c2 === '/') {
        state = 'line'; out += '  '; i += 2; continue
      }
      if (c === '/' && c2 === '*') {
        state = 'block'; out += '  '; i += 2; continue
      }
      if (c === "'") { state = 'sq'; out += ' '; i++; continue }
      if (c === '"') { state = 'dq'; out += ' '; i++; continue }
      if (c === '`') { state = 'tmpl'; out += ' '; i++; continue }
      out += c; i++; continue
    }
    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += '\n' } else { out += ' ' }
      i++; continue
    }
    if (state === 'block') {
      if (c === '*' && c2 === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? '\n' : ' '; i++; continue
    }
    // sq | dq | tmpl share escape + terminator logic
    if (c === '\\') { out += '  '; i += 2; continue }
    if (
      (state === 'sq' && c === "'") ||
      (state === 'dq' && c === '"') ||
      (state === 'tmpl' && c === '`')
    ) {
      state = 'code'; out += ' '; i++; continue
    }
    out += c === '\n' ? '\n' : ' '; i++; continue
  }
  return out
}

// Given index of '(' return index of matching ')', else -1.
function matchParen(s, openIdx, end) {
  let depth = 0
  for (let i = openIdx; i < end; i++) {
    const ch = s[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

// Count `expect(...)` assertion calls in [start,end) and collect their matcher names.
// Skips `expect.assertions`/`expect.hasAssertions` (no '(' right after `expect`) and
// `expect.objectContaining(...)` helper calls (a '.', not '(', follows `expect`).
function analyzeExpectsInRange(s, start, end) {
  let count = 0
  const matchers = []
  let i = start
  while (i < end) {
    const idx = s.indexOf('expect', i)
    if (idx === -1 || idx >= end) break
    const prev = idx > 0 ? s[idx - 1] : ''
    if (/\w/.test(prev)) { i = idx + 6; continue }
    let j = idx + 6
    while (j < end && /\s/.test(s[j])) j++
    if (s[j] !== '(') { i = idx + 6; continue } // expect.foo helpers / part of a longer word
    const close = matchParen(s, j, end)
    if (close === -1) { i = idx + 6; continue }
    count++
    let k = close + 1
    let negated = false
    let safety = 0
    while (k < end && safety++ < 8) {
      while (k < end && /\s/.test(s[k])) k++
      if (s[k] !== '.') break
      k++
      while (k < end && /\s/.test(s[k])) k++
      let m = k
      while (m < end && /[\w$]/.test(s[m])) m++
      const name = s.slice(k, m)
      k = m
      while (k < end && /\s/.test(s[k])) k++
      if (name === 'not') { negated = !negated; continue }
      if (name === 'resolves' || name === 'rejects') continue
      if (s[k] === '(') matchers.push({ name, negated })
      break
    }
    i = close + 1
  }
  return { count, matchers }
}

const TEST_ENTRY = /(^|[^\w.])(it|test|xit|xtest|fit|ftest)\b/g

// Parse a single test entry starting at token keyword index `kwIdx`.
// Returns { disabled, focused, eachMode, callOpen, callClose } or null if not a real test call.
function parseTestEntry(s, kwIdx, kw, end) {
  let disabled = false
  let focused = false
  let eachMode = false
  let p = kwIdx + kw.length
  // optional modifier chain: .skip / .todo / .only / .concurrent / .each(...)
  if (kw === 'xit' || kw === 'xtest') disabled = true
  if (kw === 'fit' || kw === 'ftest') focused = true
  let guard = 0
  while (p < end && guard++ < 12) {
    while (p < end && /\s/.test(s[p])) p++
    if (s[p] !== '.') break
    p++
    while (p < end && /\s/.test(s[p])) p++
    let m = p
    while (m < end && /[\w$]/.test(s[m])) m++
    const mod = s.slice(p, m)
    p = m
    if (mod === 'each') {
      while (p < end && /\s/.test(s[p])) p++
      if (s[p] !== '(') break
      const tableClose = matchParen(s, p, end)
      if (tableClose === -1) return null
      p = tableClose + 1
      eachMode = true
      continue
    }
    if (mod === 'skip' || mod === 'todo') disabled = true
    else if (mod === 'only') focused = true
    else if (mod === 'concurrent') { /* not disabled */ }
    else break
  }
  while (p < end && /\s/.test(s[p])) p++
  if (s[p] !== '(') return null
  const callOpen = p
  const callClose = matchParen(s, callOpen, end)
  if (callClose === -1) return null
  return { disabled, focused, eachMode, callOpen, callClose }
}

// "presence" assertions: positive truthy/defined, OR negated nullish (e.g. not.toBeNull).
// Both assert "something is there" without validating content.
function isPresence(m) {
  if (WEAK_TRUTHY.has(m.name) && !m.negated) return true
  if (WEAK_NULLISH.has(m.name) && m.negated) return true
  return false
}
function isPositiveNullish(m) {
  return WEAK_NULLISH.has(m.name) && !m.negated
}

function classifyTest({ count, matchers }) {
  if (count === 0) return 'assertion-free'
  if (matchers.length > 0 && matchers.every((m) => SNAPSHOT_MATCHERS.has(m.name))) return 'snapshot-only'
  // A test whose only matchers assert presence (truthy / not-nullish) checks no content.
  if (matchers.length > 0 && matchers.every(isPresence)) return 'weak-truthiness'
  // Positive nullish (toBeNull/toBeUndefined/toBeFalsy) usually asserts a deliberate
  // null/undefined return — frequently the correct expectation.
  if (matchers.length > 0 && matchers.every(isPositiveNullish)) return 'weak-nullish'
  return 'strong'
}

function lineOf(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

function extractName(originalSpan) {
  const m = originalSpan.match(/\(\s*(['"`])([\s\S]*?)\1/)
  if (!m) return null
  const name = m[2].replace(/\s+/g, ' ').trim()
  return name.length > 64 ? name.slice(0, 61) + '...' : name
}

function analyzeFile(filePath) {
  const original = readFileSync(filePath, 'utf8')
  const stripped = stripCommentsAndStrings(original)
  const end = stripped.length
  const tests = []
  let m
  TEST_ENTRY.lastIndex = 0
  while ((m = TEST_ENTRY.exec(stripped)) !== null) {
    const kw = m[2]
    const kwIdx = m.index + m[1].length
    const parsed = parseTestEntry(stripped, kwIdx, kw, end)
    if (!parsed) continue
    const { disabled, focused, eachMode, callOpen, callClose } = parsed
    const line = lineOf(original, callOpen)
    const name = extractName(original.slice(callOpen, callClose + 1))
    if (disabled) {
      tests.push({ kind: 'it/test', disabled: true, focused, eachMode, line, name, expectCount: 0, matchers: [], classification: 'disabled' })
      continue
    }
    const { count, matchers } = analyzeExpectsInRange(stripped, callOpen, callClose + 1)
    tests.push({
      kind: 'it/test',
      disabled: false,
      focused,
      eachMode,
      line,
      name,
      expectCount: count,
      matchers,
      classification: classifyTest({ count, matchers }),
    })
  }
  return summarize(filePath, tests)
}

function summarize(filePath, tests) {
  const total = tests.length
  const disabled = tests.filter((t) => t.disabled).length
  const active = tests.filter((t) => !t.disabled)
  const buckets = {
    'assertion-free': 0,
    'weak-truthiness': 0,
    'weak-nullish': 0,
    'snapshot-only': 0,
    strong: 0,
  }
  let totalExpects = 0
  let weakMatcherUses = 0
  for (const t of active) {
    buckets[t.classification]++
    totalExpects += t.expectCount
    weakMatcherUses += t.matchers.filter((x) => WEAK_MATCHERS.has(x.name)).length
  }
  const score =
    buckets['assertion-free'] * 4 +
    buckets['weak-truthiness'] * 3 +
    buckets['snapshot-only'] * 2 +
    buckets['weak-nullish'] * 1 +
    disabled * 2
  return {
    file: filePath,
    totalTests: total,
    activeTests: active.length,
    disabled,
    totalExpects,
    weakMatcherUses,
    buckets,
    score,
    flagged: active
      .filter((t) => t.classification !== 'strong')
      .map((t) => ({
        line: t.line,
        name: t.name,
        classification: t.classification,
        expectCount: t.expectCount,
        matchers: t.matchers.map((m) => `${m.negated ? 'not.' : ''}${m.name}`),
      })),
  }
}

// ---------------------------------------------------------------------------
// Scope resolution: default = test files ADDED by cov-* merge PRs (the "gap wave").
// ---------------------------------------------------------------------------
function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8', cwd: process.cwd() })
  if (r.status !== 0) return null
  return r.stdout
}

function discoverCovWaveFiles() {
  const merges = git([
    'log', '--all', '--merges', '--grep=^Merge pull request .* from .*cov-', '-E',
    '--format=%H',
  ])
  if (merges === null) return { files: [], error: 'git unavailable' }
  const set = new Set()
  for (const sha of merges.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)) {
    const diff = git(['diff', '--name-status', '--diff-filter=A', `${sha}^1`, sha])
    if (diff === null) continue
    for (const line of diff.split(/\r?\n/)) {
      const parts = line.split('\t')
      const path = parts[parts.length - 1]
      if (/\.(test|spec)\.(ts|tsx)$/.test(path) && existsSync(resolve(path))) set.add(path)
    }
  }
  return { files: [...set].sort(), error: null }
}

function parseArgs(argv) {
  const out = { json: false, topN: 1000, files: [], fromList: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--json') out.json = true
    else if (a === '-n' || a === '--top') out.topN = parseInt(argv[++i], 10) || 1000
    else if (a === '--from-list') out.fromList = argv[++i]
    else if (!a.startsWith('-')) out.files.push(a)
  }
  return out
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  let files = args.files.slice()
  let scopeSource = 'explicit (argv)'
  if (files.length === 0 && args.fromList) {
    files = readFileSync(args.fromList, 'utf8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    scopeSource = `--from-list ${args.fromList}`
  }
  if (files.length === 0) {
    const { files: discovered, error } = discoverCovWaveFiles()
    if (error) {
      console.error(`[test-quality-report] infrastructure error: ${error}`)
      process.exit(2)
    }
    files = discovered
    scopeSource = 'git: cov-* merge PRs (coverage-gap wave)'
  }
  files = files.filter((f) => existsSync(resolve(f)))
  if (files.length === 0) {
    console.error('[test-quality-report] no test files resolved to scan')
    process.exit(1)
  }

  const results = files.map(analyzeFile)
  results.sort(
    (a, b) =>
      b.score - a.score ||
      b.buckets['assertion-free'] + b.buckets['weak-existence'] - (a.buckets['assertion-free'] + a.buckets['weak-existence']) ||
      a.file.localeCompare(b.file)
  )

  const totals = results.reduce(
    (acc, r) => {
      acc.files++
      acc.tests += r.totalTests
      acc.expects += r.totalExpects
      acc.assertionFree += r.buckets['assertion-free']
      acc.weakTruthy += r.buckets['weak-truthiness']
      acc.weakNullish += r.buckets['weak-nullish']
      acc.snapshotOnly += r.buckets['snapshot-only']
      acc.disabled += r.disabled
      acc.weakMatcherUses += r.weakMatcherUses
      return acc
    },
    { files: 0, tests: 0, expects: 0, assertionFree: 0, weakTruthy: 0, weakNullish: 0, snapshotOnly: 0, disabled: 0, weakMatcherUses: 0 }
  )

  if (args.json) {
    process.stdout.write(JSON.stringify({ scopeSource, totals, results: results.slice(0, args.topN) }, null, 2) + '\n')
    return
  }

  const ranked = results.slice(0, args.topN)
  process.stdout.write(`\nTEST-QUALITY REPORT — assertion-strength audit (anti-inflation)\n`)
  process.stdout.write(`scope: ${scopeSource}\n`)
  process.stdout.write(`files scanned: ${totals.files} | tests: ${totals.tests} | expects: ${totals.expects}\n`)
  process.stdout.write(
    `flagged: assertion-free=${totals.assertionFree}  weak-truthy(A)=${totals.weakTruthy}  weak-nullish(B)=${totals.weakNullish}  snapshot-only=${totals.snapshotOnly}  disabled=${totals.disabled}\n`
  )
  process.stdout.write(`weak-matcher uses total (toBeDefined/toBeTruthy/toBeNull/…): ${totals.weakMatcherUses}\n\n`)

  process.stdout.write('WEAKEST FILES (score = 4*assertion-free + 3*weak-truthy(A) + 2*snapshot-only + 1*weak-nullish(B) + 2*disabled)\n')
  process.stdout.write('-'.repeat(118) + '\n')
  process.stdout.write(
    `${'score'.padEnd(6)}${'aFree'.padEnd(6)}${'wtA'.padEnd(5)}${'wnB'.padEnd(5)}${'snap'.padEnd(5)}${'dis'.padEnd(5)}${'tests'.padEnd(7)}${'exps'.padEnd(7)}file\n`
  )
  for (const r of ranked) {
    process.stdout.write(
      `${String(r.score).padEnd(6)}` +
        `${String(r.buckets['assertion-free']).padEnd(6)}` +
        `${String(r.buckets['weak-truthiness']).padEnd(5)}` +
        `${String(r.buckets['weak-nullish']).padEnd(5)}` +
        `${String(r.buckets['snapshot-only']).padEnd(5)}` +
        `${String(r.disabled).padEnd(5)}` +
        `${String(r.totalTests).padEnd(7)}` +
        `${String(r.totalExpects).padEnd(7)}${r.file}\n`
    )
  }
  process.stdout.write('\n')

  const flaggedTests = ranked.filter((r) => r.flagged.length > 0)
  if (flaggedTests.length > 0) {
    process.stdout.write('FLAGGED TESTS (concrete targets to strengthen)\n')
    process.stdout.write('-'.repeat(110) + '\n')
    for (const r of flaggedTests) {
      process.stdout.write(`\n${r.file}\n`)
      for (const t of r.flagged) {
        const where = `  L${String(t.line).padEnd(5)}`
        const cls = `[${t.classification}]`.padEnd(20)
        const exp = `expects=${t.expectCount}`.padEnd(16)
        const m = t.matchers.length ? `matchers=[${t.matchers.join(',')}]` : 'matchers=[]'
        const nm = t.name ? `  ${t.name}` : ''
        process.stdout.write(`${where}${cls}${exp}${m}${nm}\n`)
      }
    }
    process.stdout.write('\n')
  }

  process.stdout.write('CLEAN FILES (score 0 — every active test is strong)\n')
  process.stdout.write('-'.repeat(110) + '\n')
  const clean = results.filter((r) => r.score === 0)
  for (const r of clean) process.stdout.write(`  ${r.file}\n`)
  if (clean.length === 0) process.stdout.write('  (none)\n')
  process.stdout.write('\n')
}

main()
