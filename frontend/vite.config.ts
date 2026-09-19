import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultExclude, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // DashboardPage.empty needs a wiped database: run it explicitly after a
    // wipe (see Phase 2 report), not as part of the default suite.
    exclude: [...defaultExclude, '**/*.empty.test.tsx'],
    // One file at a time: tests share a single local backend, and parallel
    // files starve it (flaky timeouts). Serial is slower but deterministic.
    fileParallelism: false,
    // Live-backend integration tests: allow slow fetches/debounce/backoff.
    testTimeout: 20000,
  },
})
