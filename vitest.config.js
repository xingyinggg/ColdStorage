// vitest.config.js
// filepath: c:\Users\user\ColdStorage\vitest.config.js
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // Load environment variables from .env.local for tests
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      environment: "node",
      // Include both unit and integration tests
      include: [
        "tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        "tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
        "__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}",
      ],
      // Ignore CSS and frontend files for backend testing
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/app/**", // Skip Next.js frontend
        "**/components/**", // Skip React components
      ],
      // Set environment variables for tests (loads from .env.local)
      env: {
        ...env,
        NODE_ENV: mode === "test" ? "test" : "development",
      },
      // Longer timeouts for integration tests
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
    // Completely disable CSS processing for backend tests
    css: false,
    // Don't process PostCSS
    postcss: false,
    // Don't process frontend files
    esbuild: {
      target: "node18",
    },
    // Ignore CSS imports in tests
    define: {
      "import.meta.env.CSS": "false",
    },
    // Don't try to resolve CSS modules
    resolve: {
      alias: {
        // Mock CSS imports to prevent PostCSS errors
        "\\.(css|less|scss|sass)$": "identity-obj-proxy",
      },
    },
  };
});
