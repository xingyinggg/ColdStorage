// playwright.config.js
import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

// E2E tests use mocked API responses and don't need a real server
export default defineConfig({
  testDir: "tests/e2e",
  reporter: [["html", { open: "never" }], ["github"], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    video: "on",
    screenshot: "on",
    trace: "on",
  },
  // Start Next.js and backend server before running tests
  webServer: {
    command: isCI ? "npm run start:all" : "npm run dev:all",
    url: "http://localhost:3000",
    timeout: isCI ? 240000 : 120000,
    reuseExistingServer: !isCI,
  },
});