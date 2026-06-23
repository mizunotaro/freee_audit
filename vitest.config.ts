import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const emptyModulePath = path.resolve(__dirname, './tests/stubs/empty-module.ts')

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
      // Quarantined: these two test files exhaust V8's heap (>5 GB each) and
      // crash the worker even when each is the only file in a 64-way shard.
      // Heap-usage logging confirms both grow unbounded after the first few
      // tests. Tracked in BACKLOG / Phase 1 — must be diagnosed and re-enabled
      // before promoting `Unit Tests` to the strict required-checks set.
      'tests/unit/app/(dashboard)/analysis/hooks/use-analysis.test.ts',
      'tests/unit/services/conversion/conversion-engine.test.ts',
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.new.ts',
        'src/types/**',
        'src/config/**',
        'src/app/**/layout.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/error.tsx',
        'src/components/ui/**',
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 45,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@google-cloud/secret-manager': emptyModulePath,
      '@aws-sdk/client-secrets-manager': emptyModulePath,
      '@azure/identity': emptyModulePath,
      '@azure/keyvault-secrets': emptyModulePath,
    },
  },
})
