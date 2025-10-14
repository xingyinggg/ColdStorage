// Load test environment variables FIRST (before any imports)
import dotenv from "dotenv";
import path from "path";

// Load test environment from tests/.env.test
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

// Validate test environment variables
if (!process.env.SUPABASE_TEST_URL || !process.env.SUPABASE_TEST_SERVICE_KEY) {
  throw new Error(
    "Test environment variables not loaded. Please check tests/.env.test file."
  );
}

// Override environment to force test database usage
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import request from "supertest";
import express from "express";
import projectRoutes from "../../server/routes/projects.js";
import { createClient } from "@supabase/supabase-js";

// Mock authentication functions with test users
import {
  getUserFromToken,
  getEmpIdForUserId,
  getUserRole,
} from "../../server/lib/supabase.js";

vi.mock("../../server/lib/supabase.js", async () => {
  const actual = await vi.importActual("../../server/lib/supabase.js");
  return {
    ...actual,
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
    getUserRole: vi.fn(),
  };
});

// Create test database client
function getTestSupabaseClient() {
  return createClient(
    process.env.SUPABASE_TEST_URL,
    process.env.SUPABASE_TEST_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

const app = express();
app.use(express.json());
app.use("/projects", projectRoutes);

describe("Projects Integration Tests with Test Database", () => {
  let supabaseClient;
  let staffToken;
  let managerToken;
  let createdProjectIds = [];

  beforeAll(async () => {
    console.log("Setting up projects integration tests...");

    // Initialize test database client
    supabaseClient = getTestSupabaseClient();

    // Setup test tokens
    staffToken = "test-staff-token";
    managerToken = "test-manager-token";

    // Configure authentication mocks for different user types
    vi.mocked(getUserFromToken).mockImplementation(async (token) => {
      if (token.includes("manager")) {
        return {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "manager@example.com",
        };
      }
      if (token.includes("invalid")) {
        throw new Error("Invalid token");
      }
      return {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "staff@example.com",
      };
    });

    vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
      if (userId === "550e8400-e29b-41d4-a716-446655440002") {
        return "TEST002"; // Manager
      }
      return "TEST001"; // Staff
    });

    vi.mocked(getUserRole).mockImplementation(async (empId) => {
      if (empId === "TEST002") {
        return "manager";
      }
      return "staff";
    });

    console.log("Projects integration test setup complete");
  });

  beforeEach(async () => {
    // Clear tracking arrays
    createdProjectIds = [];

    // Clear all mocks
    vi.clearAllMocks();

    // Re-setup mocks for each test
    vi.mocked(getUserFromToken).mockImplementation(async (token) => {
      if (token.includes("manager")) {
        return {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "manager@example.com",
        };
      }
      if (token.includes("invalid")) {
        throw new Error("Invalid token");
      }
      return {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "staff@example.com",
      };
    });

    vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
      if (userId === "550e8400-e29b-41d4-a716-446655440002") {
        return "TEST002";
      }
      return "TEST001";
    });

    vi.mocked(getUserRole).mockImplementation(async (empId) => {
      if (empId === "TEST002") {
        return "manager";
      }
      return "staff";
    });

    console.log("Starting fresh project test...");
  });

  afterEach(async () => {
    // Cleanup created projects
    if (createdProjectIds.length > 0) {
      try {
        await supabaseClient
          .from("projects")
          .delete()
          .in("id", createdProjectIds);

        console.log(`Cleaned up ${createdProjectIds.length} test projects`);
      } catch (error) {
        console.warn("Project cleanup warning:", error.message);
      }
    }
  });

  afterAll(async () => {
    // Final cleanup - remove any test data that might be left
    try {
      await supabaseClient
        .from("projects")
        .delete()
        .ilike("title", "%integration test%");

      console.log("Projects integration test cleanup complete");
    } catch (error) {
      console.warn("Final project cleanup warning:", error.message);
    }
  });

  describe("Environment and Database Verification", () => {
    it("should have test environment variables loaded", () => {
      expect(process.env.SUPABASE_TEST_URL).toBeTruthy();
      expect(process.env.SUPABASE_TEST_SERVICE_KEY).toBeTruthy();
      expect(process.env.SUPABASE_URL).toBe(process.env.SUPABASE_TEST_URL);
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBe(
        process.env.SUPABASE_TEST_SERVICE_KEY
      );
    });

    it("should be using test database", async () => {
      const { data, error } = await supabaseClient
        .from("projects")
        .select("count", { count: "exact" });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      console.log("Connected to test database successfully");
    });
  });

  describe("Mock Verification", () => {
    it("should have properly mocked auth functions", async () => {
      // Test staff user
      const staffUser = await getUserFromToken(staffToken);
      expect(staffUser.email).toBe("staff@example.com");

      const staffEmpId = await getEmpIdForUserId(staffUser.id);
      expect(staffEmpId).toBe("TEST001");

      const staffRole = await getUserRole(staffEmpId);
      expect(staffRole).toBe("staff");

      // Test manager user
      const managerUser = await getUserFromToken(managerToken);
      expect(managerUser.email).toBe("manager@example.com");

      const managerEmpId = await getEmpIdForUserId(managerUser.id);
      expect(managerEmpId).toBe("TEST002");

      const managerRole = await getUserRole(managerEmpId);
      expect(managerRole).toBe("manager");

      console.log("All auth mocks working correctly");
    });
  });

  describe("Test Database Project CRUD Operations", () => {
    it("should create a project in the test database", async () => {
      const projectData = {
        title: "Integration Test Project - CREATE",
        description: "This project tests database integration",
        members: ["TEST001", "TEST002"],
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(projectData);

      console.log("Create Response:", response.status, response.body);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.title).toBe(projectData.title);
      expect(response.body.owner_id).toBe("TEST001");

      // Track for cleanup
      createdProjectIds.push(response.body.id);

      // Verify in test database
      const { data: dbProject, error } = await supabaseClient
        .from("projects")
        .select("*")
        .eq("id", response.body.id)
        .single();

      expect(error).toBeNull();
      expect(dbProject.title).toBe(projectData.title);
      expect(dbProject.description).toBe(projectData.description);
      console.log("Project verified in test database:", dbProject.title);
    });

    it("should read projects from the test database", async () => {
      // Create test project directly in test database
      const testProject = {
        title: "Integration Test Project - READ",
        description: "Test project for reading",
        status: "active",
        owner_id: "TEST001",
        members: ["TEST001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(testProject)
        .select()
        .single();

      expect(createError).toBeNull();
      expect(createdProject).toBeDefined();
      createdProjectIds.push(createdProject.id);

      // Test API endpoint
      const response = await request(app)
        .get("/projects")
        .set("Authorization", `Bearer ${staffToken}`);

      console.log("Read Response:", response.status);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Verify our test project is in the results
      const foundProject = response.body.find(
        (p) => p.id === createdProject.id
      );
      expect(foundProject).toBeDefined();
      expect(foundProject.title).toBe(testProject.title);
      console.log("Project found in API response");
    });

    it("should update a project in the test database", async () => {
      // Create test project
      const originalProject = {
        title: "Integration Test Project - UPDATE Original",
        description: "Original description",
        status: "active",
        owner_id: "TEST001",
        members: ["TEST001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(originalProject)
        .select()
        .single();

      expect(createError).toBeNull();
      createdProjectIds.push(createdProject.id);

      const updateData = {
        title: "Integration Test Project - UPDATE Modified",
        description: "Updated description",
      };

      const response = await request(app)
        .put(`/projects/${createdProject.id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .send(updateData);

      console.log("Update Response:", response.status, response.body);

      expect(response.status).toBe(200);

      // Verify update in test database
      const { data: updatedProject } = await supabaseClient
        .from("projects")
        .select("*")
        .eq("id", createdProject.id)
        .single();

      expect(updatedProject.title).toBe(updateData.title);
      expect(updatedProject.description).toBe(updateData.description);
      console.log("Project update verified in test database");
    });

    it("should delete a project from the test database", async () => {
      // Create test project
      const testProject = {
        title: "Integration Test Project - DELETE",
        description: "Project to be deleted",
        status: "active",
        owner_id: "TEST001",
        members: ["TEST001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(testProject)
        .select()
        .single();

      expect(createError).toBeNull();

      const response = await request(app)
        .delete(`/projects/${createdProject.id}`)
        .set("Authorization", `Bearer ${staffToken}`);

      console.log("Delete Response:", response.status, response.body);

      expect([200, 204]).toContain(response.status);

      // Verify deletion in test database
      const { data: deletedProject } = await supabaseClient
        .from("projects")
        .select("*")
        .eq("id", createdProject.id)
        .single();

      expect(deletedProject).toBeNull();
      console.log("Project deletion verified in test database");
    });
  });

  describe("Test Database Validation Tests", () => {
    it("should enforce unique title constraint in test database", async () => {
      const projectData = {
        title: "Integration Test Unique Title",
        description: "Testing uniqueness",
        members: ["TEST001"],
      };

      // Create first project
      const firstResponse = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(projectData);

      expect(firstResponse.status).toBe(201);
      createdProjectIds.push(firstResponse.body.id);

      // Try to create duplicate
      const duplicateResponse = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(projectData);

      console.log(
        "Duplicate Response:",
        duplicateResponse.status,
        duplicateResponse.body
      );

      expect([400, 409, 422, 500]).toContain(duplicateResponse.status);
      expect(duplicateResponse.body.error).toMatch(/duplicate|unique|exists/i);
    });

    it("should reject project creation with excessively long title", async () => {
      const projectData = {
        title:
          "This is a very long project title that exceeds reasonable limits ".repeat(
            10
          ),
        description: "Testing long title rejection",
        members: ["TEST001"],
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(projectData);

      console.log("Long Title Response:", response.status, response.body);

      expect([400, 413, 422]).toContain(response.status);
      expect(response.body.error).toMatch(
        /title.*long|length|characters|limit/i
      );
    });

    it("should handle invalid data gracefully", async () => {
      const invalidProjectData = {
        title: null,
        description: "Testing error handling",
        members: "invalid_format",
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(invalidProjectData);

      console.log("Error Handling Response:", response.status, response.body);

      expect([400, 422, 500]).toContain(response.status);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Test Authentication Integration", () => {
    it("should require valid authentication token", async () => {
      const projectData = {
        title: "Integration Test Auth Required",
        description: "Testing authentication requirement",
      };

      const response = await request(app).post("/projects").send(projectData);

      console.log("No Auth Response:", response.status, response.body);

      expect([401, 403]).toContain(response.status);
    });

    it("should reject invalid authentication token", async () => {
      const projectData = {
        title: "Integration Test Invalid Auth",
        description: "Testing invalid token rejection",
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer invalid-token-12345")
        .send(projectData);

      console.log("Invalid Auth Response:", response.status, response.body);

      expect([401, 403, 500]).toContain(response.status);
    });

    it("should allow different user roles", async () => {
      const staffProjectData = {
        title: "Staff Project",
        description: "Project created by staff",
        members: ["TEST001"],
      };

      const managerProjectData = {
        title: "Manager Project",
        description: "Project created by manager",
        members: ["TEST002"],
      };

      // Test staff user
      const staffResponse = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(staffProjectData);

      expect(staffResponse.status).toBe(201);
      expect(staffResponse.body.owner_id).toBe("TEST001");
      createdProjectIds.push(staffResponse.body.id);

      // Test manager user
      const managerResponse = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${managerToken}`)
        .send(managerProjectData);

      expect(managerResponse.status).toBe(201);
      expect(managerResponse.body.owner_id).toBe("TEST002");
      createdProjectIds.push(managerResponse.body.id);

      console.log("Both staff and manager can create projects");
    });
  });

  describe("Test Database Query and Performance Tests", () => {
    it("should support filtering and sorting with test data", async () => {
      // Create multiple test projects with different statuses
      const testProjects = [
        {
          title: "Integration Test Filter - Active",
          description: "Active project",
          status: "active",
          owner_id: "TEST001",
          members: ["TEST001"],
        },
        {
          title: "Integration Test Filter - Completed",
          description: "Completed project",
          status: "completed",
          owner_id: "TEST001",
          members: ["TEST001"],
        },
      ];

      for (const project of testProjects) {
        const { data: createdProject, error } = await supabaseClient
          .from("projects")
          .insert(project)
          .select()
          .single();

        expect(error).toBeNull();
        createdProjectIds.push(createdProject.id);
      }

      // Test filtering
      const response = await request(app)
        .get("/projects?status=active")
        .set("Authorization", `Bearer ${staffToken}`);

      console.log("Filter Response:", response.status);

      if (response.status === 200) {
        const activeProjects = response.body.filter(
          (p) => p.status === "active"
        );
        console.log(`Found ${activeProjects.length} active projects`);
        expect(activeProjects.length).toBeGreaterThan(0);
      }
    });

    it("should handle concurrent project creation", async () => {
      const concurrentRequests = Array.from({ length: 3 }, (_, i) => {
        return request(app)
          .post("/projects")
          .set("Authorization", `Bearer ${staffToken}`)
          .send({
            title: `Integration Test Concurrent ${i + 1}`,
            description: `Concurrent creation test ${i + 1}`,
            members: ["TEST001"],
          });
      });

      const responses = await Promise.all(concurrentRequests);

      console.log(
        "Concurrent Responses:",
        responses.map((r) => r.status)
      );

      // Track successful creations for cleanup
      responses.forEach((response) => {
        if (response.status === 201 && response.body?.id) {
          createdProjectIds.push(response.body.id);
        }
      });

      const successCount = responses.filter((r) => r.status === 201).length;
      console.log(`${successCount}/3 concurrent requests succeeded`);
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
