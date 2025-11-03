// tests/e2e/tasks/edit-task.spec.js
import { test, expect } from "../auth-fixture.js";

test.describe("Task Editing Flow", () => {
  // Mock task data - function to create fresh copy for each test
  const createMockTask = () => ({
    id: "task-edit-123",
    title: "Original Task Title",
    description: "Original description",
    priority: 5,
    status: "ongoing",
    due_date: "2025-12-31T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
  });

  let mockTask;

  test.beforeEach(async ({ page }) => {
    // Create fresh mock task for each test
    mockTask = createMockTask();

    // Mock GET tasks - return our test task (backend on port 4000)
    await page.route("**/tasks*", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ tasks: [mockTask] }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock PUT /tasks/:id - task update
    await page.route("**/tasks/*", async (route) => {
      if (route.request().method() === "PUT") {
        const taskId = route.request().url().split("/").pop();
        const updates = JSON.parse(route.request().postData());

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockTask,
            ...updates,
            id: taskId,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock GET /users/bulk
    await page.route("**/users/bulk*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { emp_id: "E2E001", name: "E2E Tester" },
        ]),
      });
    });

    // Mock GET /projects
    await page.route("**/projects*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });

    // Mock notification endpoints that might be called
    await page.route("**/notifications*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ notifications: [] }),
      });
    });
  });

  test("should open task edit modal from dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for tasks to load - look for the task heading
    await expect(page.getByRole("heading", { name: "Original Task Title" })).toBeVisible({ timeout: 15000 });

    // Click the Edit button on the task card
    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    // Verify edit modal opens
    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Verify form is pre-populated - find fields by their position/value in the modal
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toHaveValue("Original Task Title");

    const descriptionTextarea = page.locator('textarea').first();
    await expect(descriptionTextarea).toHaveValue("Original description");

    console.log("✅ Task edit modal opened with pre-populated data");
  });
});

