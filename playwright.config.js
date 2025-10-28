// playwright.config.js
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  // start your Next.js dev or prod server
  webServer: {
    command: "npm run dev:all", // or 'npm run start' if you build first
    url: "http://localhost:3000",
    timeout: 120000,
    reuseExistingServer: true,
  },
});
