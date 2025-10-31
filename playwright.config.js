// playwright.config.js
import { defineConfig } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    video: "on",
    screenshot: "on",
    trace: "on",
  },
  // start your Next.js dev or prod server
  webServer: {
    command: isCI ? "npm run start:all" : "npm run dev:all",
    url: "http://localhost:3000",
    timeout: isCI ? 240000 : 120000,
    reuseExistingServer: !isCI,
  },
});

/* istanbul ignore next */
export default defineConfig(config);