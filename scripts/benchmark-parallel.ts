import { performance } from 'perf_hooks'

async function simulateProcessing(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function serialProcessing(items: number[], delay: number): Promise<number> {
  const start = performance.now()
  for (const _ of items) {
    await simulateProcessing(delay)
  }
  return performance.now() - start
}

async function parallelProcessing(
  items: number[],
  delay: number,
  concurrency: number
): Promise<number> {
  const start = performance.now()

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    await Promise.all(batch.map(() => simulateProcessing(delay)))
  }

  return performance.now() - start
}

async function main() {
  const itemCount = 100
  const delayPerItem = 10
  const concurrency = 5
  const items = Array.from({ length: itemCount }, (_, i) => i)

  console.log(`Testing with ${itemCount} items, ${delayPerItem}ms per item`)
  console.log(`Concurrency: ${concurrency}`)
  console.log()

  console.log('Running serial processing...')
  const serialTime = await serialProcessing(items, delayPerItem)
  console.log(`Serial time: ${serialTime.toFixed(2)}ms`)

  console.log()
  console.log('Running parallel processing...')
  const parallelTime = await parallelProcessing(items, delayPerItem, concurrency)
  console.log(`Parallel time: ${parallelTime.toFixed(2)}ms`)

  console.log()
  const speedup = serialTime / parallelTime
  console.log(`Speedup: ${speedup.toFixed(2)}x`)
  console.log(`Time reduction: ${((1 - parallelTime / serialTime) * 100).toFixed(2)}%`)

  if (speedup >= 3) {
    console.log('\n✅ PASS: Speedup is >= 3x (meets acceptance criteria)')
  } else {
    console.log('\n❌ FAIL: Speedup is < 3x (does not meet acceptance criteria)')
  }
}

main().catch(console.error)
