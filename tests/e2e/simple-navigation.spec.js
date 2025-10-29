// tests/e2e/simple-navigation.spec.js
// Simple E2E tests that work reliably
import { test, expect } from "./auth-fixture.js";

test.describe("Simple Navigation Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Mock ALL endpoints that pages might need
    
    // Mock tasks endpoint
    await page.route(/http:\/\/localhost:4000\/tasks(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tasks: [
            {
              id: "task-1",
              title: "Test Task",
              status: "ongoing",
              priority: 5,
              owner_id: "E2E001",
              due_date: "2025-12-31T00:00:00Z",
            },
          ],
        }),
      });
    });

    // Mock users/bulk endpoint
    await page.route(/http:\/\/localhost:4000\/users\/bulk$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ emp_id: "E2E001", name: "E2E Tester" }]),
      });
    });

    // Mock projects endpoint
    await page.route(/http:\/\/localhost:4000\/projects(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });

    // Mock notifications endpoint
    await page.route(/http:\/\/localhost:4000\/notifications(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [] }),
      });
    });

    // Mock users endpoint (for fetching staff)
    await page.route(/http:\/\/localhost:4000\/users(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ users: [] }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test("should display user name in header", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Wait for sidebar to be visible (sidebar always loads)
    await page.waitForSelector('a[href="/dashboard"]', { timeout: 15000 });

    // Check for user name anywhere on page (should appear in header once loaded)
    const userName = page.getByText("E2E Tester");
    await userName.waitFor({ state: "visible", timeout: 10000 });

    console.log("✅ User name displayed");
  });

  test("should navigate to tasks page", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Find and click tasks link in sidebar using href (sidebar loads faster than main content)
    const tasksLink = page.locator('a[href="/dashboard/tasks"]').first();
    await tasksLink.waitFor({ state: "visible", timeout: 15000 });
    await tasksLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/dashboard\/tasks/, { timeout: 10000 });

    console.log("✅ Navigated to tasks page");
  });

  test("should navigate to projects page", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Click projects link (sidebar loads faster than main content)
    const projectsLink = page.locator('a[href="/projects"]').first();
    await projectsLink.waitFor({ state: "visible", timeout: 15000 });
    await projectsLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });

    console.log("✅ Navigated to projects page");
  });

  test("should navigate to schedule page", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Click schedule link (sidebar loads faster than main content)
    const scheduleLink = page.locator('a[href="/schedule"]').first();
    await scheduleLink.waitFor({ state: "visible", timeout: 15000 });
    await scheduleLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/schedule/, { timeout: 10000 });

    console.log("✅ Navigated to schedule page");
  });

  test("should navigate to notifications page", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Click notifications link (sidebar loads faster than main content)
    const notificationsLink = page.locator('a[href="/notifications"]').first();
    await notificationsLink.waitFor({ state: "visible", timeout: 15000 });
    await notificationsLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/notifications/, { timeout: 10000 });

    console.log("✅ Navigated to notifications page");
  });

  test("should show sidebar navigation", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Wait for page to load
    await page.waitForSelector('nav, aside, [role="navigation"]', { timeout: 15000 });

    // Verify sidebar links exist by href (more reliable than role/name)
    await expect(page.locator('a[href="/dashboard"]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/dashboard/tasks"]').first()).toBeVisible();
    await expect(page.locator('a[href="/projects"]').first()).toBeVisible();
    await expect(page.locator('a[href="/schedule"]').first()).toBeVisible();

    console.log("✅ Sidebar navigation displayed");
  });
});

