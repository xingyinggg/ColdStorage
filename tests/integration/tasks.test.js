import { vi } from "vitest";
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables FIRST (before any imports)
dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

// Validate that test environment variables are loaded
if (!process.env.SUPABASE_TEST_URL || !process.env.SUPABASE_TEST_SERVICE_KEY) {
  console.error('❌ Missing test environment variables');
  console.error('SUPABASE_TEST_URL:', !!process.env.SUPABASE_TEST_URL);
  console.error('SUPABASE_TEST_SERVICE_KEY:', !!process.env.SUPABASE_TEST_SERVICE_KEY);
  throw new Error('Test environment variables not loaded');
}

// Override environment variables to force test database usage
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

// Mock auth functions ONLY - avoid creating Supabase client in mock factory
vi.mock("../../server/lib/supabase.js", () => ({
  // We'll override getServiceClient in the test setup instead
  getServiceClient: vi.fn(),
  
  // Mock auth functions to return test users
  getUserFromToken: vi.fn(),
  getEmpIdForUserId: vi.fn(),
  getUserRole: vi.fn(),
}));

// Now import everything else
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import request from "supertest";
import express from "express";
import { createClient } from '@supabase/supabase-js';
import taskRoutes from "../../server/routes/tasks.js";
import { 
  getServiceClient, 
  getUserFromToken, 
  getEmpIdForUserId, 
  getUserRole 
} from "../../server/lib/supabase.js";

