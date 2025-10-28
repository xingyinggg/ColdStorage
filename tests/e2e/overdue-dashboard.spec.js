// tests/e2e/overdue-dashboard.spec.js
import { test, expect } from "./auth-fixture.js";
import { mockTasks } from "./mocks/tasks.js";

test.describe("Dashboard overdue highlighting (mock auth)", () => {
  test('shows "(Overdue)" only for past-due TaskCards', async ({ page }) => {
    // 1️⃣ Mock tasks endpoint — adjust to match your API route
    await page.route("**/api/tasks**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTasks),
      });
    });

    // 2️⃣ Navigate straight to dashboard (mock auth fixture handles login)
    await page.goto("/dashboard");

    // 3️⃣ Wait for any TaskCard to appear
    const anyTaskCard = page.locator("text=Assigned to:");
    await expect(anyTaskCard.first()).toBeVisible({ timeout: 10000 });

    // 4️⃣ Check for the overdue task
    const overdueCard = page.getByText("Overdue task example");
    await expect(overdueCard).toBeVisible();

    // Within that card, find the red “(Overdue)” text
    const overdueBadge = page.locator(
      "span.text-red-500:has-text('(Overdue)')"
    );
    await expect(overdueBadge).toBeVisible({ timeout: 5000 });
    console.log("✅ Found (Overdue) label in overdue TaskCard");

    // 5️⃣ Ensure the “Due today” card has no overdue label
    const todayCard = page.getByText("Due today");
    await expect(todayCard).toBeVisible();
    await expect(
      todayCard.locator("span.text-red-500:has-text('(Overdue)')")
    ).toHaveCount(0);
    console.log("✅ 'Due today' card has no (Overdue) label");

    // 6️⃣ Ensure the “Future task” card has no overdue label
    const futureCard = page.getByText("Future task");
    await expect(futureCard).toBeVisible();
    await expect(
      futureCard.locator("span.text-red-500:has-text('(Overdue)')")
    ).toHaveCount(0);
    console.log("✅ 'Future task' card has no (Overdue) label");
  });
});
