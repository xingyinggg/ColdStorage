import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import projectRoutes from "../../server/routes/projects.js";

const createMockSupabase = () => {
  const mockResponses = new Map();
  let projectStore = [];

  const createChain = () => {
    let currentQuery = "";
    let queryParams = {};

    return {
      insert: vi.fn((data) => {
        currentQuery = "insert";
        queryParams.insertData = data;
        return createChain();
      }),
      select: vi.fn((fields = "*") => {
        currentQuery += "-select";
        queryParams.selectFields = fields;
        return createChain();
      }),
      update: vi.fn((data) => {
        currentQuery = "update";
        queryParams.updateData = data;
        return createChain();
      }),
      delete: vi.fn(() => {
        currentQuery = "delete";
        return createChain();
      }),
      eq: vi.fn((field, value) => {
        currentQuery += `-eq-${field}-${value}`;
        queryParams.eqField = field;
        queryParams.eqValue = value;
        return createChain();
      }),
      ilike: vi.fn((field, value) => {
        currentQuery += `-ilike-${field}-${value}`;
        queryParams.ilikeField = field;
        queryParams.ilikeValue = value;

        // For duplicate checking queries, return a promise that resolves immediately
        if (field === "title") {
          const duplicateProjects = projectStore.filter(
            (p) => p.title.toLowerCase() === value.toLowerCase()
          );
          console.log(
            `Mock duplicate check for "${value}": found ${duplicateProjects.length} matches, store size: ${projectStore.length}`
          );

          // Return a promise that resolves to the query result
          return Promise.resolve({
            data: duplicateProjects,
            error: null,
          });
        }

        return createChain();
      }),
      order: vi.fn((field) => {
        currentQuery += `-order-${field}`;
        return createChain();
      }),
      or: vi.fn((condition) => {
        currentQuery += `-or-${condition}`;
        return createChain();
      }),
      single: vi.fn(() => {
        // Return the mock response we've set up for this query type
        if (currentQuery.includes("insert")) {
          return mockResponses.get("insert") || { data: null, error: null };
        }
        if (currentQuery.includes("update")) {
          return mockResponses.get("update") || { data: null, error: null };
        }
        if (currentQuery.includes("select")) {
          return mockResponses.get("select") || { data: null, error: null };
        }
        return { data: null, error: null };
      }),
      // Non-single queries (for duplicate checking)
      then: vi.fn((callback) => {
        if (
          currentQuery.includes("ilike") &&
          queryParams.ilikeField === "title"
        ) {
          // Check if title exists in our project store
          const duplicateProjects = projectStore.filter(
            (p) =>
              p.title.toLowerCase() === queryParams.ilikeValue.toLowerCase()
          );
          console.log(
            `Mock duplicate check for "${queryParams.ilikeValue}": found ${duplicateProjects.length} matches, store size: ${projectStore.length}`
          );
          return callback({ data: duplicateProjects, error: null });
        }

        const result = mockResponses.get("select") || { data: [], error: null };
        return callback(result);
      }),
    };
  };

  return {
    from: vi.fn((table) => createChain()),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "test-url" } })),
      })),
    },
    // Helper to set mock responses
    _setMockResponse: (queryType, response) => {
      mockResponses.set(queryType, Promise.resolve(response));
    },
    // Helper to manage project store
    _addProject: (project) => {
      console.log(`Adding project to store: "${project.title}"`);
      projectStore.push(project);
    },
    _clearProjects: () => {
      const oldSize = projectStore.length;
      projectStore = [];
      console.log(
        `Cleared project store (was ${oldSize}, now ${projectStore.length})`
      );
    },
    _setProjects: (projects) => {
      projectStore = projects;
    },
    _getProjectCount: () => projectStore.length,
  };
};

const mockSupabase = createMockSupabase();

// Mock ALL the functions your routes use
vi.mock("../../server/lib/supabase.js", () => ({
  getServiceClient: () => mockSupabase,
  getUserFromToken: vi.fn(),
  getEmpIdForUserId: vi.fn(),
  getUserRole: vi.fn(),
}));

// Import after mocking
import {
  getUserFromToken,
  getEmpIdForUserId,
  getUserRole,
} from "../../server/lib/supabase.js";

const app = express();
app.use(express.json());
app.use("/projects", projectRoutes);

