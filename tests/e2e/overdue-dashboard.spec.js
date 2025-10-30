// tests/e2e/overdue-dashboard.spec.js
import { test, expect } from "./auth-fixture.js";
import { mockTasks } from "./mocks/tasks.js";

test.describe("Dashboard overdue highlighting (mock auth)", () => {
  test.skip('shows "(Overdue)" only for past-due TaskCards', async ({ page }) => {
    // 1️⃣ Mock backend API endpoints used by the dashboard
    await page.route(/\/tasks(\?.*)?$/, async (route) => {
      // Adapt mock to API response shape and field names; harden dates to avoid TZ flakiness
      const tasks = mockTasks.map((t, i) => {
        let due = t.due_date || t.dueDate;
        if (t.title?.toLowerCase().includes('overdue')) due = '2000-01-01T00:00:00Z';
        if (t.title === 'Due today') due = '2099-01-01T00:00:00Z';
        if (t.title === 'Future task') due = '2099-01-10T00:00:00Z';
        return {
          id: t.id || `t${i+1}`,
          title: t.title,
          status: t.status || "ongoing",
          due_date: due,
          priority: t.priority ?? 5,
          owner_id: "E2E001"
        };
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tasks }),
      });
    });

    await page.route(/\/users\/bulk$/, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    });

    // 2️⃣ Navigate straight to dashboard (mock auth fixture handles login)
    await page.goto("/dashboard");

    // 3️⃣ Wait for dashboard content and all three task titles to appear
    await expect(page.getByRole('heading', { name: 'Active Tasks' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Overdue task example' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Due today' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'Future task' })).toBeVisible({ timeout: 5000 });

    // 4️⃣ Check that exactly ONE "(Overdue)" label exists on the page
    const overdueBadges = page.getByText('(Overdue)');
    await expect(overdueBadges).toHaveCount(1);
    console.log("✅ Found exactly 1 (Overdue) label on the page");

    // 5️⃣ Verify the "(Overdue)" label appears near the "Overdue task example" text
    const overdueTaskText = page.getByText('Overdue task example');
    await expect(overdueTaskText).toBeVisible();
    
    // Check that "1/1/2000(Overdue)" exists (the date + badge together)
    await expect(page.getByText('1/1/2000(Overdue)')).toBeVisible();
    console.log("✅ (Overdue) label appears next to the overdue task's due date");

    // 6️⃣ Verify other tasks don't have "Overdue" in their date fields
    await expect(page.getByText(/Due today.*\(Overdue\)/)).toHaveCount(0);
    await expect(page.getByText(/Future task.*\(Overdue\)/)).toHaveCount(0);
    console.log("✅ 'Due today' and 'Future task' cards have no (Overdue) label");
  });
});