// Create direct test database client for verification
function getTestSupabaseClient() {
  return createClient(
    process.env.SUPABASE_TEST_URL,
    process.env.SUPABASE_TEST_SERVICE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

const app = express();
app.use(express.json());
app.use("/tasks", taskRoutes);

describe("Integration Tests - Real Test Database", () => {
  let supabaseClient;
  let staffToken;
  let managerToken;
  let createdTaskIds = [];
  let createdSubtaskIds = [];

  beforeAll(async () => {
    // Create test database client
    supabaseClient = getTestSupabaseClient();
    
    // Set up mock implementations AFTER environment is loaded
    const testSupabaseClient = supabaseClient;
    
    // Override getServiceClient to return our test client
    vi.mocked(getServiceClient).mockReturnValue(testSupabaseClient);
    
    // Set up auth mocks
    vi.mocked(getUserFromToken).mockImplementation(async (token) => {
      if (!token || token.includes("invalid")) {
        throw new Error("Invalid token");
      }
      if (token.includes("manager")) {
        return {
          id: "550e8400-e29b-41d4-a716-446655440002",
          email: "manager@example.com",
        };
      }
      return {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "test1@example.com",
      };
    });
    
    vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
      if (userId === "550e8400-e29b-41d4-a716-446655440002") {
        return "TEST002"; // Manager from seeded data
      }
      return "TEST001"; // Staff from seeded data
    });
    
    vi.mocked(getUserRole).mockImplementation(async (empId) => {
      if (empId === "TEST002") {
        return "manager";
      }
      return "staff";
    });
    
    staffToken = "test-staff-token";
    managerToken = "test-manager-token";
    
    console.log("✅ Using existing test database");
    console.log("Test DB URL:", process.env.SUPABASE_TEST_URL?.substring(0, 50) + "...");
    
    // Verify connection to test database
    try {
      const { data: testUsers, error } = await supabaseClient
        .from("users")
        .select("*")
        .in("emp_id", ["TEST001", "TEST002"]);
      
      if (error) {
        console.error("❌ Failed to connect to test database:", error);
        throw new Error("Test database connection failed");
      }
      
      console.log(`✅ Found ${testUsers?.length || 0} test users in database`);
      console.log("Test users:", testUsers?.map(u => u.emp_id));
    } catch (error) {
      console.error("❌ Database verification failed:", error);
      throw error;
    }
  });

  beforeEach(async () => {
    createdTaskIds = [];
    createdSubtaskIds = [];
    console.log("🧪 Starting fresh test...");
  });

  afterEach(async () => {
    // Clean up only test data created during this test
    if (createdSubtaskIds.length > 0) {
      try {
        await supabaseClient
          .from("sub_task")
          .delete()
          .in("id", createdSubtaskIds);
        console.log(`🧹 Cleaned up ${createdSubtaskIds.length} test subtasks`);
      } catch (error) {
        console.warn("⚠️ Subtask cleanup warning:", error.message);
      }
    }

    if (createdTaskIds.length > 0) {
      try {
        await supabaseClient
          .from("tasks")
          .delete()
          .in("id", createdTaskIds);
        console.log(`🧹 Cleaned up ${createdTaskIds.length} test tasks`);
      } catch (error) {
        console.warn("⚠️ Task cleanup warning:", error.message);
      }
    }
  });

  afterAll(() => {
    console.log("✅ Integration tests complete");
  });

  describe("Environment and Database Verification", () => {
    it("should have test environment variables loaded", () => {
      expect(process.env.SUPABASE_TEST_URL).toBeTruthy();
      expect(process.env.SUPABASE_TEST_SERVICE_KEY).toBeTruthy();
      expect(process.env.SUPABASE_URL).toBe(process.env.SUPABASE_TEST_URL);
      console.log("✅ Test environment variables verified");
    });

    it("should be using test database with seeded data", async () => {
      // Verify we're connected to test database
      const { data: testUsers, error } = await supabaseClient
        .from("users")
        .select("*")
        .in("emp_id", ["TEST001", "TEST002"]);
      
      expect(error).toBeNull();
      expect(testUsers.length).toBeGreaterThan(0);
      expect(testUsers.some(u => u.emp_id === "TEST001")).toBe(true);
      expect(testUsers.some(u => u.emp_id === "TEST002")).toBe(true);
      
      console.log("✅ Confirmed using test database with seeded users");
    });

    it("should have seeded test projects", async () => {
      const { data: projects, error } = await supabaseClient
        .from("projects")
        .select("*")
        .limit(5);
      
      expect(error).toBeNull();
      expect(projects.length).toBeGreaterThan(0);
      
      console.log(`✅ Found ${projects.length} test projects`);
    });
  });

  describe("Mock Verification", () => {
    it("should have properly mocked auth functions", async () => {
      // Test getUserFromToken mock
      const staffUser = await getUserFromToken("test-staff-token");
      expect(staffUser.id).toBe("550e8400-e29b-41d4-a716-446655440001");
      
      const managerUser = await getUserFromToken("test-manager-token");
      expect(managerUser.id).toBe("550e8400-e29b-41d4-a716-446655440002");
      
      // Test getEmpIdForUserId mock
      const staffEmpId = await getEmpIdForUserId("550e8400-e29b-41d4-a716-446655440001");
      expect(staffEmpId).toBe("TEST001");
      
      const managerEmpId = await getEmpIdForUserId("550e8400-e29b-41d4-a716-446655440002");
      expect(managerEmpId).toBe("TEST002");
      
      // Test getUserRole mock
      const staffRole = await getUserRole("TEST001");
      expect(staffRole).toBe("staff");
      
      const managerRole = await getUserRole("TEST002");
      expect(managerRole).toBe("manager");
      
      console.log("✅ All auth mocks working correctly");
    });

    it("should use test database for getServiceClient", () => {
      const client = getServiceClient();
      expect(client).toBeDefined();
      expect(vi.mocked(getServiceClient)).toHaveBeenCalled();
      console.log("✅ getServiceClient mock verified");
    });
  });

  describe("Task CRUD with Real Test Database", () => {
    it("should create task in test database with proper data structure", async () => {
      const taskData = {
        title: "Integration Test Task - CREATE",
        description: "Real database integration test",
        priority: 5,
        status: "ongoing",
        due_date: "2025-12-31",
        project_id: 1, // Use seeded test project
      };

      const response = await request(app)
        .post("/tasks")
        .set("Authorization", `Bearer ${staffToken}`)
        .send(taskData);

      console.log("📝 Create Task Response:", response.status, response.body);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.title).toBe(taskData.title);
      expect(response.body.owner_id).toBe("TEST001"); // From seeded test user
      
      createdTaskIds.push(response.body.id);

      // Verify in actual test database
      const { data: dbTask, error } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("id", response.body.id)
        .single();

      expect(error).toBeNull();
      expect(dbTask.title).toBe(taskData.title);
      expect(dbTask.priority).toBe(taskData.priority);
      expect(dbTask.project_id).toBe(1);
      console.log("✅ Task verified in test database");
    });

    it("should read tasks from test database", async () => {
      const response = await request(app)
        .get("/tasks")
        .set("Authorization", `Bearer ${staffToken}`);

      console.log("📖 Read Tasks Response:", response.status);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("tasks");
      expect(Array.isArray(response.body.tasks)).toBe(true);

      console.log("✅ Task read verified from test database");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/tasks");
        // No Authorization header

      expect(response.status).toBe(401);
      console.log("✅ Authentication requirement verified");
    });
  });
});