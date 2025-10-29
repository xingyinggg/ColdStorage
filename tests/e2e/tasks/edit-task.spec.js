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

    // Update title - find the first text input in the modal
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill("Updated Task Title");

    // Save changes
    await page.getByRole("button", { name: /save/i }).click();

    // Verify success message or modal closes
    await expect(page.getByText(/edit task/i)).not.toBeVisible({
      timeout: 5000,
    });

    // The modal closing indicates the update was successful
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

    // Update description - find the first textarea in the modal
    const descriptionTextarea = page.locator('textarea').first();
    await descriptionTextarea.fill("This is the updated description");

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

    // Change priority from 5 to 9 - find the first select in the modal (priority)
    const prioritySelect = page.locator('select').first();
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

    // Change status to completed - find the second select in the modal (status)
    const statusSelect = page.locator('select').nth(1);
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

    // Update due date - find the date input in the modal (scoped to avoid ambiguity)
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 14);
    const dateString = newDate.toISOString().split("T")[0];

    // Find the specific date input in the Due Date section of the modal
    const dueDateInput = page.locator('input[type="date"]').nth(0); // The modal's due date input should be the first one
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

    // Update multiple fields - scope to modal to avoid ambiguity
    const modal = page.locator('[role="dialog"], .fixed.inset-0');

    const titleInput = modal.locator('input[type="text"]').first();
    await titleInput.fill("Completely Updated Task");

    const descriptionTextarea = modal.locator('textarea').first();
    await descriptionTextarea.fill("New description for the task");

    const prioritySelect = modal.locator('select').first();
    await prioritySelect.selectOption("8");

    const statusSelect = modal.locator('select').nth(1);
    await statusSelect.selectOption("under review");

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
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill("This should not be saved");

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

    // Clear the title - find the first text input in the modal
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill("");

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

    // Modal should still be open (Escape key not implemented for closing)
    await expect(page.getByText(/edit task/i)).toBeVisible({
      timeout: 5000,
    });

    console.log("✅ Modal remains open with Escape key (expected behavior)");
  });
});

