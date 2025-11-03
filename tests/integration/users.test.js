import dotenv from "dotenv";
import path from "path";
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as supabaseLib from "../../server/lib/supabase.js";

// Load test environment FIRST
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

const hasTestEnv =
  !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;

if (hasTestEnv) {
  process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
} else {
  console.log(
    "⚠️  Skipping users integration tests - Supabase test env not configured"
  );
}

// Import app AFTER env is set
import app from "../../server/index.js";

describe.skipIf(!hasTestEnv)("Users Routes Integration Tests", () => {
  let supabaseClient;

  // Spies for auth helpers
  let getUserFromTokenSpy;
  let getEmpIdForUserIdSpy;

  beforeAll(async () => {
    supabaseClient = createClient(
      process.env.SUPABASE_TEST_URL,
      process.env.SUPABASE_TEST_SERVICE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Seed a variety of users to exercise filters and search
    await supabaseClient.from("users").upsert([
      {
        emp_id: "TEST001",
        name: "Alice Manager",
        email: "alice@example.com",
        role: "manager",
        department: "Ops",
      },
      {
        emp_id: "TEST002",
        name: "Bob Staff",
        email: "bob@example.com",
        role: "staff",
        department: "Ops",
      },
      {
        emp_id: "TEST003",
        name: "Charlie Staff",
        email: "charlie@example.com",
        role: "staff",
        department: "IT",
      },
      {
        emp_id: "SELF001",
        name: "Self User",
        email: "self@example.com",
        role: "staff",
        department: "IT",
      },
      {
        emp_id: "ZZZ999",
        name: "Zed Manager",
        email: "zed@example.com",
        role: "manager",
        department: "IT",
      },
    ]);

    // Deterministic auth mapping to cover lines/branches
    getUserFromTokenSpy = vi
      .spyOn(supabaseLib, "getUserFromToken")
      .mockImplementation(async (token) => {
        switch (token) {
          case "valid-token":
            return { id: "uid-valid", email: "alice@example.com" };
          case "self-token":
            return { id: "uid-self", email: "self@example.com" };
          case "no-emp-token":
            return { id: "uid-noemp", email: "noemp@example.com" };
          case "user-notfound-token":
            return { id: "uid-usernotfound", email: "nouser@example.com" };
          // explicitly invalid
          case "bad-token":
            return null;
          default:
            return null;
        }
      });

    getEmpIdForUserIdSpy = vi
      .spyOn(supabaseLib, "getEmpIdForUserId")
      .mockImplementation(async (userId) => {
        switch (userId) {
          case "uid-valid":
            return "TEST001";
          case "uid-self":
            return "SELF001";
          case "uid-noemp":
            return null; // triggers "exclude_self" ignored path
          case "uid-usernotfound":
            return "NOUSER"; // exists as emp_id but not present in table for other routes; not used here
          default:
            return null;
        }
      });
  });

  afterAll(async () => {
    try {
      await supabaseClient
        .from("users")
        .delete()
        .in("emp_id", ["TEST001", "TEST002", "TEST003", "SELF001", "ZZZ999"]);
    } catch {}
    if (getUserFromTokenSpy) getUserFromTokenSpy.mockRestore();
    if (getEmpIdForUserIdSpy) getEmpIdForUserIdSpy.mockRestore();
  });

  // ---------------- GET /users ----------------

  it("GET /users - 401 when missing token", async () => {
    const res = await request(app).get("/users");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "No token provided");
  });

  it("GET /users - 401 when invalid token", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid token");
  });

  it("GET /users - returns all users (ordered by name) without filters", async () => {
    const res = await request(app)
      .get("/users")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("users");
    const users = res.body.users;
    expect(Array.isArray(users)).toBe(true);
    // Order by name ascending implied in route
    if (users.length >= 2) {
      const names = users.map((u) => u.name);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    }
  });

  it("GET /users - roles filter (single role) returns only that role", async () => {
    const res = await request(app)
      .get("/users?roles=manager")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    res.body.users.forEach((u) => {
      if (u.role) expect(u.role).toBe("manager");
    });
  });

  it("GET /users - roles filter (multiple roles, extra spaces) respected", async () => {
    const res = await request(app)
      .get("/users?roles= staff , manager ")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    res.body.users.forEach((u) => {
      if (u.role) expect(["staff", "manager"]).toContain(u.role);
    });
  });

  it("GET /users - roles filter unknown role yields []", async () => {
    const res = await request(app)
      .get("/users?roles=ghost")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    // Expect empty or only roles that match 'ghost' (none)
    expect(res.body.users.length).toBe(0);
  });

  it("GET /users - exclude_self=true removes current user when emp id present", async () => {
    // current user maps to SELF001
    const res = await request(app)
      .get("/users?exclude_self=true")
      .set("Authorization", "Bearer self-token");

    expect(res.status).toBe(200);
    const users = res.body.users;
    expect(Array.isArray(users)).toBe(true);
    const foundSelf = users.find((u) => u.emp_id === "SELF001");
    expect(foundSelf).toBeUndefined();
  });

  it("GET /users - exclude_self ignored when emp id not found", async () => {
    const res = await request(app)
      .get("/users?exclude_self=true")
      .set("Authorization", "Bearer no-emp-token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  it("GET /users - supabase error (error object) -> 500", async () => {
    const errorClient = {
      from: () => ({
        select: () => ({
          order: () =>
            Promise.resolve({ data: null, error: { message: "boom" } }),
        }),
      }),
    };
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockReturnValue(errorClient);
    try {
      const res = await request(app)
        .get("/users")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /users - catch block (throwing client) -> 500", async () => {
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockImplementation(() => {
        throw new Error("thrown");
      });
    try {
      const res = await request(app)
        .get("/users")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  // ---------------- GET /users/search ----------------

  it("GET /users/search - 401 when missing token", async () => {
    const res = await request(app).get("/users/search?q=Alice");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "No token provided");
  });

  it("GET /users/search - empty query -> []", async () => {
    const res = await request(app)
      .get("/users/search?q=")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /users/search - whitespace query -> []", async () => {
    const res = await request(app)
      .get("/users/search?q=   ")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /users/search - returns results (<= 10)", async () => {
    const res = await request(app)
      .get("/users/search?q=Manager")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeLessThanOrEqual(10);
  });

  it("GET /users/search - supabase error (error object) -> 500", async () => {
    const errorClient = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            limit: () =>
              Promise.resolve({
                data: null,
                error: { message: "search-fail" },
              }),
          }),
        }),
      }),
    };
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockReturnValue(errorClient);
    try {
      const res = await request(app)
        .get("/users/search?q=Test")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /users/search - catch block (throwing client) -> 500", async () => {
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockImplementation(() => {
        throw new Error("thrown-search");
      });
    try {
      const res = await request(app)
        .get("/users/search?q=Test")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  // ---------------- POST /users/bulk ----------------

  it("POST /users/bulk - 401 when missing token", async () => {
    const res = await request(app)
      .post("/users/bulk")
      .send({ emp_ids: ["TEST001"] });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "No token provided");
  });

  it("POST /users/bulk - body missing -> 400 emp_ids array is required", async () => {
    const res = await request(app)
      .post("/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "emp_ids array is required");
  });

  it("POST /users/bulk - emp_ids not array -> 400 emp_ids array is required", async () => {
    const res = await request(app)
      .post("/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ emp_ids: "TEST001" });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error", "emp_ids array is required");
  });

  it("POST /users/bulk - empty array -> returns []", async () => {
    const res = await request(app)
      .post("/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ emp_ids: [] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it("POST /users/bulk - success returns users", async () => {
    const res = await request(app)
      .post("/users/bulk")
      .set("Authorization", "Bearer valid-token")
      .send({ emp_ids: ["TEST001", "TEST002", "NONEXIST"] });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Should include at least existing users
    const ids = res.body.map((u) => u.emp_id);
    expect(ids).toEqual(expect.arrayContaining(["TEST001", "TEST002"]));
  });

  it("POST /users/bulk - supabase error (error object) -> 500", async () => {
    const errorClient = {
      from: () => ({
        select: () => ({
          in: () =>
            Promise.resolve({ data: null, error: { message: "bulk-fail" } }),
        }),
      }),
    };
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockReturnValue(errorClient);
    try {
      const res = await request(app)
        .post("/users/bulk")
        .set("Authorization", "Bearer valid-token")
        .send({ emp_ids: ["TEST001"] });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  it("POST /users/bulk - catch block (throwing client) -> 500", async () => {
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockImplementation(() => {
        throw new Error("thrown-bulk");
      });
    try {
      const res = await request(app)
        .post("/users/bulk")
        .set("Authorization", "Bearer valid-token")
        .send({ emp_ids: ["TEST001"] });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  // ---------------- GET /users/profile/:empId ----------------

  it("GET /users/profile/:empId - 401 when missing token", async () => {
    const res = await request(app).get("/users/profile/TEST001");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "No token provided");
  });

  it("GET /users/profile/:empId - 401 when invalid token", async () => {
    const res = await request(app)
      .get("/users/profile/TEST001")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error", "Invalid token");
  });

  it("GET /users/profile/:empId - 200 returns profile", async () => {
    const res = await request(app)
      .get("/users/profile/TEST001")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("emp_id", "TEST001");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("email");
  });

  it("GET /users/profile/:empId - 404 not found", async () => {
    const res = await request(app)
      .get("/users/profile/NONEXISTENT")
      .set("Authorization", "Bearer valid-token");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error", "User not found");
  });

  it("GET /users/profile/:empId - supabase error (error object) -> 500", async () => {
    const errorClient = {
      from: () => ({
        select: () => ({
          eq: () =>
            Promise.resolve({ data: null, error: { message: "profile-fail" } }),
        }),
      }),
    };
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockReturnValue(errorClient);
    try {
      const res = await request(app)
        .get("/users/profile/TEST001")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });

  it("GET /users/profile/:empId - catch block (throwing client) -> 500", async () => {
    const spy = vi
      .spyOn(supabaseLib, "getServiceClient")
      .mockImplementation(() => {
        throw new Error("thrown-profile");
      });
    try {
      const res = await request(app)
        .get("/users/profile/TEST001")
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty("error");
    } finally {
      spy.mockRestore();
    }
  });
});
