/**
 * Integration Tests for Recurring Tasks Functionality
 */

// Load test environment variables FIRST (before any imports)
import dotenv from "dotenv";
import path from "path";

// Load test environment from tests/.env.test
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

// Determine if we should skip due to missing env
const hasTestEnv =
  !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;
const skipIntegrationTests = !hasTestEnv;

if (hasTestEnv) {
  // Override environment to force test database usage
  process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
} else {
  console.log(
    "⚠️  Skipping recurring tasks integration tests - Supabase test env not configured"
  );
}

// Import test utilities
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import request from "supertest";
import express from "express";
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

// Import routes after mocking
import taskRoutes from "../../server/routes/tasks.js";
import authRoutes from "../../server/routes/auth.js";

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
app.use("/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

describe.skipIf(skipIntegrationTests)(
  "[INTEGRATION] Recurring Tasks - Full Workflow",
  () => {
    let supabaseClient;
    let testUserToken;
    let testUserId;
    let testEmpId;
    let createdTaskIds = [];
    let createdProjectId;

    beforeAll(async () => {
      supabaseClient = getTestSupabaseClient();
      console.log("Setting up recurring tasks integration tests...");

      // Create test user using service client with email confirmed
      const uniqueId = Date.now();
      const registrationData = {
        email: `recurrence.test.${uniqueId}@company.com`,
        password: "TestPassword123!",
        name: "Recurrence Test User",
        emp_id: `RTEST${uniqueId}`,
        department: "Engineering",
        role: "staff",
      };

      // Use admin API to create user with confirmed email
      const { data: authData, error: authError } =
        await supabaseClient.auth.admin.createUser({
          email: registrationData.email,
          password: registrationData.password,
          email_confirm: true,
          user_metadata: {
            name: registrationData.name,
            department: registrationData.department,
            role: registrationData.role,
            emp_id: registrationData.emp_id,
          },
        });

      if (authError) {
        console.error("❌ Failed to create test user:", authError);
        throw authError;
      }

      testUserId = authData.user.id;
      testEmpId = registrationData.emp_id;

      // Upsert user into users table
      const { error: userError } = await supabaseClient.from("users").upsert(
        {
          id: testUserId,
          emp_id: registrationData.emp_id,
          name: registrationData.name,
          email: registrationData.email,
          department: registrationData.department,
          role: registrationData.role,
        },
        { onConflict: "id" }
      );

      if (userError) {
        console.error("❌ Failed to insert user into users table:", userError);
        throw userError;
      }

      // Setup test token
      testUserToken = "test-recurring-task-token";

      // Configure authentication mocks
      vi.mocked(getUserFromToken).mockImplementation(async (token) => {
        if (token === testUserToken) {
          return {
            id: testUserId,
            email: registrationData.email,
          };
        }
        if (token.includes("invalid")) {
          throw new Error("Invalid token");
        }
        throw new Error("Token not found");
      });

      vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
        if (userId === testUserId) {
          return testEmpId;
        }
        return null;
      });

      vi.mocked(getUserRole).mockImplementation(async (empId) => {
        if (empId === testEmpId) {
          return "staff";
        }
        return null;
      });

      console.log("✅ Test user created and authentication mocked");
      console.log("   User ID:", testUserId);
      console.log("   Emp ID:", testEmpId);

      // Create a test project
      const { data: project, error: projectError } = await supabaseClient
        .from("projects")
        .insert({
          title: `Recurrence Test Project ${uniqueId}`,
          owner_id: testEmpId,
          status: "active",
        })
        .select()
        .single();

      if (projectError) {
        console.error("❌ Failed to create test project:", projectError);
        throw projectError;
      }

      createdProjectId = project.id;

      console.log("✅ Test user and project created successfully");
      console.log("   Project ID:", createdProjectId);
    });

    beforeEach(() => {
      createdTaskIds = [];
    });

    afterEach(async () => {
      if (createdTaskIds.length > 0) {
        try {
          await supabaseClient.from("tasks").delete().in("id", createdTaskIds);
          console.log(`🧹 Cleaned up ${createdTaskIds.length} test tasks`);
        } catch (error) {
          console.warn("⚠️  Task cleanup warning:", error.message);
        }
      }
    });

    afterAll(async () => {
      try {
        if (createdProjectId) {
          await supabaseClient
            .from("projects")
            .delete()
            .eq("id", createdProjectId);
        }

        if (testUserId) {
          await supabaseClient.from("users").delete().eq("id", testUserId);
          await supabaseClient.auth.admin.deleteUser(testUserId);
        }

        console.log("🧹 Integration test cleanup complete");
      } catch (error) {
        console.warn("⚠️  Cleanup warning:", error.message);
      }
    });

    it("[CS-US75-TC-1] should create recurring task on different weekday than due date and generate correct next occurrence", async () => {
      const taskData = {
        title: "[CS-US75-TC-1] Weekly Wednesday Task",
        description: "Test weekly recurrence on Wednesday",
        due_date: "2025-10-20", // Monday
        status: "ongoing",
        priority: 5,
        owner_id: testEmpId,
        project_id: createdProjectId,
        is_recurring: true,
        recurrence_pattern: "weekly",
        recurrence_interval: 1,
        recurrence_weekday: 3, // Wednesday
        recurrence_count: 5,
      };

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send(taskData);

      if (createResponse.status !== 201) {
        console.error("❌ Failed to create task:", createResponse.body);
      }

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toBeDefined();

      const firstTask = createResponse.body;
      createdTaskIds.push(firstTask.id);

      console.log("✅ Created first task:", firstTask.id);

      expect(firstTask.is_recurring).toBe(true);
      expect(firstTask.recurrence_pattern).toBe("weekly");
      expect(firstTask.recurrence_weekday).toBe(3);
      expect(firstTask.recurrence_count).toBe(1);
      expect(firstTask.recurrence_max_count).toBe(5);
      expect(firstTask.recurrence_series_id).toBeDefined();

      // Mark task as completed
      const updateResponse = await request(app)
        .put(`/api/tasks/${firstTask.id}`)
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({ status: "completed" });

      if (updateResponse.status !== 200) {
        console.error("❌ Failed to complete task:", updateResponse.body);
      }

      expect(updateResponse.status).toBe(200);
      console.log("✅ Marked task as completed");

      // Wait for async task creation
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const { data: nextTasks, error } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("recurrence_series_id", firstTask.recurrence_series_id)
        .eq("status", "ongoing")
        .order("due_date", { ascending: true });

      if (error) {
        console.error("❌ Failed to fetch next tasks:", error);
      }

      expect(error).toBeNull();
      expect(nextTasks).toBeDefined();

      if (nextTasks.length === 0) {
        console.error("❌ No next task was created!");
      }

      expect(nextTasks.length).toBeGreaterThan(0);

      const nextTask = nextTasks[0];
      createdTaskIds.push(nextTask.id);

      console.log(
        "✅ Next task created:",
        nextTask.id,
        "with due date:",
        nextTask.due_date
      );

      expect(nextTask.due_date).toBe("2025-10-22"); // Wednesday

      const nextDate = new Date(nextTask.due_date);
      expect(nextDate.getDay()).toBe(3); // Wednesday

      expect(nextTask.recurrence_count).toBe(2);
      expect(nextTask.recurrence_max_count).toBe(5);
      expect(nextTask.is_recurring).toBe(true);

      console.log("✅ CS-US75-TC-1 PASSED");
    }, 20000);

    it("[CS-US75-TC-2] should stop creating occurrences after reaching max count", async () => {
      const taskData = {
        title: "[CS-US75-TC-2] Daily Task with Count Limit",
        description: "Test recurring task stops after 3 occurrences",
        due_date: "2025-10-21",
        status: "ongoing",
        priority: 5,
        owner_id: testEmpId,
        project_id: createdProjectId,
        is_recurring: true,
        recurrence_pattern: "daily",
        recurrence_interval: 1,
        recurrence_count: 3,
      };

      const createResponse = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${testUserToken}`)
        .send(taskData);

      if (createResponse.status !== 201) {
        console.error("❌ Failed to create task:", createResponse.body);
      }

      expect(createResponse.status).toBe(201);
      const task1 = createResponse.body;
      createdTaskIds.push(task1.id);

      expect(task1.recurrence_count).toBe(1);
      expect(task1.recurrence_max_count).toBe(3);
      const seriesId = task1.recurrence_series_id;

      // Complete task 1
      await request(app)
        .put(`/api/tasks/${task1.id}`)
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({ status: "completed" });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify task 2 created
      let { data: seriesTasks } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("recurrence_series_id", seriesId)
        .order("due_date", { ascending: true });

      let task2 = seriesTasks.find(
        (t) => t.recurrence_count === 2 && t.status === "ongoing"
      );
      expect(task2).toBeDefined();
      expect(task2.due_date).toBe("2025-10-22");
      createdTaskIds.push(task2.id);

      // Complete task 2
      await request(app)
        .put(`/api/tasks/${task2.id}`)
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({ status: "completed" });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify task 3 created
      ({ data: seriesTasks } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("recurrence_series_id", seriesId)
        .order("due_date", { ascending: true }));

      let task3 = seriesTasks.find(
        (t) => t.recurrence_count === 3 && t.status === "ongoing"
      );
      expect(task3).toBeDefined();
      expect(task3.due_date).toBe("2025-10-23");
      createdTaskIds.push(task3.id);

      // Complete task 3
      await request(app)
        .put(`/api/tasks/${task3.id}`)
        .set("Authorization", `Bearer ${testUserToken}`)
        .send({ status: "completed" });

      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify NO task 4 created
      ({ data: seriesTasks } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("recurrence_series_id", seriesId)
        .order("due_date", { ascending: true }));

      expect(seriesTasks.length).toBe(3);

      const task4 = seriesTasks.find((t) => t.recurrence_count === 4);
      expect(task4).toBeUndefined();

      const completedTasks = seriesTasks.filter((t) => t.status === "completed");
      expect(completedTasks.length).toBe(3);

      console.log("✅ CS-US75-TC-2 PASSED");
    }, 30000);
  }
);

console.log("✅ Recurring Tasks Integration Tests Loaded");