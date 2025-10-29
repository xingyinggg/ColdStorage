// tests/e2e/tasks/edit-task.spec.js
import { test, expect } from "../auth-fixture.js";

test.describe("Task Editing Flow", () => {
  // Mock task data
  const mockTask = {
    id: "task-edit-123",
    title: "Original Task Title",
    description: "Original description",
    priority: 5,
    status: "ongoing",
    due_date: "2025-12-31T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
  };

  test.beforeEach(async ({ page }) => {
    // Mock GET tasks - return our test task
    await page.route(/\/tasks(\?.*)?$/, async (route) => {
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
    await page.route(/\/tasks\/[^/]+$/, async (route) => {
      if (route.request().method() === "PUT") {
        const taskId = route.request().url().split("/").pop();
        const updates = await route.request().postDataJSON?.();

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

    await page.route(/\/users\/bulk$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { emp_id: "E2E001", name: "E2E Tester" },
        ]),
      });
    });

    await page.route(/\/projects(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ projects: [] }),
      });
    });
  });

  test("should open task edit modal from dashboard", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for tasks to load
    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    // Click the Edit button on the task card
    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    // Verify edit modal opens
    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Verify form is pre-populated
    await expect(page.locator('input[name="title"]')).toHaveValue(
      "Original Task Title"
    );
    await expect(page.locator('textarea[name="description"]')).toHaveValue(
      "Original description"
    );

    console.log("✅ Task edit modal opened with pre-populated data");
  });

  test("should update task title successfully", async ({ page }) => {
    await page.goto("/dashboard");

    // Open edit modal
    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Update title
    const titleInput = page.locator('input[name="title"]');
    await titleInput.fill("Updated Task Title");

    // Save changes
    await page.getByRole("button", { name: /save/i }).click();

    // Verify success message or modal closes
    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Task title updated successfully");
  });

  test("should update task description", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Update description
    const descriptionInput = page.locator('textarea[name="description"]');
    await descriptionInput.fill("This is the updated description");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Task description updated successfully");
  });

  test("should update task priority", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Change priority from 5 to 9
    const prioritySelect = page.locator('select[name="priority"]');
    await prioritySelect.selectOption("9");

    // Verify selection
    await expect(prioritySelect).toHaveValue("9");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Task priority updated successfully");
  });

  test("should update task status", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Change status to completed
    const statusSelect = page.locator('select[name="status"]');
    await statusSelect.selectOption("completed");

    await expect(statusSelect).toHaveValue("completed");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Task status updated successfully");
  });

  test("should update task due date", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Update due date
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 14);
    const dateString = newDate.toISOString().split("T")[0];

    const dueDateInput = page.locator('input[name="dueDate"]');
    await dueDateInput.fill(dateString);

    await expect(dueDateInput).toHaveValue(dateString);

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Task due date updated successfully");
  });

  test("should update multiple fields at once", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Update multiple fields
    await page.locator('input[name="title"]').fill("Completely Updated Task");
    await page
      .locator('textarea[name="description"]')
      .fill("New description for the task");
    await page.locator('select[name="priority"]').selectOption("8");
    await page.locator('select[name="status"]').selectOption("under_review");

    // Save
    await page.getByRole("button", { name: /save/i }).click();

    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Multiple fields updated successfully");
  });

  test("should cancel task editing without saving", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Make some changes
    await page.locator('input[name="title"]').fill("This should not be saved");

    // Cancel instead of save
    await page.getByRole("button", { name: /cancel/i }).click();

    // Modal should close
    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    // Task title should remain original
    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible();

    console.log("✅ Task editing canceled without saving");
  });

  test("should validate required title field on edit", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Clear the title
    await page.locator('input[name="title"]').fill("");

    // Try to save
    await page.getByRole("button", { name: /save/i }).click();

    // Modal should still be open (validation failed)
    await expect(page.getByText(/edit task/i)).toBeVisible();

    console.log("✅ Title validation works on edit");
  });

  test("should close modal when clicking outside (if applicable)", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    await expect(
      page.getByRole("heading", { name: "Original Task Title" })
    ).toBeVisible({ timeout: 15000 });

    const taskCard = page.locator("div", {
      has: page.getByRole("heading", { name: "Original Task Title" }),
    });
    await taskCard.getByRole("button", { name: /edit/i }).click();

    await expect(page.getByText(/edit task/i)).toBeVisible({ timeout: 5000 });

    // Try to close by pressing Escape
    await page.keyboard.press("Escape");

    // Modal should close
    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Modal closes with Escape key");
  });
});

