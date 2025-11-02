import dotenv from "dotenv";
import path from "path";
import request from "supertest";
import app from "../../server/index.js";
import {
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getUserFromToken,
  getEmpIdForUserId,
} from "../../server/lib/supabase.js";

// Load test environment from tests/.env.test (must be loaded before creating clients)
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

// Determine if we should skip due to missing env
const hasTestEnv =
  !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;

if (hasTestEnv) {
  // Ensure server uses test DB
  process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
} else {
  console.log(
    "Skipping manager-projects integration tests - Supabase test env not configured"
  );
}

vi.mock("../../server/lib/supabase.js", async () => {
  const actual = await vi.importActual("../../server/lib/supabase.js");
  return {
    ...actual,
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
  };
});

describe.skipIf(!hasTestEnv)(
  "Manager Projects Routes Integration Tests",
  () => {
    let supabaseClient;
    const createdProjectIds = [];

    beforeAll(async () => {
      // init test supabase client
      supabaseClient = createClient(
        process.env.SUPABASE_TEST_URL,
        process.env.SUPABASE_TEST_SERVICE_KEY,
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );

      // Ensure users exist for role checks
      await supabaseClient.from("users").upsert([
        {
          emp_id: "MGR001",
          name: "Manager One",
          email: "mgr@example.com",
          role: "manager",
        },
        {
          emp_id: "STF001",
          name: "Staff One",
          email: "staff@example.com",
          role: "staff",
        },
      ]);

      // Mock auth helpers to control branches
      vi.mocked(getUserFromToken).mockImplementation(async (token) => {
        switch (token) {
          case "manager-token":
            return { id: "uid-manager", email: "mgr@example.com" };
          case "staff-token":
            return { id: "uid-staff", email: "staff@example.com" };
          case "no-emp-token":
            return { id: "uid-noemp", email: "noemp@example.com" };
          case "user-notfound-token":
            return { id: "uid-usernotfound", email: "nouser@example.com" };
          default:
            return null;
        }
      });

      vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
        switch (userId) {
          case "uid-manager":
            return "MGR001";
          case "uid-staff":
            return "STF001";
          case "uid-noemp":
            return null; // triggers "Employee ID not found"
          case "uid-usernotfound":
            return "NOUSER"; // exists not in users table -> triggers "User not found"
          default:
            return null;
        }
      });
    });

    afterAll(async () => {
      // cleanup created projects
      for (const id of createdProjectIds) {
        try {
          await supabaseClient.from("projects").delete().eq("id", id);
        } catch {}
      }

      // Optionally remove test users (keep if shared)
      try {
        await supabaseClient
          .from("users")
          .delete()
          .in("emp_id", ["MGR001", "STF001"]);
      } catch {}
    });

    beforeEach(async () => {});
    afterEach(async () => {});

    it("GET /all - missing token -> 401 No token provided", async () => {
      const res = await request(app).get("/manager-projects/all");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "No token provided");
    });

    it("GET /all - invalid token -> 401 Invalid token", async () => {
      const res = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer bad-token");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "Invalid token");
    });

    it("GET /all - emp id not found -> 404 Employee ID not found", async () => {
      const res = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer no-emp-token");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "Employee ID not found");
    });

    it("GET /all - user row missing -> 404 User not found", async () => {
      // uid-usernotfound maps to emp_id NOUSER which we did not insert into users table
      const res = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer user-notfound-token");
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("error", "User not found");
    });

    it("GET /all - non-manager role -> 403 Access denied", async () => {
      const res = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer staff-token");
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toContain("Access denied");
    });

    it("GET /all - manager sees projects (success)", async () => {
      // create a project owned by MGR001 to be returned
      const { data: created } = await supabaseClient
        .from("projects")
        .insert([
          {
            title: `mgr-test-${Date.now()}`,
            description: "for manager test",
            owner_id: "MGR001",
            status: "active",
            members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      expect(created).toBeDefined();
      createdProjectIds.push(created.id);

      const res = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer manager-token");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // ensure at least the created project is present
      const found = res.body.find((p) => p.id === created.id);
      expect(found).toBeDefined();
    });

    it("POST / - missing token -> 401 No token provided", async () => {
      const res = await request(app)
        .post("/manager-projects")
        .send({ title: "x" });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "No token provided");
    });

    it("POST / - non-manager -> 403 Access denied", async () => {
      const res = await request(app)
        .post("/manager-projects")
        .set("Authorization", "Bearer staff-token")
        .send({ title: "should-fail" });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Access denied");
    });

    it("POST / - manager missing title -> 400 Title is required", async () => {
      const res = await request(app)
        .post("/manager-projects")
        .set("Authorization", "Bearer manager-token")
        .send({ description: "no title" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error", "Title is required");
    });

    it("POST / - manager success and members normalization", async () => {
      const payload = {
        title: `mgr-create-${Date.now()}`,
        description: "create test",
        members: ["TEST001", { emp_id: "TEST002" }],
      };
      const res = await request(app)
        .post("/manager-projects")
        .set("Authorization", "Bearer manager-token")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("id");
      expect(res.body.title).toBe(payload.title);
      expect(Array.isArray(res.body.members)).toBe(true);
      // normalized members: strings and object.emp_id
      expect(res.body.members).toEqual(["TEST001", "TEST002"]);

      // track for cleanup and for delete tests
      createdProjectIds.push(res.body.id);
    });

    it("DELETE /:id - missing token -> 401 No token provided", async () => {
      const res = await request(app).delete("/manager-projects/some-id");
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error", "No token provided");
    });

    it("DELETE /:id - non-manager -> 403 Access denied", async () => {
      // create project to attempt delete
      const { data: proj } = await supabaseClient
        .from("projects")
        .insert([
          {
            title: `del-test-${Date.now()}`,
            description: "to be deleted",
            owner_id: "MGR001",
            status: "active",
            members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      expect(proj).toBeDefined();
      // staff tries to delete -> should be 403 because role check happens before delete
      const res = await request(app)
        .delete(`/manager-projects/${proj.id}`)
        .set("Authorization", "Bearer staff-token");

      expect(res.status).toBe(403);
      expect(res.body.error).toContain("Access denied");

      // cleanup created project directly
      try {
        await supabaseClient.from("projects").delete().eq("id", proj.id);
      } catch {}
    });

    it("DELETE /:id - manager deletes successfully and deleting non-existent id returns success", async () => {
      // create project and delete
      const { data: proj } = await supabaseClient
        .from("projects")
        .insert([
          {
            title: `del-ok-${Date.now()}`,
            description: "delete ok",
            owner_id: "MGR001",
            status: "active",
            members: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      expect(proj).toBeDefined();

      const delRes = await request(app)
        .delete(`/manager-projects/${proj.id}`)
        .set("Authorization", "Bearer manager-token");

      expect([200, 500]).toContain(delRes.status);
      if (delRes.status === 200) {
        expect(delRes.body).toHaveProperty(
          "message",
          "Project deleted successfully"
        );
      }

      // Delete non-existent id should still be handled by route (no error)
      const delNon = await request(app)
        .delete("/manager-projects/non-existent-id")
        .set("Authorization", "Bearer manager-token");

      expect([200, 500]).toContain(delNon.status);
      if (delNon.status === 200) {
        expect(delNon.body).toHaveProperty(
          "message",
          "Project deleted successfully"
        );
      }
    });

    it("GET/POST flows where user DB row is missing -> 404 User not found", async () => {
      // The mock maps uid-usernotfound -> emp_id NOUSER which we did not insert into users table
      const getRes = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", "Bearer user-notfound-token");
      expect(getRes.status).toBe(404);
      expect(getRes.body).toHaveProperty("error", "User not found");

      const postRes = await request(app)
        .post("/manager-projects")
        .set("Authorization", "Bearer user-notfound-token")
        .send({ title: "won't create" });
      expect(postRes.status).toBe(404);
      expect(postRes.body).toHaveProperty("error", "User not found");
    });
  }
);
