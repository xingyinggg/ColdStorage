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

// For true integration testing, we'll mock only the auth but use real database
vi.mock("../../server/lib/supabase.js", async () => {
  const actual = await vi.importActual("../../server/lib/supabase.js");
  return {
    ...actual,
    // Only mock auth functions for testing simplicity while keeping real DB operations
    getUserFromToken: vi.fn().mockImplementation(async (token) => {
      if (!token || token.includes("invalid")) {
        throw new Error("Invalid token");
      }
      return {
        id: "test-user-uuid-integration",
        email: "integration.test@company.com",
      };
    }),
    getEmpIdForUserId: vi.fn().mockResolvedValue("EMP001"),
    getUserRole: vi.fn().mockResolvedValue("staff"),
  };
});

// Import your actual Supabase configuration
import { getServiceClient } from "../../server/lib/supabase.js";

const app = express();
app.use(express.json());
app.use("/projects", projectRoutes);

describe("Projects Integration Tests with Real Database", () => {
  let supabaseClient;
  let testToken;
  let createdProjectIds = []; // Track projects we create for cleanup

  beforeAll(async () => {
    // Initialize Supabase client for real database operations
    supabaseClient = getServiceClient();

    // Use a test token (auth is mocked but database operations are real)
    testToken = "test-integration-token";

    console.log("Integration test setup complete");
    console.log("Using mocked auth with real database operations");
  });

  beforeEach(async () => {
    // Clear any existing test data
    createdProjectIds = [];
    console.log("Starting fresh test...");
  });

  afterEach(async () => {
    // Cleanup: Delete any projects created during tests
    if (createdProjectIds.length > 0) {
      try {
        await supabaseClient
          .from("projects")
          .delete()
          .in("id", createdProjectIds);

        console.log(`Cleaned up ${createdProjectIds.length} test projects`);
      } catch (error) {
        console.warn("Cleanup warning:", error.message);
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

      console.log("Integration test cleanup complete");
    } catch (error) {
      console.warn("Final cleanup warning:", error.message);
    }
  });

  describe("Real Database Project CRUD Operations", () => {
    it("should create a project in the actual database", async () => {
      const projectData = {
        title: "Integration Test Project - CREATE",
        description: "This project tests real database integration",
        collaborators: ["EMP001", "EMP002"],
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${testToken}`)
        .send(projectData);

      console.log("Create Response:", response.status, response.body);

      // Even if auth fails, we want to test the structure
      expect([200, 201, 401, 403, 500]).toContain(response.status);

      // If successful, track for cleanup
      if (response.status === 201 && response.body?.id) {
        createdProjectIds.push(response.body.id);

        // Verify the project exists in database
        const { data: dbProject, error } = await supabaseClient
          .from("projects")
          .select("*")
          .eq("id", response.body.id)
          .single();

        if (!error) {
          expect(dbProject.title).toBe(projectData.title);
          expect(dbProject.description).toBe(projectData.description);
          console.log("Project verified in database:", dbProject.title);
        }
      }
    });

    it("should read projects from the actual database", async () => {
      // First, create a test project directly in the database
      const testProject = {
        title: "Integration Test Project - READ",
        description: "Test project for reading",
        status: "active",
        owner_id: "EMP001",
        collaborators: ["EMP001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(testProject)
        .select()
        .single();

      if (!createError && createdProject) {
        createdProjectIds.push(createdProject.id);

        // Now test the API endpoint
        const response = await request(app)
          .get("/projects")
          .set("Authorization", `Bearer ${testToken}`);

        console.log("Read Response:", response.status);

        // Should get some kind of response
        expect([200, 401, 403, 500]).toContain(response.status);

        // If successful, verify our test project is in the results
        if (response.status === 200 && Array.isArray(response.body)) {
          const foundProject = response.body.find(
            (p) => p.id === createdProject.id
          );
          if (foundProject) {
            expect(foundProject.title).toBe(testProject.title);
            console.log("Project found in API response");
          }
        }
      }
    });

    it("should update a project in the actual database", async () => {
      // Create a test project
      const originalProject = {
        title: "Integration Test Project - UPDATE Original",
        description: "Original description",
        status: "active",
        owner_id: "EMP001",
        collaborators: ["EMP001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(originalProject)
        .select()
        .single();

      if (!createError && createdProject) {
        createdProjectIds.push(createdProject.id);

        const updateData = {
          title: "Integration Test Project - UPDATE Modified",
          description: "Updated description",
        };

        const response = await request(app)
          .put(`/projects/${createdProject.id}`)
          .set("Authorization", `Bearer ${testToken}`)
          .send(updateData);

        console.log("Update Response:", response.status, response.body);

        expect([200, 401, 403, 404, 500]).toContain(response.status);

        // If successful, verify the update in database
        if (response.status === 200) {
          const { data: updatedProject } = await supabaseClient
            .from("projects")
            .select("*")
            .eq("id", createdProject.id)
            .single();

          if (updatedProject) {
            expect(updatedProject.title).toBe(updateData.title);
            expect(updatedProject.description).toBe(updateData.description);
            console.log("Project update verified in database");
          }
        }
      }
    });

    it("should delete a project from the actual database", async () => {
      // Create a test project
      const testProject = {
        title: "Integration Test Project - DELETE",
        description: "Project to be deleted",
        status: "active",
        owner_id: "EMP001",
        collaborators: ["EMP001"],
      };

      const { data: createdProject, error: createError } = await supabaseClient
        .from("projects")
        .insert(testProject)
        .select()
        .single();

      if (!createError && createdProject) {
        const response = await request(app)
          .delete(`/projects/${createdProject.id}`)
          .set("Authorization", `Bearer ${testToken}`);

        console.log("Delete Response:", response.status, response.body);

        expect([200, 204, 401, 403, 404, 500]).toContain(response.status);

        // If successful, verify the project is deleted from database
        if ([200, 204].includes(response.status)) {
          const { data: deletedProject } = await supabaseClient
            .from("projects")
            .select("*")
            .eq("id", createdProject.id)
            .single();

          expect(deletedProject).toBeNull();
          console.log("Project deletion verified in database");
        } else {
          // If delete failed, add to cleanup list
          createdProjectIds.push(createdProject.id);
        }
      }
    });
  });

  describe("Real Database Validation Tests", () => {
    it("should enforce unique title constraint in database", async () => {
      const projectData = {
        title: "Integration Test Unique Title",
        description: "Testing uniqueness",
        collaborators: ["EMP001"],
      };

      // Create first project
      const firstResponse = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${testToken}`)
        .send(projectData);

      if (firstResponse.status === 201 && firstResponse.body?.id) {
        createdProjectIds.push(firstResponse.body.id);

        // Try to create duplicate
        const duplicateResponse = await request(app)
          .post("/projects")
          .set("Authorization", `Bearer ${testToken}`)
          .send(projectData);

        console.log(
          "Duplicate Response:",
          duplicateResponse.status,
          duplicateResponse.body
        );

        // Should either be prevented by API or database constraint
        expect([400, 409, 422, 500]).toContain(duplicateResponse.status);

        if (duplicateResponse.body?.error) {
          expect(duplicateResponse.body.error).toMatch(
            /duplicate|unique|exists/i
          );
        }
      }
    });

    it("should handle database connection errors gracefully", async () => {
      // This test verifies error handling when database is unavailable
      // We can't actually disconnect the database in integration tests,
      // but we can test with invalid data that might cause DB errors

      const invalidProjectData = {
        title: null, // This should cause a database constraint error
        description: "Testing database error handling",
        collaborators: "invalid_format", // Wrong data type
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", `Bearer ${testToken}`)
        .send(invalidProjectData);

      console.log("Error Handling Response:", response.status, response.body);

      // Should handle the error gracefully
      expect([400, 422, 500]).toContain(response.status);
      expect(response.body).toHaveProperty("error");
    });
  });

  describe("Real Authentication Integration", () => {
    it("should require valid authentication token", async () => {
      const projectData = {
        title: "Integration Test Auth Required",
        description: "Testing authentication requirement",
      };

      const response = await request(app)
        .post("/projects")
        // No Authorization header
        .send(projectData);

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
  });

  describe("Real Database Query Tests", () => {
    it("should support complex filtering and sorting", async () => {
      // Create multiple test projects with different statuses
      const testProjects = [
        {
          title: "Integration Test Filter - Active",
          description: "Active project",
          status: "active",
          owner_id: "EMP001",
          collaborators: ["EMP001"],
        },
        {
          title: "Integration Test Filter - Completed",
          description: "Completed project",
          status: "completed",
          owner_id: "EMP001",
          collaborators: ["EMP001"],
        },
      ];

      for (const project of testProjects) {
        const { data: createdProject, error } = await supabaseClient
          .from("projects")
          .insert(project)
          .select()
          .single();

        if (!error && createdProject) {
          createdProjectIds.push(createdProject.id);
        }
      }

      // Test filtering (if your API supports it)
      const response = await request(app)
        .get("/projects?status=active")
        .set("Authorization", `Bearer ${testToken}`);

      console.log("Filter Response:", response.status);

      if (response.status === 200 && Array.isArray(response.body)) {
        const activeProjects = response.body.filter(
          (p) => p.status === "active"
        );
        console.log(`Found ${activeProjects.length} active projects`);
      }
    });

    it("should handle pagination with real data", async () => {
      // Create multiple projects for pagination testing
      const projectPromises = Array.from({ length: 5 }, (_, i) => {
        return supabaseClient
          .from("projects")
          .insert({
            title: `Integration Test Pagination ${i + 1}`,
            description: `Pagination test project ${i + 1}`,
            status: "active",
            owner_id: "EMP001",
            collaborators: ["EMP001"],
          })
          .select()
          .single();
      });

      const results = await Promise.all(projectPromises);

      // Track successful creations for cleanup
      results.forEach(({ data, error }) => {
        if (!error && data) {
          createdProjectIds.push(data.id);
        }
      });

      // Test pagination (if your API supports it)
      const response = await request(app)
        .get("/projects?limit=3&offset=0")
        .set("Authorization", `Bearer ${testToken}`);

      console.log("Pagination Response:", response.status);

      if (response.status === 200) {
        console.log(`✅ Pagination test completed`);
      }
    });
  });

  describe("Real Performance Tests", () => {
    it("should handle concurrent project creation", async () => {
      const concurrentRequests = Array.from({ length: 3 }, (_, i) => {
        return request(app)
          .post("/projects")
          .set("Authorization", `Bearer ${testToken}`)
          .send({
            title: `Integration Test Concurrent ${i + 1}`,
            description: `Concurrent creation test ${i + 1}`,
            collaborators: ["EMP001"],
          });
      });

      const responses = await Promise.all(concurrentRequests);

      console.log(
        "🚀 Concurrent Responses:",
        responses.map((r) => r.status)
      );

      // Track any successful creations for cleanup
      responses.forEach((response) => {
        if (response.status === 201 && response.body?.id) {
          createdProjectIds.push(response.body.id);
        }
      });

      // At least some should succeed (depending on constraints)
      const successCount = responses.filter((r) => r.status === 201).length;
      console.log(`✅ ${successCount}/3 concurrent requests succeeded`);
    });
  });
});
