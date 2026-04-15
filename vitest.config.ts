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
    exclude: ['node_modules/**', 'dist/**', '.next/**', 'tests/e2e/**'],
    testTimeout: 30000,
    hookTimeout: 10000,
    fileParallelism: !process.env.CI,
    maxConcurrency: process.env.CI ? 2 : 5,
    setupFiles: ['./tests/setup.ts'],
    retry: process.env.CI ? 1 : 0,
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
