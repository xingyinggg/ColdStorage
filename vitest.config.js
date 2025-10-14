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
      // Default values used by all projects unless overridden
      env: {
        ...env,
        NODE_ENV: mode === "test" ? "test" : "development",
      },
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 30000,
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        thresholds: {
          lines: 90,
          functions: 80,
          branches: 80,
          statements: 90,
        },
      },
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
          include: [
            "tests/unit/**/*.{test,spec}.{jsx,tsx}",
          ],
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
