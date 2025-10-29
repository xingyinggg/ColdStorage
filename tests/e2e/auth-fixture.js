// tests/e2e/auth-fixture.js
import { test as base, expect } from "@playwright/test";

// fake session
const fakeUser = { id: "mock-user-123", email: "mock@example.com" };

export const test = base.extend({
  page: async ({ page }, usePage) => {
    // Mark requests as E2E to let middleware bypass auth
    await page.setExtraHTTPHeaders({ 'x-e2e-test': '1' });

    // before scripts run, flag E2E auth and optionally stub a minimal supabase
    await page.addInitScript((user) => {
      try {
        window.localStorage.setItem('e2e_auth', '1');
      } catch {}

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

    await usePage(page);
  },
});

export { expect };
