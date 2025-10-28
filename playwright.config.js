// playwright.config.js
import { defineConfig } from "@playwright/test";

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
    command: "npm run dev:all", // or 'npm run start' if you build first
    url: "http://localhost:3000",
    timeout: 120000,
    reuseExistingServer: true,
  },
});
