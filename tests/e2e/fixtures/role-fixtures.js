// tests/e2e/fixtures/role-fixtures.js
import { test as base, expect } from "@playwright/test";

/**
 * Create a fixture with a specific role
 */
function createRoleFixture(role, emp_id, name) {
  const user = { id: `${role}-user-123`, email: `${role}@example.com` };
  const profile = {
    emp_id: emp_id,
    role: role,
    department: role === "hr" ? "Human Resources" : "Engineering",
    name: name,
  };

  return base.extend({
    page: async ({ page }, usePage) => {
      // Set E2E headers
      await page.setExtraHTTPHeaders({ "x-e2e-test": "1" });

      // Set localStorage with role-specific data
      await page.addInitScript(
        ({ user, profile }) => {
          try {
            window.localStorage.setItem("e2e_auth", "1");
            // Store user profile for the hook to pick up
            window.localStorage.setItem(
              "e2e_user_profile",
              JSON.stringify(profile)
            );
          } catch {}

          // Stub Supabase client
          window.supabase = {
            auth: {
              getSession: async () => ({
                data: { session: { user } },
                error: null,
              }),
              getUser: async () => ({
                data: { user },
                error: null,
              }),
              onAuthStateChange: (cb) => {
                cb("SIGNED_IN", { user });
                return { data: { subscription: { unsubscribe: () => {} } } };
              },
              signOut: async () => ({ error: null }),
            },
            from: () => ({
              select: () => ({ data: [], error: null }),
              eq: () => ({ data: [], error: null }),
              single: () => ({ data: null, error: null }),
              insert: () => ({ data: [], error: null }),
            }),
          };
        },
        { user, profile }
      );

      await usePage(page);
    },
  });
}

/**
 * Fixtures for different user roles
 */
export const staffTest = createRoleFixture("staff", "STF001", "Test Staff");
export const managerTest = createRoleFixture(
  "manager",
  "MGR001",
  "Test Manager"
);
export const hrTest = createRoleFixture("hr", "HR001", "Test HR");
export const directorTest = createRoleFixture(
  "director",
  "DIR001",
  "Test Director"
);

// Export expect for convenience
export { expect };

