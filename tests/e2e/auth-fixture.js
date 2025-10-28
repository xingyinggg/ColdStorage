// tests/e2e/auth-fixture.js
import { test as base, expect } from "@playwright/test";

// fake session
const fakeUser = { id: "mock-user-123", email: "mock@example.com" };

export const test = base.extend({
  page: async ({ page }, use) => {
    // before scripts run, replace window.supabase with a fake one
    await page.addInitScript((user) => {
      // completely stub supabase.createClient
      window.supabase = {
        auth: {
          getSession: async () => ({
            data: { session: { user } },
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
          insert: () => ({ data: [], error: null }),
        }),
      };
    }, fakeUser);

    await use(page);
  },
});

export { expect };
