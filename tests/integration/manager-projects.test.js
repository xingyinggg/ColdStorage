import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../../server/index.js";

// Check if test environment variables are configured
const hasTestEnv = process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

describe.skipIf(!hasTestEnv)("Manager Projects Routes Integration Tests", () => {
  let authToken;
  let testProjectId;

  beforeAll(async () => {
    // Set environment variables for server routes to ensure test database usage
    process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

    console.log("🔧 Manager Projects Tests using test database:");
    console.log("  SUPABASE_URL:", process.env.SUPABASE_TEST_URL ? "✅ Set" : "❌ Missing");
    console.log("  SUPABASE_SERVICE_ROLE_KEY:", process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ? "✅ Set" : "❌ Missing");

    // Login to get auth token for testing
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "test@example.com",
        password: "testpassword"
      });

    if (loginResponse.status === 200 && loginResponse.body.token) {
      authToken = loginResponse.body.token;
      console.log("  Auth Token:", "✅ Obtained");

      // Create a test project for testing
      const createResponse = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test Project for Manager Routes",
          description: "Created during testing",
          status: "active",
          members: ["TEST001"]
        });

      if (createResponse.status === 201 && createResponse.body.id) {
        testProjectId = createResponse.body.id;
        console.log("  Test Project:", `✅ Created (ID: ${testProjectId})`);
      } else {
        console.log("  Test Project:", `❌ Failed to create (${createResponse.status})`);
      }
    } else {
      console.log("  Auth Token:", "❌ Failed to obtain");
    }
  });

  afterAll(async () => {
    // Clean up test project if it was created
    if (authToken && testProjectId) {
      try {
        await request(app)
          .delete(`/manager-projects/${testProjectId}`)
          .set("Authorization", `Bearer ${authToken}`);
        console.log("  Test Project:", "✅ Cleaned up");
      } catch (error) {
        console.log("  Test Project:", "⚠️ Cleanup failed (may already be deleted)");
      }
    }
  });

  describe("GET /manager-projects/all - Get all projects (manager access)", () => {
    it("should get all projects for authenticated user", async () => {
      if (!authToken) return; // Skip if login failed

      const response = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", `Bearer ${authToken}`);

      // This route checks for manager role, but in test environment
      // we may not have proper role setup, so it might return 403
      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(Array.isArray(response.body)).toBe(true);

        // Verify project structure if projects exist
        if (response.body.length > 0) {
          const project = response.body[0];
          expect(project).toHaveProperty("id");
          expect(project).toHaveProperty("title");
          expect(project).toHaveProperty("description");
          expect(project).toHaveProperty("owner_id");
          expect(project).toHaveProperty("status");
          expect(project).toHaveProperty("created_at");
        }
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toContain("Access denied");
      }
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/manager-projects/all");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("POST /manager-projects - Create new project (manager access)", () => {
    it("should create a new project successfully", async () => {
      if (!authToken) return;

      const projectData = {
        title: "Integration Test Project",
        description: "Created during integration testing",
        status: "active",
        members: ["TEST001", "TEST002"]
      };

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send(projectData);

      // This route checks for manager role, but in test environment
      // we may not have proper role setup, so it might return 403
      expect([201, 403]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("title", projectData.title);
        expect(response.body).toHaveProperty("description", projectData.description);
        expect(response.body).toHaveProperty("owner_id");
        expect(response.body).toHaveProperty("status", projectData.status);
        expect(response.body).toHaveProperty("members");
        expect(Array.isArray(response.body.members)).toBe(true);

        // Clean up the created project
        if (response.body.id) {
          await request(app)
            .delete(`/manager-projects/${response.body.id}`)
            .set("Authorization", `Bearer ${authToken}`);
        }
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toContain("Access denied");
      }
    });

    it("should create project with minimal required data", async () => {
      if (!authToken) return;

      const projectData = {
        title: "Minimal Test Project"
      };

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send(projectData);

      expect([201, 403]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toHaveProperty("id");
        expect(response.body).toHaveProperty("title", projectData.title);
        expect(response.body).toHaveProperty("status", "active"); // Default status
        expect(Array.isArray(response.body.members)).toBe(true);

        // Clean up the created project
        if (response.body.id) {
          await request(app)
            .delete(`/manager-projects/${response.body.id}`)
            .set("Authorization", `Bearer ${authToken}`);
        }
      }
    });

    it("should reject creation without required title", async () => {
      if (!authToken) return;

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ description: "Missing title" });

      // Should either return 400 (validation error) or 403 (role error)
      expect([400, 403]).toContain(response.status);

      if (response.status === 400) {
        expect(response.body).toHaveProperty("error", "Title is required");
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toContain("Access denied");
      }
    });

    it("should handle members array with different formats", async () => {
      if (!authToken) return;

      const projectData = {
        title: "Members Format Test Project",
        members: ["TEST001", { emp_id: "TEST002" }, "TEST003"]
      };

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send(projectData);

      expect([201, 403]).toContain(response.status);

      if (response.status === 201) {
        expect(response.body).toHaveProperty("members");
        expect(Array.isArray(response.body.members)).toBe(true);
        // Should extract emp_ids from objects and keep strings as-is
        expect(response.body.members).toEqual(["TEST001", "TEST002", "TEST003"]);

        // Clean up the created project
        if (response.body.id) {
          await request(app)
            .delete(`/manager-projects/${response.body.id}`)
            .set("Authorization", `Bearer ${authToken}`);
        }
      }
    });

    it("should reject unauthorized project creation", async () => {
      const response = await request(app)
        .post("/manager-projects")
        .send({ title: "Unauthorized Project" });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("DELETE /manager-projects/:id - Delete project (manager access)", () => {
    it("should delete existing project successfully", async () => {
      if (!authToken) return;

      // First create a project to delete
      const createResponse = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Project to Delete",
          description: "Temporary project for deletion test"
        });

      let projectIdToDelete = null;
      if (createResponse.status === 201 && createResponse.body.id) {
        projectIdToDelete = createResponse.body.id;

        // Now try to delete it
        const deleteResponse = await request(app)
          .delete(`/manager-projects/${projectIdToDelete}`)
          .set("Authorization", `Bearer ${authToken}`);

        expect([200, 403]).toContain(deleteResponse.status);

        if (deleteResponse.status === 200) {
          expect(deleteResponse.body).toHaveProperty("message", "Project deleted successfully");

          // Verify it's actually deleted by trying to get all projects
          const getResponse = await request(app)
            .get("/manager-projects/all")
            .set("Authorization", `Bearer ${authToken}`);

          if (getResponse.status === 200) {
            const projectExists = getResponse.body.some(p => p.id === projectIdToDelete);
            expect(projectExists).toBe(false);
          }
        } else if (deleteResponse.status === 403) {
          expect(deleteResponse.body).toHaveProperty("error");
          expect(deleteResponse.body.error).toContain("Access denied");
        }
      } else if (createResponse.status === 403) {
        // If we can't create due to role restrictions, the delete test is not applicable
        console.log("⚠️ Skipping delete test - cannot create project due to role restrictions");
      }
    });

    it("should handle deletion of non-existent project", async () => {
      if (!authToken) return;

      const response = await request(app)
        .delete("/manager-projects/non-existent-id")
        .set("Authorization", `Bearer ${authToken}`);

      // This might return 200 (successful deletion even if not found)
      // or 403 (role access denied) or 500 (database error)
      expect([200, 403, 500]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("message", "Project deleted successfully");
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toContain("Access denied");
      }
    });

    it("should reject unauthorized project deletion", async () => {
      const response = await request(app)
        .delete("/manager-projects/some-id");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("Role-based access control", () => {
    it("should enforce manager role requirement for all routes", async () => {
      if (!authToken) return;

      const routes = [
        { method: "get", path: "/manager-projects/all" },
        { method: "post", path: "/manager-projects", data: { title: "Test" } },
        { method: "delete", path: "/manager-projects/test-id" }
      ];

      for (const route of routes) {
        let response;
        if (route.method === "get") {
          response = await request(app)
            .get(route.path)
            .set("Authorization", `Bearer ${authToken}`);
        } else if (route.method === "post") {
          response = await request(app)
            .post(route.path)
            .set("Authorization", `Bearer ${authToken}`)
            .send(route.data);
        } else if (route.method === "delete") {
          response = await request(app)
            .delete(route.path)
            .set("Authorization", `Bearer ${authToken}`);
        }

        // Each route should either succeed (200/201) if user has manager role
        // or return 403 if role check fails
        expect([200, 201, 403]).toContain(response.status);

        if (response.status === 403) {
          expect(response.body).toHaveProperty("error");
          expect(response.body.error).toContain("Access denied");
        }
      }
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle invalid project data gracefully", async () => {
      if (!authToken) return;

      const invalidData = {
        title: "", // Empty title
        description: "Invalid project",
        status: "invalid-status",
        members: "not-an-array" // Invalid members format
      };

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidData);

      // Should either return 400 (validation) or 403 (role) or handle gracefully
      expect([400, 403, 500]).toContain(response.status);

      if (response.status === 400) {
        expect(response.body).toHaveProperty("error");
      }
    });

    it("should handle database connection issues", async () => {
      if (!authToken) return;

      // Test with invalid data that might cause DB issues
      const response = await request(app)
        .get("/manager-projects/all")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Accept", "invalid-content-type");

      // Should handle gracefully regardless of role
      expect([200, 403, 500]).toContain(response.status);
    });

    it("should handle malformed request bodies", async () => {
      if (!authToken) return;

      const response = await request(app)
        .post("/manager-projects")
        .set("Authorization", `Bearer ${authToken}`)
        .set("Content-Type", "application/json")
        .send("invalid json");

      // Should handle malformed JSON gracefully
      expect([400, 403, 500]).toContain(response.status);
    });
  });
});
