import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const emptyModulePath = path.resolve(__dirname, './tests/stubs/empty-module.ts')

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/benchmark/**/*.bench.ts'],
    exclude: ['node_modules/**', 'dist/**', '.next/**'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 180000,
    hookTimeout: 180000,
    fileParallelism: false,
    coverage: { enabled: false },
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
