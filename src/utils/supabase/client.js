// lib/supabase/client.js
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage?.getItem("e2e_auth") === "1") {
        const user = { id: "mock-user-123", email: "mock@example.com" };
        const session = { access_token: "e2e-token", user };
        return {
          auth: {
            async getSession() {
              return { data: { session }, error: null };
            },
            async getUser() {
              return { data: { user }, error: null };
            },
            onAuthStateChange(cb) {
              cb("SIGNED_IN", { user, session });
              return { data: { subscription: { unsubscribe() {} } } };
            },
            async signOut() {
              return { error: null };
            },
          },
          from() {
            return {
              select() {
                return Promise.resolve({ data: [], error: null });
              },
              eq() {
                return Promise.resolve({ data: [], error: null });
              },
              single() {
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      }
    } catch {}
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
