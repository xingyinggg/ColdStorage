// tests/e2e/tasks/create-task.spec.js
import { test, expect } from "../auth-fixture.js";

test.describe("Task Creation Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Mock ALL necessary API endpoints that the create page needs
    
    // Mock GET /tasks and POST /tasks
    await page.route(/http:\/\/localhost:4000\/tasks(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ tasks: [] }),
        });
      } else if (route.request().method() === "POST") {
        // Mock task creation response
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            task: {
              id: "new-task-123",
              title: "Created Task",
              status: "ongoing",
              priority: 5,
              owner_id: "E2E001",
              created_at: new Date().toISOString(),
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock /users/bulk endpoint
    await page.route(/http:\/\/localhost:4000\/users\/bulk$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ emp_id: "E2E001", name: "E2E Tester" }]),
      });
    });

    // Mock GET /users endpoint (for fetching staff list)
    await page.route(/http:\/\/localhost:4000\/users(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            users: [
              { emp_id: "STF001", name: "Test Staff", role: "staff", department: "Engineering" },
              { emp_id: "STF002", name: "Another Staff", role: "staff", department: "Engineering" },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock GET /projects endpoint
    await page.route(/http:\/\/localhost:4000\/projects(\?.*)?$/, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            projects: [
              { id: "proj-1", title: "Test Project 1", status: "active" },
              { id: "proj-2", title: "Test Project 2", status: "active" },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock POST /notifications endpoint
    await page.route(/http:\/\/localhost:4000\/notifications$/, async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });
  });

  test("should display the task creation form", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    // Wait for page to load - look for the role indicator first
    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Check for required form fields by their labels and structure
    // Title field
    await expect(page.getByText("Title", { exact: true })).toBeVisible();
    await expect(page.locator('input[type="text"][placeholder*="e.g. Prepare"]')).toBeVisible();
    
    // Description field
    await expect(page.getByText("Description", { exact: true })).toBeVisible();
    await expect(page.locator('textarea[placeholder*="Optional details about the task"]')).toBeVisible();
    
    // Priority field
    await expect(page.getByText("Priority Level (1-10)")).toBeVisible();
    
    // Status field
    await expect(page.getByText("Status", { exact: true })).toBeVisible();

    // Check for buttons
    await expect(
      page.getByRole("button", { name: /create task/i })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();

    console.log("✅ Task creation form displayed correctly");
  });

  test("should create a basic task with required fields only", async ({
    page,
  }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    // Wait for form to be ready
    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Fill required fields using placeholder-based selectors
    const titleInput = page.locator('input[type="text"][placeholder*="e.g. Prepare"]');
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("E2E Test Task");
    
    const descriptionTextarea = page.locator('textarea[placeholder*="Optional details about the task"]');
    await descriptionTextarea.fill("This is a test task");

    // Submit the form
    await page.getByRole("button", { name: /create task/i }).click();

    // Verify navigation to dashboard after creation
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    console.log("✅ Basic task created successfully");
  });

  test("should create a task with all fields filled", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Fill all fields
    const titleInput = page.locator('input[type="text"][placeholder*="e.g. Prepare"]');
    await titleInput.waitFor({ state: "visible", timeout: 10000 });
    await titleInput.fill("Complete E2E Test Task");
    
    const descriptionTextarea = page.locator('textarea[placeholder*="Optional details about the task"]');
    await descriptionTextarea.fill("A comprehensive test task with all fields");

    // Set priority - find the select by finding the label first
    const prioritySelect = page.locator('select').nth(0); // First select is priority
    await prioritySelect.selectOption("8");

    // Set status - second select
    const statusSelect = page.locator('select').nth(1); // Second select is status
    await statusSelect.selectOption("ongoing");

    // Set due date (future date)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const dateString = futureDate.toISOString().split("T")[0];
    const dueDateInput = page.locator('input[type="date"]');
    await dueDateInput.fill(dateString);

    // Submit
    await page.getByRole("button", { name: /create task/i }).click();

    // Verify success
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    console.log("✅ Complete task created with all fields");
  });

  test("should show validation error for missing title", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Try to submit without title
    const descriptionTextarea = page.locator('textarea[placeholder*="Optional details about the task"]');
    await descriptionTextarea.fill("Description only");
    await page.getByRole("button", { name: /create task/i }).click();

    // HTML5 validation should prevent submission
    // The form should not navigate away
    await expect(page).toHaveURL("/dashboard/tasks/create");

    console.log("✅ Validation error shown for missing title");
  });

  test("should handle priority selection correctly", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Test different priority values
    const prioritySelect = page.locator('select').nth(0); // First select is priority

    await prioritySelect.selectOption("1");
    await expect(prioritySelect).toHaveValue("1");

    await prioritySelect.selectOption("5");
    await expect(prioritySelect).toHaveValue("5");

    await prioritySelect.selectOption("10");
    await expect(prioritySelect).toHaveValue("10");

    console.log("✅ Priority selection works correctly");
  });

  test("should allow canceling task creation", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Fill some data
    const titleInput = page.locator('input[type="text"][placeholder*="e.g. Prepare"]');
    await titleInput.fill("Task to Cancel");

    // Click cancel
    await page.getByRole("button", { name: /cancel/i }).click();

    // Should navigate back to tasks page
    await expect(page).toHaveURL("/dashboard/tasks", { timeout: 10000 });

    console.log("✅ Task creation canceled successfully");
  });

  test("should handle due date selection", async ({ page }) => {
    await page.goto("/dashboard/tasks/create", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });

    // Select a due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateString = tomorrow.toISOString().split("T")[0];

    const dueDateInput = page.locator('input[type="date"]');
    await dueDateInput.fill(dateString);

    // Verify the date is set
    await expect(dueDateInput).toHaveValue(dateString);

    console.log("✅ Due date selection works correctly");
  });

  test("should display role indicator for staff user", async ({ page }) => {
    await page.goto("/dashboard/tasks/create");

    // Check for role indicator showing staff
    await expect(page.getByText(/creating as:/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/staff/i)).toBeVisible();

    console.log("✅ Role indicator displayed correctly");
  });
});

