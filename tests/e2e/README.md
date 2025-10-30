# End-to-End (E2E) Testing Guide

This directory contains Playwright E2E tests for the ColdStorage application.

## Overview

The E2E tests use Playwright to simulate real user interactions and validate critical workflows. Tests run in a mocked authentication environment to avoid depending on real credentials or database state.

## Test Structure

```
tests/e2e/
├── README.md                    # This file
├── auth-fixture.js              # Base auth fixture for E2E tests
├── fixtures/
│   ├── test-data.js            # Reusable test data (tasks, users, projects)
│   └── role-fixtures.js         # Role-specific fixtures (staff, manager, hr, director)
├── mocks/
│   └── tasks.js                 # Mock task data
├── tasks/
│   ├── create-task.spec.js      # Task creation flow tests
│   └── edit-task.spec.js        # Task editing flow tests
└── overdue-dashboard.spec.js    # Dashboard overdue highlighting tests
```

## Running Tests

### Run all E2E tests
```bash
npx playwright test
```

### Run specific test file
```bash
npx playwright test tests/e2e/tasks/create-task.spec.js
```

### Run with UI mode (interactive)
```bash
npx playwright test --ui
```

### Run in headed mode (see browser)
```bash
npx playwright test --headed
```

### Generate HTML report
```bash
npx playwright show-report
```

## Test Artifacts

Test artifacts are saved in `test-results/`:
- **Videos**: `test-results/<test-name>/video.webm`
- **Screenshots**: `test-results/<test-name>/test-failed-1.png`
- **Traces**: `test-results/<test-name>/trace.zip`

### View trace files
```bash
npx playwright show-trace test-results/<test-name>/trace.zip
```

## Authentication in E2E Tests

Tests use a mock authentication system that bypasses real Supabase auth:

### How it works
1. **Middleware bypass**: The `x-e2e-test` header tells middleware to skip auth checks
2. **useAuth mock**: When `localStorage.e2e_auth === '1'`, the hook returns mock user data
3. **Supabase client mock**: `createClient()` returns a stub in E2E mode

### Default E2E User
```javascript
{
  id: 'mock-user-123',
  email: 'mock@example.com',
  emp_id: 'E2E001',
  role: 'staff',
  department: 'QA',
  name: 'E2E Tester'
}
```

## Writing New Tests

### Basic test structure
```javascript
import { test, expect } from "../auth-fixture.js";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    // Mock API endpoints
    await page.route(/\/api\/endpoint/, async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ data: [] })
      });
    });
  });

  test("should do something", async ({ page }) => {
    await page.goto("/some-page");
    
    // Your test logic
    await expect(page.getByText("Expected Text")).toBeVisible();
  });
});
```

### Using test data fixtures
```javascript
import { sampleTasks, createTask } from "../fixtures/test-data.js";

// Use predefined data
const task = sampleTasks.ongoing;

// Or create custom data
const customTask = createTask({
  title: "Custom Task",
  priority: 8
});
```

### Using role fixtures
```javascript
import { managerTest as test, expect } from "../fixtures/role-fixtures.js";

test("manager can assign tasks", async ({ page }) => {
  // Test runs as manager role
});
```

## API Mocking

Tests mock backend API calls to avoid dependencies on real data:

```javascript
// Mock GET /tasks
await page.route(/\/tasks(\?.*)?$/, async (route) => {
  if (route.request().method() === "GET") {
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ tasks: mockTasks })
    });
  }
});

// Mock POST /tasks (task creation)
await page.route(/\/tasks$/, async (route) => {
  if (route.request().method() === "POST") {
    const postData = await route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        id: "new-task-id",
        ...postData
      })
    });
  }
});
```

## Best Practices

1. **Use semantic selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
2. **Wait for elements**: Always use `await expect(...).toBeVisible()` before interacting
3. **Mock API calls**: Mock all external dependencies to make tests deterministic
4. **Clean up**: Tests should be independent and not affect each other
5. **Meaningful assertions**: Test user-visible behavior, not implementation details
6. **Use fixtures**: Reuse test data and setup code via fixtures

## Common Patterns

### Waiting for page load
```javascript
await expect(page.getByRole('heading', { name: 'Page Title' })).toBeVisible({ timeout: 15000 });
```

### Filling forms
```javascript
await page.fill('input[name="title"]', "Task Title");
await page.selectOption('select[name="priority"]', "8");
await page.click('button[type="submit"]');
```

### Checking navigation
```javascript
await expect(page).toHaveURL("/expected-path");
```

### Verifying text content
```javascript
await expect(page.getByText("Success message")).toBeVisible();
await expect(page.getByText("Should not exist")).not.toBeVisible();
```

## Troubleshooting

### Test fails with "element not found"
- Increase timeout: `await expect(...).toBeVisible({ timeout: 15000 })`
- Check if API mocks are correct
- View the video/screenshot to see what actually rendered

### Hydration errors
- Check browser console in trace viewer
- Ensure E2E mode is properly detected in components
- Verify localStorage flags are set in fixture

### Tests are flaky
- Add explicit waits for async operations
- Mock all external dependencies
- Avoid time-dependent logic (use fixed dates in mocks)

## Configuration

Test configuration is in `playwright.config.js`:
- Video recording: `on` (always record)
- Screenshots: `on` (always capture)
- Traces: `on` (always save)
- Base URL: `http://localhost:3000`
- Auto-start server: `npm run dev:all`

## Next Steps

Consider adding tests for:
- [ ] Login/logout flows (when auth is stable)
- [ ] Task deletion
- [ ] Subtask management
- [ ] Project workflows
- [ ] Role-based permissions
- [ ] Form validation errors
- [ ] Notifications
- [ ] Search and filtering

