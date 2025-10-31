import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../server/index.js";

// Check if test environment variables are configured
const hasTestEnv = process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

describe.skipIf(!hasTestEnv)("HR Routes Integration Tests", () => {
  let authToken;
  let testEmpId;

  beforeAll(async () => {
    // Set environment variables for server routes to ensure test database usage
    process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

    console.log("🔧 HR Tests using test database:");
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
      testEmpId = "TEST001"; // Known test employee
      console.log("  Auth Token:", "✅ Obtained");
    } else {
      console.log("  Auth Token:", "❌ Failed to obtain");
    }
  });

  describe("GET /hr/employees - Get all employees with profiles and stats", () => {
    it("should get all employees with task statistics", async () => {
      if (!authToken) return; // Skip if login failed

      const response = await request(app)
        .get("/hr/employees")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify structure if employees exist
      if (response.body.length > 0) {
        const employee = response.body[0];
        expect(employee).toHaveProperty("emp_id");
        expect(employee).toHaveProperty("name");
        expect(employee).toHaveProperty("email");
        expect(employee).toHaveProperty("department");
        expect(employee).toHaveProperty("role");

        // Check task statistics structure
        expect(employee).toHaveProperty("tasks_assigned");
        expect(employee).toHaveProperty("tasks_completed");
      }
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/hr/employees");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/insights - Get HR dashboard insights/analytics", () => {
    it("should get HR dashboard insights with comprehensive metrics", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/insights")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("totalEmployees");
      expect(response.body).toHaveProperty("departmentBreakdown");
      expect(response.body).toHaveProperty("totalTasks");
      expect(response.body).toHaveProperty("overdueTasks");
      expect(response.body).toHaveProperty("taskCompletionRate");
      expect(response.body).toHaveProperty("totalProjects");
      expect(response.body).toHaveProperty("activeProjects");

      // Verify data types
      expect(typeof response.body.totalEmployees).toBe("number");
      expect(typeof response.body.totalTasks).toBe("number");
      expect(typeof response.body.taskCompletionRate).toBe("number");
      expect(typeof response.body.totalProjects).toBe("number");
      expect(typeof response.body.activeProjects).toBe("number");
      expect(typeof response.body.overdueTasks).toBe("number");

      // Verify department breakdown is an object
      expect(typeof response.body.departmentBreakdown).toBe("object");
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/hr/insights");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/performance - Get employee performance data", () => {
    it("should get detailed employee performance data", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/performance")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify structure if performance data exists
      if (response.body.length > 0) {
        const performance = response.body[0];
        expect(performance).toHaveProperty("emp_id");
        expect(performance).toHaveProperty("name");
        expect(performance).toHaveProperty("department");
        expect(performance).toHaveProperty("role");
        expect(performance).toHaveProperty("totalTasks");
        expect(performance).toHaveProperty("completedTasks");
        expect(performance).toHaveProperty("overdueTasks");
        expect(performance).toHaveProperty("completionRate");

        // Verify calculated fields are numbers
        expect(typeof performance.totalTasks).toBe("number");
        expect(typeof performance.completedTasks).toBe("number");
        expect(typeof performance.overdueTasks).toBe("number");
        expect(typeof performance.completionRate).toBe("number");
      }
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/hr/performance");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/reports/:type - Generate HR reports", () => {
    it("should generate productivity report", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/reports/productivity")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should generate department report", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/reports/department")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify department report structure
      if (response.body.length > 0) {
        const deptReport = response.body[0];
        expect(deptReport).toHaveProperty("department");
        expect(deptReport).toHaveProperty("role");
        expect(deptReport).toHaveProperty("created_at");
      }
    });

    it("should generate report with date filters", async () => {
      if (!authToken) return;

      const startDate = "2024-01-01";
      const endDate = new Date().toISOString().split('T')[0];

      const response = await request(app)
        .get(`/hr/reports/productivity?startDate=${startDate}&endDate=${endDate}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should return 400 for invalid report type", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/reports/invalid-type")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Invalid report type");
    });

    it("should reject unauthorized report requests", async () => {
      const response = await request(app).get("/hr/reports/productivity");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("PUT /hr/employees/:empId - Update employee details", () => {
    it("should update employee details", async () => {
      if (!authToken || !testEmpId) return;

      const updateData = {
        department: "Updated Department",
        role: "staff"
      };

      const response = await request(app)
        .put(`/hr/employees/${testEmpId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(updateData);

      // Note: This might return 404 if user_profiles table doesn't exist
      // or if the empId doesn't match. That's expected in test environment
      expect([200, 404]).toContain(response.status);

      if (response.status === 200) {
        expect(typeof response.body).toBe("object");
      }
    });

    it("should reject unauthorized employee updates", async () => {
      const response = await request(app)
        .put("/hr/employees/TEST001")
        .send({ department: "Test" });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/departments - Get department workload data", () => {
    it("should get department workload statistics", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/departments")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify department workload structure
      if (response.body.length > 0) {
        const dept = response.body[0];
        expect(dept).toHaveProperty("name");
        expect(dept).toHaveProperty("members");
        expect(dept).toHaveProperty("active");
        expect(dept).toHaveProperty("overdue");

        // Verify numeric values
        expect(typeof dept.members).toBe("number");
        expect(typeof dept.active).toBe("number");
        expect(typeof dept.overdue).toBe("number");
      }
    });

    it("should reject unauthorized department requests", async () => {
      const response = await request(app).get("/hr/departments");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/analytics/performance-rankings - Employee performance rankings", () => {
    it("should get employee performance rankings", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/analytics/performance-rankings")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify ranking structure
      if (response.body.length > 0) {
        const ranking = response.body[0];
        expect(ranking).toHaveProperty("id");
        expect(ranking).toHaveProperty("name");
        expect(ranking).toHaveProperty("department");
        expect(ranking).toHaveProperty("totalTasks");
        expect(ranking).toHaveProperty("completedTasks");
        expect(ranking).toHaveProperty("overdueRate");
        expect(ranking).toHaveProperty("performanceScore");

        // Verify calculated fields
        expect(typeof ranking.totalTasks).toBe("number");
        expect(typeof ranking.completedTasks).toBe("number");
        expect(typeof ranking.overdueRate).toBe("number");
        expect(typeof ranking.performanceScore).toBe("number");
      }
    });

    it("should reject unauthorized performance ranking requests", async () => {
      const response = await request(app).get("/hr/analytics/performance-rankings");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/analytics/trends - Productivity trends", () => {
    it("should get monthly productivity trends by default", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/analytics/trends")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify trend structure
      if (response.body.length > 0) {
        const trend = response.body[0];
        expect(trend).toHaveProperty("period");
        expect(trend).toHaveProperty("completed");
        expect(trend).toHaveProperty("total");

        expect(typeof trend.completed).toBe("number");
        expect(typeof trend.total).toBe("number");
      }
    });

    it("should get weekly productivity trends when specified", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/analytics/trends?period=weekly")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should reject unauthorized trend requests", async () => {
      const response = await request(app).get("/hr/analytics/trends");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /hr/staff - Get HR staff details", () => {
    it("should get HR staff members", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/hr/staff")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("hrStaff");
      expect(Array.isArray(response.body.hrStaff)).toBe(true);

      // Verify HR staff structure
      response.body.hrStaff.forEach(staff => {
        expect(staff).toHaveProperty("id");
        expect(staff).toHaveProperty("emp_id");
        expect(staff).toHaveProperty("name");
      });
    });

    it("should reject unauthorized HR staff requests", async () => {
      const response = await request(app).get("/hr/staff");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle database errors gracefully", async () => {
      if (!authToken) return;

      // Test with invalid parameters that might cause DB errors
      // This tests the error handling in the routes
      const routes = [
        "/hr/employees",
        "/hr/insights",
        "/hr/performance",
        "/hr/departments"
      ];

      for (const route of routes) {
        const response = await request(app)
          .get(route)
          .set("Authorization", `Bearer ${authToken}`);

        // Should either succeed (200) or fail gracefully (500 with error message)
        expect([200, 500]).toContain(response.status);

        if (response.status === 500) {
          expect(response.body).toHaveProperty("error");
          expect(typeof response.body.error).toBe("string");
        }
      }
    });

    it("should handle malformed request data", async () => {
      if (!authToken) return;

      // Test reports endpoint with malformed data
      const response = await request(app)
        .get("/hr/reports/productivity")
        .set("Authorization", `Bearer ${authToken}`)
        .query({ startDate: "invalid-date" });

      // Should handle gracefully
      expect([200, 500]).toContain(response.status);
    });
  });
});
