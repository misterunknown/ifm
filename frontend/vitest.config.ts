import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Unit tests + coverage (>80% on every metric) for the Vue 3 frontend.
// `npm test` runs the suite, `npm run coverage` adds the coverage report
// and enforces the thresholds below.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,vue}'],
      // types-only modules contain no executable code
      exclude: ['src/vite-env.d.ts', 'src/**/*.d.ts', 'src/ace-types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
