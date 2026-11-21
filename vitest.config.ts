import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  // Tests transpile JSX themselves (the app's tsconfig uses "preserve" for Next).
  esbuild: { jsx: 'automatic' },
  css: { modules: { classNameStrategy: 'non-scoped' } },
  test: { environment: 'node', include: ['tests/**/*.test.{ts,tsx}'] },
})
