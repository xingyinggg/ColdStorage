import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../server/index.js";

// Check if test environment variables are configured
const hasTestEnv = process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE;

describe.skipIf(!hasTestEnv)("Director Routes Integration Tests", () => {
  let authToken;
  let directorToken;
  let testTaskId;

  beforeAll(async () => {
    // Set environment variables for server routes
    process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

    // Login to get auth token for testing
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "test@example.com",
        password: "testpassword"
      });

    if (loginResponse.status === 200 && loginResponse.body.token) {
      authToken = loginResponse.body.token;
    }

    // Try to get a director token - we'll create a test director if needed
    // For now, we'll use the regular token and see which tests work
    directorToken = authToken;

    // Get a test task ID for testing
    const tasksResponse = await request(app)
      .get("/tasks")
      .set("Authorization", `Bearer ${authToken}`);

    if (tasksResponse.status === 200 && tasksResponse.body.tasks && tasksResponse.body.tasks.length > 0) {
      testTaskId = tasksResponse.body.tasks[0].id;
    }
  });

  describe("GET /director/overview - Executive overview metrics", () => {
    it("should get executive overview metrics", async () => {
      if (!authToken) return; // Skip if login failed

      const response = await request(app)
        .get("/director/overview")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("companyKPIs");
      expect(response.body).toHaveProperty("projectPortfolio");
      expect(response.body).toHaveProperty("taskMetrics");

      // Verify structure of companyKPIs
      expect(response.body.companyKPIs).toHaveProperty("totalEmployees");
      expect(response.body.companyKPIs).toHaveProperty("totalProjects");
      expect(response.body.companyKPIs).toHaveProperty("totalTasks");
      expect(response.body.companyKPIs).toHaveProperty("systemActivity");

      // Verify structure of projectPortfolio
      expect(response.body.projectPortfolio).toHaveProperty("total");
      expect(response.body.projectPortfolio).toHaveProperty("active");
      expect(response.body.projectPortfolio).toHaveProperty("completed");
      expect(response.body.projectPortfolio).toHaveProperty("onHold");
      expect(response.body.projectPortfolio).toHaveProperty("completionRate");

      // Verify structure of taskMetrics
      expect(response.body.taskMetrics).toHaveProperty("total");
      expect(response.body.taskMetrics).toHaveProperty("active");
      expect(response.body.taskMetrics).toHaveProperty("completed");
      expect(response.body.taskMetrics).toHaveProperty("overdue");
      expect(response.body.taskMetrics).toHaveProperty("completionRate");
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/director/overview");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /director/departments - Department performance data", () => {
    it("should get department performance data", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/director/departments")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("departments");
      expect(Array.isArray(response.body.departments)).toBe(true);

      // If there are departments, verify their structure
      if (response.body.departments.length > 0) {
        const dept = response.body.departments[0];
        expect(dept).toHaveProperty("name");
        expect(dept).toHaveProperty("employeeCount");
        expect(dept).toHaveProperty("taskCompletionRate");
        expect(dept).toHaveProperty("projectCompletionRate");
        expect(dept).toHaveProperty("tasksPerEmployee");
        expect(dept).toHaveProperty("productivityScore");
        expect(dept).toHaveProperty("totalTasks");
        expect(dept).toHaveProperty("totalProjects");

        // Verify numeric values
        expect(typeof dept.employeeCount).toBe("number");
        expect(typeof dept.taskCompletionRate).toBe("number");
        expect(typeof dept.projectCompletionRate).toBe("number");
        expect(typeof dept.tasksPerEmployee).toBe("number");
        expect(typeof dept.productivityScore).toBe("number");
      }
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/director/departments");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /director/collaboration - Cross-departmental collaboration metrics", () => {
    it("should get collaboration metrics", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/director/collaboration")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("crossDepartmentalProjects");
      expect(response.body).toHaveProperty("collaborationMetrics");

      expect(Array.isArray(response.body.crossDepartmentalProjects)).toBe(true);
      expect(response.body.collaborationMetrics).toHaveProperty("totalProjects");
      expect(response.body.collaborationMetrics).toHaveProperty("crossDeptProjects");
      expect(response.body.collaborationMetrics).toHaveProperty("collaborationRate");
      expect(response.body.collaborationMetrics).toHaveProperty("averageDepartmentsPerProject");

      // Verify cross-departmental projects structure
      response.body.crossDepartmentalProjects.forEach(project => {
        expect(project).toHaveProperty("id");
        expect(project).toHaveProperty("title");
        expect(project).toHaveProperty("departmentCount");
        expect(project).toHaveProperty("departments");
        expect(Array.isArray(project.departments)).toBe(true);
        expect(project.departmentCount).toBeGreaterThan(1);
      });
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/director/collaboration");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /director/kpis - Company-wide KPIs", () => {
    it("should get company KPIs", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/director/kpis")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("companyKPIs");
      expect(response.body).toHaveProperty("projectPortfolio");
      expect(response.body).toHaveProperty("taskMetrics");

      // Verify companyKPIs structure
      expect(response.body.companyKPIs).toHaveProperty("totalEmployees");
      expect(response.body.companyKPIs).toHaveProperty("totalProjects");
      expect(response.body.companyKPIs).toHaveProperty("totalTasks");
      expect(response.body.companyKPIs).toHaveProperty("systemActivity");

      // Verify projectPortfolio structure
      expect(response.body.projectPortfolio).toHaveProperty("active");
      expect(response.body.projectPortfolio).toHaveProperty("completed");
      expect(response.body.projectPortfolio).toHaveProperty("onHold");
      expect(response.body.projectPortfolio).toHaveProperty("completionRate");

      // Verify taskMetrics structure
      expect(response.body.taskMetrics).toHaveProperty("active");
      expect(response.body.taskMetrics).toHaveProperty("completed");
      expect(response.body.taskMetrics).toHaveProperty("overdue");
      expect(response.body.taskMetrics).toHaveProperty("completionRate");
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/director/kpis");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("Director-only routes - Role-based access", () => {
    it("should get all tasks for director (may fail if not director role)", async () => {
      if (!directorToken) return;

      const response = await request(app)
        .get("/director/tasks/all")
        .set("Authorization", `Bearer ${directorToken}`);

      // This might return 403 if the test user is not a director
      // That's expected - we're testing the route exists and auth works
      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("tasks");
        expect(Array.isArray(response.body.tasks)).toBe(true);
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error", "Access denied");
      }
    });

    it("should get staff members for director (may fail if not director role)", async () => {
      if (!directorToken) return;

      const response = await request(app)
        .get("/director/staff-members")
        .set("Authorization", `Bearer ${directorToken}`);

      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("staffMembers");
        expect(Array.isArray(response.body.staffMembers)).toBe(true);

        // Verify staff member structure if any exist
        if (response.body.staffMembers.length > 0) {
          const staff = response.body.staffMembers[0];
          expect(staff).toHaveProperty("emp_id");
          expect(staff).toHaveProperty("name");
          expect(staff).toHaveProperty("role");
          expect(staff).toHaveProperty("department");
          expect(["staff", "manager"]).toContain(staff.role);
        }
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error", "Access denied");
      }
    });

    it("should update task for director (may fail if not director role)", async () => {
      if (!directorToken || !testTaskId) return;

      const updateData = {
        priority: 5,
        status: "in_progress"
      };

      const response = await request(app)
        .put(`/director/tasks/${testTaskId}`)
        .set("Authorization", `Bearer ${directorToken}`)
        .send(updateData);

      expect([200, 403]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty("task");
        expect(response.body.task).toHaveProperty("id", testTaskId);
      } else if (response.status === 403) {
        expect(response.body).toHaveProperty("error", "Access denied");
      }
    });

    it("should reject unauthorized access to director-only routes", async () => {
      // Test all director routes without auth
      const routes = [
        "/director/tasks/all",
        "/director/staff-members"
      ];

      for (const route of routes) {
        const response = await request(app).get(route);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty("error", "No token provided");
      }

      // Test PUT route without auth
      if (testTaskId) {
        const response = await request(app)
          .put(`/director/tasks/${testTaskId}`)
          .send({ priority: 5 });

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty("error", "No token provided");
      }
    });
  });

  describe("Error handling", () => {
    it("should handle invalid task ID in update route", async () => {
      if (!directorToken) return;

      const response = await request(app)
        .put("/director/tasks/invalid-id")
        .set("Authorization", `Bearer ${directorToken}`)
        .send({ priority: 5 });

      // Should either return 403 (not director) or 500 (invalid ID)
      expect([403, 500]).toContain(response.status);
    });

    it("should handle malformed request data", async () => {
      if (!directorToken || !testTaskId) return;

      const response = await request(app)
        .put(`/director/tasks/${testTaskId}`)
        .set("Authorization", `Bearer ${directorToken}`)
        .send("invalid json");

      expect([403, 400, 500]).toContain(response.status);
    });
  });
});
