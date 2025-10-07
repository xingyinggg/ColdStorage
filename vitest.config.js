// vitest.config.js
// filepath: c:\Users\user\ColdStorage\vitest.config.js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Ignore CSS and frontend files for backend testing
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/app/**', // Skip Next.js frontend
      '**/components/**', // Skip React components
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        functions: 80,
        branches: 80,
        statements: 90
      }
    }
  },
  // Disable CSS processing for backend tests
  css: false,
  // Don't process frontend files
  esbuild: {
    target: 'node18'
  }
});