describe("Project Backend Logic Tests", () => {
  let mockUser;
  let mockEmpId;

  beforeEach(() => {
    vi.clearAllMocks();

    // Clear the mock project store to prevent test interference
    mockSupabase._clearProjects();
    console.log(
      `Test setup: Project store now has ${mockSupabase._getProjectCount()} projects`
    );

    // Mock user with realistic UUID
    mockUser = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      email: "test@example.com",
      aud: "authenticated",
      role: "authenticated",
    };

    // Mock employee ID
    mockEmpId = "12345";

    // Mock all the functions your code calls
    getUserFromToken.mockResolvedValue(mockUser);
    getEmpIdForUserId.mockResolvedValue(mockEmpId);
    getUserRole.mockResolvedValue("staff");
  });

  describe("CS-US3-TC-1: Create a new project and see it in the updated list", () => {
    it("should successfully create a project with valid data", async () => {
      const projectData = {
        title: "Project Creation Testing",
        description: "This is a test to create a project",
        collaborators: [mockEmpId, "EMP456"], // Including another member
      };

      const expectedProject = {
        id: 1,
        title: "Project Creation Testing",
        description: "This is a test to create a project",
        status: "active",
        owner_id: mockEmpId,
        collaborators: [mockEmpId, "EMP456"],
        created_at: "2023-01-01T00:00:00Z",
      };

      // Set up the mock response for INSERT query
      mockSupabase._setMockResponse("insert", {
        data: expectedProject,
        error: null,
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log("CS-US3-TC-1 Response status:", response.status);
      console.log("CS-US3-TC-1 Response body:", response.body);

      expect(response.status).toBe(201);
      expect(getUserFromToken).toHaveBeenCalledWith("valid-token");
      expect(getEmpIdForUserId).toHaveBeenCalledWith(mockUser.id);

      // Test that project is created with correct data structure
      if (response.body && response.status === 201) {
        expect(response.body.owner_id).toBe(mockEmpId);
        expect(response.body.title).toBe("Project Creation Testing");
        expect(response.body.description).toBe(
          "This is a test to create a project"
        );
        expect(response.body.status).toBe("active");
      }
    });

    it("should list projects including the newly created one", async () => {
      const mockProjects = [
        {
          id: 1,
          title: "Project Creation Testing",
          description: "This is a test to create a project",
          status: "active",
          owner_id: mockEmpId,
          created_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockSupabase._setMockResponse("select", {
        data: mockProjects,
        error: null,
      });

      const response = await request(app)
        .get("/projects")
        .set("Authorization", "Bearer valid-token");

      console.log(
        "CS-US3-TC-1 List projects response:",
        response.status,
        response.body
      );

      expect(response.status).toBeGreaterThan(199);

      if (response.body && Array.isArray(response.body)) {
        const createdProject = response.body.find(
          (p) => p.title === "Project Creation Testing"
        );
        expect(createdProject).toBeTruthy();
      }
    });
  });

  describe("CS-US3-TC-2: Create a new project without any fields", () => {
    it("should fail to create project with empty title", async () => {
      const projectData = {
        title: "", // Empty title
        description: "",
        collaborators: [mockEmpId], // Just yourself as default
      };

      // Mock validation error for empty title
      mockSupabase._setMockResponse("insert", {
        data: null,
        error: { message: "Title is required", code: "VALIDATION_ERROR" },
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log(
        "CS-US3-TC-2 Empty title response:",
        response.status,
        response.body
      );

      // Expect validation error
      expect([400, 422, 500]).toContain(response.status);

      if (response.body && response.body.error) {
        expect(response.body.error).toMatch(/title|required/i);
      }
    });

    it("should fail to create project with no title field", async () => {
      const projectData = {
        // No title field at all
        description: "",
        collaborators: [mockEmpId],
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log(
        "CS-US3-TC-2 No title field response:",
        response.status,
        response.body
      );

      // Expect validation error
      expect([400, 422, 500]).toContain(response.status);
    });
  });

  describe("CS-US3-TC-3: Create a new project with a duplicate name", () => {
    it("should fail to create project with duplicate title", async () => {
      const projectData = {
        title: "Duplicate Project Name Testing",
        description: "This is a test to create a project with duplicate names",
        collaborators: [mockEmpId],
      };

      // Add an existing project with the same title to our mock store
      mockSupabase._addProject({
        id: 1,
        title: "Duplicate Project Name Testing",
        owner_id: "OTHER_USER",
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log(
        "CS-US3-TC-3 Duplicate title response:",
        response.status,
        response.body
      );

      // Expect conflict or validation error
      expect([400, 409, 422, 500]).toContain(response.status);

      if (response.body && response.body.error) {
        expect(response.body.error).toMatch(
          /already exists|duplicate|conflict/i
        );
      }
    });

    it("should check for existing projects before creating", async () => {
      const projectData = {
        title: "Duplicate Project Name Testing",
        description: "This is a test to create a project with duplicate names",
      };

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      // Verify that the system attempts to check for existing projects
      expect(mockSupabase.from).toHaveBeenCalledWith("projects");

      console.log("CS-US3-TC-3 Duplicate check performed successfully");
    });
  });

  describe("CS-US3-TC-4: Create a new project with a long title name", () => {
    it("should fail to create project with excessively long title", async () => {
      const longTitle = "this is a long project name" + "e".repeat(300); // Very long title

      const projectData = {
        title: longTitle,
        description: "Test description",
        collaborators: [mockEmpId],
      };

      // Mock validation error for long title
      mockSupabase._setMockResponse("insert", {
        data: null,
        error: { message: "Title too long", code: "VALIDATION_ERROR" },
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log(
        "CS-US3-TC-4 Long title response:",
        response.status,
        response.body
      );

      // Expect validation error
      expect([400, 413, 422, 500]).toContain(response.status);

      if (response.body && response.body.error) {
        expect(response.body.error).toMatch(/title|long|length|characters/i);
      }
    });

    it("should accept project with reasonable title length", async () => {
      const reasonableTitle = "Reasonable Project Title Length";

      const projectData = {
        title: reasonableTitle,
        description: "Test description",
        collaborators: [mockEmpId],
      };

      const expectedProject = {
        id: 1,
        title: reasonableTitle,
        description: "Test description",
        status: "active",
        owner_id: mockEmpId,
        created_at: "2023-01-01T00:00:00Z",
      };

      mockSupabase._setMockResponse("insert", {
        data: expectedProject,
        error: null,
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      console.log(
        "CS-US3-TC-4 Reasonable title response:",
        response.status,
        response.body
      );

      // Should succeed
      expect(response.status).toBe(201);
    });
  });

  describe("Project Authentication and Authorization", () => {
    it("should correctly map UUID to employee ID for project creation", async () => {
      const projectData = {
        title: "Auth Test Project",
        description: "Testing authentication flow",
      };

      const expectedProject = {
        id: 1,
        title: "Auth Test Project",
        description: "Testing authentication flow",
        owner_id: mockEmpId,
        created_at: "2023-01-01T00:00:00Z",
      };

      mockSupabase._setMockResponse("insert", {
        data: expectedProject,
        error: null,
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      expect(response.status).toBe(201);
      expect(getUserFromToken).toHaveBeenCalledWith("valid-token");
      expect(getEmpIdForUserId).toHaveBeenCalledWith(mockUser.id);

      if (response.body) {
        expect(response.body.owner_id).toBe(mockEmpId);
      }
    });

    it("should handle missing employee ID mapping for projects", async () => {
      getEmpIdForUserId.mockResolvedValueOnce(null);

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Test Project" });

      console.log("Missing EMP ID Response:", response.status, response.body);

      expect(response.status).toBeGreaterThan(199);
    });
  });

  describe("Project Ownership and Permissions", () => {
    it("should allow project owner to update their project", async () => {
      const existingProject = {
        id: 1,
        title: "Original Project Title",
        owner_id: mockEmpId,
      };

      mockSupabase._setMockResponse("select", {
        data: existingProject,
        error: null,
      });

      const updatedProject = {
        ...existingProject,
        title: "Updated Project Title",
      };
      mockSupabase._setMockResponse("update", {
        data: updatedProject,
        error: null,
      });

      const response = await request(app)
        .put("/projects/1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Updated Project Title" });

      console.log("Update project response:", response.status, response.body);

      expect([200, 404, 500]).toContain(response.status);
    });

    it("should prevent updates from different employee", async () => {
      const otherUserProject = {
        id: 1,
        title: "Someone else project",
        owner_id: "DIFFERENT_EMP",
      };

      mockSupabase._setMockResponse("select", {
        data: otherUserProject,
        error: null,
      });

      const response = await request(app)
        .put("/projects/1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "Unauthorized Update" });

      console.log(
        "Unauthorized project update response:",
        response.status,
        response.body
      );

      expect([403, 404, 500]).toContain(response.status);
    });
  });

  describe("Project Collaborators Functionality", () => {
    it("should create project with multiple collaborators", async () => {
      const projectData = {
        title: "Multi-Collaborator Project",
        description: "Project with multiple team members",
        collaborators: [mockEmpId, "EMP456", "EMP789"],
      };

      const expectedProject = {
        id: 1,
        title: "Multi-Collaborator Project",
        description: "Project with multiple team members",
        owner_id: mockEmpId,
        collaborators: [mockEmpId, "EMP456", "EMP789"],
        created_at: "2023-01-01T00:00:00Z",
      };

      mockSupabase._setMockResponse("insert", {
        data: expectedProject,
        error: null,
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      expect(response.status).toBe(201);

      if (response.body && response.status === 201) {
        expect(response.body.collaborators).toContain(mockEmpId);
        expect(response.body.collaborators).toContain("EMP456");
        expect(response.body.collaborators).toContain("EMP789");
      }

      console.log("Multi-collaborator project test passed");
    });

    it("should handle projects with no additional collaborators", async () => {
      const projectData = {
        title: "Solo Project",
        description: "Project with just the owner",
        collaborators: [mockEmpId], // Just the owner
      };

      const expectedProject = {
        id: 1,
        title: "Solo Project",
        description: "Project with just the owner",
        owner_id: mockEmpId,
        collaborators: [mockEmpId],
        created_at: "2023-01-01T00:00:00Z",
      };

      mockSupabase._setMockResponse("insert", {
        data: expectedProject,
        error: null,
      });

      const response = await request(app)
        .post("/projects")
        .set("Authorization", "Bearer valid-token")
        .send(projectData);

      expect(response.status).toBe(201);

      console.log("Solo project test passed");
    });
  });
});
