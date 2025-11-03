// vitest.config.js
// filepath: c:\Users\user\ColdStorage\vitest.config.js
import { defineConfig } from "vitest/config";
import path from "node:path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env.local for tests
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      // Global per-test timeout. Some Vitest versions accept `testTimeout`, others read `timeout`.
      // Set both to be compatible with different Vitest releases.
      testTimeout: 30000,
      timeout: 30000,

      // Environment variables for tests
      env: {
        NODE_ENV: "test",
      },

      // Test workspaces - separate unit and integration tests
      workspace: [
        {
          test: {
            name: "unit",
            environment: "node",
            include: ["tests/unit/**/*.{test,spec}.{js,ts}"],
            // No database setup for unit tests
          },
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "html", "json-summary"],
            include: [
              "server/services/**/*.{js,ts}", // Business logic services
              "server/lib/**/*.{js,ts}", // Utility libraries
              "src/utils/**/*.{js,ts}", // Utility functions (excluding hooks)
              "src/supabase/**/*.{js,ts}", // Database utilities
            ],
            exclude: [
              "**/node_modules/**",
              "**/dist/**",
              "**/.next/**",
              "src/app/**/*", // Exclude Next.js pages
              "src/components/**/*", // Exclude React components
              "src/utils/hooks/**/*", // Exclude React hooks
              "src/constants/**/*", // EXCLUDE: UI constants (styling, etc.)
              "src/contexts/**/*", // EXCLUDE: React contexts
              "server/routes/**/*", // EXCLUDE: API route handlers
              "server/index.js", // EXCLUDE: Server entry point
              "middleware.js", // EXCLUDE: Next.js middleware
              "*.config.*", // EXCLUDE: Config files
              "tests/**/*", // EXCLUDE: Test files
              "coverage*/**", // EXCLUDE: Coverage reports
            ],
            thresholds: {
              lines: 70, // Higher threshold for focused unit testing
              branches: 65,
            },
          },
        },
        {
          test: {
            name: "integration",
            environment: "node",
            include: ["tests/integration/**/*.{test,spec}.{js,ts}"],
            // Database setup only for integration tests
            setupFiles: ["tests/integration/setupTests.js"],
            // Longer timeout for integration tests
            testTimeout: 30000,
            timeout: 30000,
          },
          coverage: {
            provider: "v8",
            reporter: ["text", "json", "html", "json-summary"],
            include: [
              "server/routes/**/*.{js,ts}", // API endpoints (main focus)
              "server/index.js", // Server setup
              "server/schemas/**/*.{js,ts}", // Data validation schemas
              "server/services/**/*.{js,ts}", // Services used in API flows
              "server/lib/**/*.{js,ts}", // Libraries used in routes
            ],
            exclude: [
              "**/node_modules/**",
              "**/dist/**",
              "**/.next/**",
              "tests/**/*", // EXCLUDE: Test files
              "coverage*/**", // EXCLUDE: Coverage reports
            ],
            thresholds: {
              lines: 60, // Reasonable for integration testing
              branches: 50,
            },
          },
        },
      ],

      // Test configuration
      environment: "node",
      include: ["tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],

      // Note: per-suite timeouts can override this global value when needed
      setupFiles: ["tests/setupTests.js"],

      // Default values used by all projects unless overridden
      // env: {
      //   ...env,
      //   NODE_ENV: mode === "test" ? "test" : "development",
      // },
      hookTimeout: 30000,
      teardownTimeout: 30000,
    },
    projects: [
      // Backend + integration tests (Node environment)
      {
        test: {
          name: "backend",
          environment: "node",
          setupFiles: ["tests/setupTests.ts"],
          include: [
            "tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
            "tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
          ],
          exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        },
      },
      // UI component tests (happy-dom + RTL)
      {
        test: {
          name: "ui",
          environment: "happy-dom",
          setupFiles: ["tests/setupUI.ts"],
          include: ["tests/unit/**/*.{test,spec}.{jsx,tsx}"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
        },
      },
    ],
    // Completely disable CSS processing for backend tests
    css: false,
    // Don't process PostCSS
    postcss: false,
    // Don't process frontend files
    esbuild: {
      target: "node18",
      jsx: "automatic",
      jsxImportSource: "react",
    },
    // Ignore CSS imports in tests
    define: {
      "import.meta.env.CSS": "false",
    },
    // Don't try to resolve CSS modules
    resolve: {
      alias: {
        "@": path.resolve(process.cwd(), "src"),
        // Mock CSS imports to prevent PostCSS errors
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
    },
  };
});
