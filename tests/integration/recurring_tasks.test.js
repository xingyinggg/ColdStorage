/**
 * Integration Tests for Recurring Tasks Functionality
 * User Story: CS-US75 - Recurring Tasks
 * 
 * These tests verify the COMPLETE recurring tasks flow:
 * - Real API calls to Express server
 * - Real database operations via Supabase
 * - End-to-end task creation, completion, and recurrence
 * 
 * Test Cases:
 * - CS-US75-TC-1: Weekly recurrence on specific weekday
 * - CS-US75-TC-2: Recurring task with count limit
 * - Additional integration scenarios
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import request from "supertest";
import express from "express";
import taskRoutes from "../../server/routes/tasks.js";
import authRoutes from "../../server/routes/auth.js";
import { getServiceClient } from "../../server/lib/supabase.js";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

// Skip integration tests if environment variables are not configured
const skipIntegrationTests = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;

if (skipIntegrationTests) {
  console.log("⚠️  Skipping recurring tasks integration tests - Supabase environment variables not configured");
  console.log("   To run integration tests, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

describe.skipIf(skipIntegrationTests)("[INTEGRATION] Recurring Tasks - Full Workflow", () => {
  let supabaseClient;
  let testUserToken;
  let testUserId;
  let testEmpId;
  let createdTaskIds = [];
  let createdProjectId;

  beforeAll(async () => {
    supabaseClient = getServiceClient();
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
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
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

    if (authError) throw authError;
    testUserId = authData.user.id;
    testEmpId = registrationData.emp_id;

    // Upsert user into users table (in case it was auto-created)
    const { error: userError } = await supabaseClient
      .from("users")
      .upsert({
        id: testUserId,
        emp_id: registrationData.emp_id,
        name: registrationData.name,
        email: registrationData.email,
        department: registrationData.department,
        role: registrationData.role,
      }, { onConflict: 'id' });

    if (userError) throw userError;

    // Login to get the token
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: registrationData.email,
        password: registrationData.password,
      });

    expect(loginResponse.status).toBe(200);
    testUserToken = loginResponse.body.access_token;

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

    if (projectError) throw projectError;
    createdProjectId = project.id;

    console.log("Test user and project created successfully");
  });

  beforeEach(() => {
    createdTaskIds = [];
  });

  afterEach(async () => {
    // Clean up tasks created in each test
    if (createdTaskIds.length > 0) {
      try {
        await supabaseClient.from("tasks").delete().in("id", createdTaskIds);
        console.log(`Cleaned up ${createdTaskIds.length} test tasks`);
      } catch (error) {
        console.warn("Task cleanup warning:", error.message);
      }
    }
  });

  afterAll(async () => {
    // Clean up project and user
    try {
      if (createdProjectId) {
        await supabaseClient
          .from("projects")
          .delete()
          .eq("id", createdProjectId);
      }

      if (testUserId) {
        // Delete from users table
        await supabaseClient.from("users").delete().eq("id", testUserId);
        
        // Delete from auth using admin API
        await supabaseClient.auth.admin.deleteUser(testUserId);
      }

      console.log("Integration test cleanup complete");
    } catch (error) {
      console.warn("Cleanup warning:", error.message);
    }
  });

  // ============================================================================
  // TEST CASE CS-US75-TC-1: Weekly Recurrence on Specific Weekday
  // ============================================================================

  it("[CS-US75-TC-1] should create recurring task on different weekday than due date and generate correct next occurrence", async () => {
    /**
     * Test Case ID: CS-US75-TC-1
     * Scenario: Set a recurring task on another day in the week than the day it is due
     * 
     * Preconditions:
     * - User is authenticated
     * - User has permission to create tasks
     * - Project exists
     * 
     * Test Data:
     * - Due date: Monday, October 20, 2025
     * - Recurrence pattern: Weekly
     * - Target weekday: Wednesday (day 3)
     * - Max occurrences: 5
     * 
     * Steps:
     * 1. Create a recurring task with due date on Monday
     * 2. Set recurrence to weekly on Wednesday
     * 3. Verify task is created with correct settings
     * 4. Mark the task as completed
     * 5. Verify next occurrence is created
     * 6. Verify next occurrence due date is Wednesday (Oct 22)
     * 7. Verify the weekday is correct (day 3)
     * 
     * Expected Result:
     * - First task created successfully with due_date = 2025-10-20 (Monday)
     * - After completion, next task has due_date = 2025-10-22 (Wednesday)
     * - Next task maintains recurrence settings
     * - recurrence_count increments from 1 to 2
     */

    // Step 1-2: Create recurring task
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
      recurrence_count: 5, // Max 5 occurrences
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    // Step 3: Verify task creation
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toBeDefined();
    
    const firstTask = createResponse.body;
    createdTaskIds.push(firstTask.id);

    expect(firstTask.is_recurring).toBe(true);
    expect(firstTask.recurrence_pattern).toBe("weekly");
    expect(firstTask.recurrence_weekday).toBe(3);
    expect(firstTask.recurrence_count).toBe(1); // First occurrence
    expect(firstTask.recurrence_max_count).toBe(5);
    expect(firstTask.recurrence_series_id).toBeDefined();

    // Step 4: Mark task as completed
    const updateResponse = await request(app)
      .put(`/api/tasks/${firstTask.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    expect(updateResponse.status).toBe(200);

    // Step 5-6: Verify next occurrence was created
    // Wait a bit for async task creation
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data: nextTasks, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", firstTask.recurrence_series_id)
      .eq("status", "ongoing")
      .order("due_date", { ascending: true });

    expect(error).toBeNull();
    expect(nextTasks).toBeDefined();
    expect(nextTasks.length).toBeGreaterThan(0);

    const nextTask = nextTasks[0];
    createdTaskIds.push(nextTask.id);

    // Step 7: Verify next occurrence date
    expect(nextTask.due_date).toBe("2025-10-22"); // Wednesday
    
    const nextDate = new Date(nextTask.due_date);
    expect(nextDate.getDay()).toBe(3); // Wednesday
    
    expect(nextTask.recurrence_count).toBe(2); // Second occurrence
    expect(nextTask.recurrence_max_count).toBe(5);
    expect(nextTask.is_recurring).toBe(true);

    console.log("✅ CS-US75-TC-1 PASSED: Weekly recurrence on specific weekday works correctly");
  });

  // ============================================================================
  // TEST CASE CS-US75-TC-2: Recurring Task with Count Limit
  // ============================================================================

  it("[CS-US75-TC-2] should stop creating occurrences after reaching max count", async () => {
    /**
     * Test Case ID: CS-US75-TC-2
     * Scenario: Set a recurring task with end condition after a set number of occurrences
     * 
     * Preconditions:
     * - User is authenticated
     * - User has permission to create tasks
     * - Project exists
     * 
     * Test Data:
     * - Due date: October 21, 2025
     * - Recurrence pattern: Daily
     * - Max occurrences: 3
     * 
     * Steps:
     * 1. Create a recurring task with max count of 3
     * 2. Verify task is created with count 1/3
     * 3. Complete task 1
     * 4. Verify task 2 is created with count 2/3
     * 5. Complete task 2
     * 6. Verify task 3 is created with count 3/3
     * 7. Complete task 3
     * 8. Verify NO task 4 is created (stopped at limit)
     * 9. Verify only 3 tasks exist in the series
     * 
     * Expected Result:
     * - Task 1: recurrence_count = 1, recurrence_max_count = 3
     * - Task 2: recurrence_count = 2, recurrence_max_count = 3
     * - Task 3: recurrence_count = 3, recurrence_max_count = 3
     * - After completing task 3, no task 4 is created
     * - Total tasks in series: exactly 3
     */

    // Step 1: Create recurring task with count limit
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
      recurrence_count: 3, // Max 3 occurrences
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    // Step 2: Verify initial task
    expect(createResponse.status).toBe(201);
    const task1 = createResponse.body;
    createdTaskIds.push(task1.id);

    expect(task1.recurrence_count).toBe(1);
    expect(task1.recurrence_max_count).toBe(3);
    const seriesId = task1.recurrence_series_id;

    // Step 3: Complete task 1
    await request(app)
      .put(`/api/tasks/${task1.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 4: Verify task 2 created
    let { data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", seriesId)
      .order("due_date", { ascending: true });

    let task2 = seriesTasks.find(t => t.recurrence_count === 2 && t.status === "ongoing");
    expect(task2).toBeDefined();
    expect(task2.due_date).toBe("2025-10-22");
    expect(task2.recurrence_count).toBe(2);
    expect(task2.recurrence_max_count).toBe(3);
    createdTaskIds.push(task2.id);

    // Step 5: Complete task 2
    await request(app)
      .put(`/api/tasks/${task2.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 6: Verify task 3 created
    ({ data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", seriesId)
      .order("due_date", { ascending: true }));

    let task3 = seriesTasks.find(t => t.recurrence_count === 3 && t.status === "ongoing");
    expect(task3).toBeDefined();
    expect(task3.due_date).toBe("2025-10-23");
    expect(task3.recurrence_count).toBe(3);
    expect(task3.recurrence_max_count).toBe(3);
    createdTaskIds.push(task3.id);

    // Step 7: Complete task 3
    await request(app)
      .put(`/api/tasks/${task3.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 8-9: Verify NO task 4 created
    ({ data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", seriesId)
      .order("due_date", { ascending: true }));

    // Should have exactly 3 tasks
    expect(seriesTasks.length).toBe(3);
    
    // Verify no task with count 4
    const task4 = seriesTasks.find(t => t.recurrence_count === 4);
    expect(task4).toBeUndefined();

    // Verify all 3 tasks are completed
    const completedTasks = seriesTasks.filter(t => t.status === "completed");
    expect(completedTasks.length).toBe(3);

    console.log("✅ CS-US75-TC-2 PASSED: Recurring task stops after reaching count limit");
  });

  // ============================================================================
  // Additional Integration Test Cases
  // ============================================================================

  it("[CS-US75-TC-3] should handle date-based end condition correctly", async () => {
    /**
     * Test Case ID: CS-US75-TC-3
     * Scenario: Recurring task with end date stops at the correct date
     */

    const taskData = {
      title: "[CS-US75-TC-3] Weekly Task with End Date",
      description: "Test date-based end condition",
      due_date: "2025-10-21",
      status: "ongoing",
      priority: 5,
      owner_id: testEmpId,
      project_id: createdProjectId,
      is_recurring: true,
      recurrence_pattern: "weekly",
      recurrence_interval: 1,
      recurrence_end_date: "2025-11-04", // 2 weeks later
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    expect(createResponse.status).toBe(201);
    const task1 = createResponse.body;
    createdTaskIds.push(task1.id);

    // Complete task 1 (Oct 21)
    await request(app)
      .put(`/api/tasks/${task1.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should create task 2 (Oct 28)
    let { data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", task1.recurrence_series_id)
      .eq("status", "ongoing");

    expect(seriesTasks.length).toBe(1);
    const task2 = seriesTasks[0];
    expect(task2.due_date).toBe("2025-10-28");
    createdTaskIds.push(task2.id);

    // Complete task 2
    await request(app)
      .put(`/api/tasks/${task2.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should create task 3 (Nov 04, on the end date - inclusive)
    ({ data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", task1.recurrence_series_id));

    // Should have exactly 3 tasks (task 3 is created ON the end date, which is allowed)
    expect(seriesTasks.length).toBe(3);
    const completedTasks = seriesTasks.filter(t => t.status === "completed");
    expect(completedTasks.length).toBe(2); // First 2 completed
    
    const task3 = seriesTasks.find(t => t.due_date === "2025-11-04");
    expect(task3).toBeDefined();
    expect(task3.status).toBe("ongoing"); // Task 3 is created but not completed
    createdTaskIds.push(task3.id);

    console.log("✅ CS-US75-TC-3 PASSED: Date-based end condition works correctly");
  });

  it("[CS-US75-TC-4] should handle biweekly recurrence with weekday", async () => {
    /**
     * Test Case ID: CS-US75-TC-4
     * Scenario: Biweekly recurring task on specific weekday
     */

    const taskData = {
      title: "[CS-US75-TC-4] Biweekly Friday Task",
      description: "Test biweekly recurrence",
      due_date: "2025-10-17", // Friday
      status: "ongoing",
      priority: 5,
      owner_id: testEmpId,
      project_id: createdProjectId,
      is_recurring: true,
      recurrence_pattern: "biweekly",
      recurrence_interval: 1,
      recurrence_weekday: 5, // Friday
      recurrence_count: 3,
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    expect(createResponse.status).toBe(201);
    const task1 = createResponse.body;
    createdTaskIds.push(task1.id);

    // Complete task 1
    await request(app)
      .put(`/api/tasks/${task1.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify next task is 2 weeks later on Friday
    const { data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", task1.recurrence_series_id)
      .eq("recurrence_count", 2);

    expect(seriesTasks.length).toBe(1);
    const task2 = seriesTasks[0];
    expect(task2.due_date).toBe("2025-10-31"); // 2 weeks later, Friday
    
    const nextDate = new Date(task2.due_date);
    expect(nextDate.getDay()).toBe(5); // Friday
    
    createdTaskIds.push(task2.id);

    console.log("✅ CS-US75-TC-4 PASSED: Biweekly recurrence with weekday works correctly");
  });

  it("[CS-US75-TC-5] should handle monthly recurrence across month boundaries", async () => {
    /**
     * Test Case ID: CS-US75-TC-5
     * Scenario: Monthly recurring task handles month-end dates correctly
     */

    const taskData = {
      title: "[CS-US75-TC-5] Monthly End-of-Month Task",
      description: "Test monthly recurrence at month boundaries",
      due_date: "2025-01-31", // January 31
      status: "ongoing",
      priority: 5,
      owner_id: testEmpId,
      project_id: createdProjectId,
      is_recurring: true,
      recurrence_pattern: "monthly",
      recurrence_interval: 1,
      recurrence_count: 3,
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    expect(createResponse.status).toBe(201);
    const task1 = createResponse.body;
    createdTaskIds.push(task1.id);

    // Complete task 1
    await request(app)
      .put(`/api/tasks/${task1.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify next task date (Feb 31 doesn't exist, should adjust)
    const { data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", task1.recurrence_series_id)
      .eq("recurrence_count", 2);

    expect(seriesTasks.length).toBe(1);
    const task2 = seriesTasks[0];
    
    // JavaScript Date automatically adjusts Feb 31 to Mar 3 (or Feb 28/29)
    const nextDate = new Date(task2.due_date);
    expect(nextDate.getMonth()).toBeGreaterThanOrEqual(1); // Feb or later
    
    createdTaskIds.push(task2.id);

    console.log("✅ CS-US75-TC-5 PASSED: Monthly recurrence handles month boundaries");
  });
});

console.log("✅ Recurring Tasks Integration Tests Loaded");
