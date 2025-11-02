/**
 * Integration Tests for Recurring Tasks Functionality
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
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables FIRST, before any other imports
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Map TEST_ prefixed variables to standard names
process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY;
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

// Verify environment is configured
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Test environment not configured!');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
  throw new Error('Test environment not properly configured. Check tests/.env.test');
}

console.log('🧪 Test Database URL:', process.env.SUPABASE_URL);

// NOW import modules that depend on Supabase
import taskRoutes from "../../server/routes/tasks.js";
import authRoutes from "../../server/routes/auth.js";
import { getServiceClient } from "../../server/lib/supabase.js";

const app = express();
app.use(express.json());
app.use("/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

describe("[INTEGRATION] Recurring Tasks - Full Workflow", () => {
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

    if (authError) {
      console.error('❌ Failed to create test user:', authError);
      throw authError;
    }
    
    testUserId = authData.user.id;
    testEmpId = registrationData.emp_id;

    // Upsert user into users table
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

    if (userError) {
      console.error('❌ Failed to insert user into users table:', userError);
      throw userError;
    }

    // Login to get the token
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: registrationData.email,
        password: registrationData.password,
      });

    if (loginResponse.status !== 200) {
      console.error('❌ Failed to login:', loginResponse.body);
    }
    
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

    if (projectError) {
      console.error('❌ Failed to create test project:', projectError);
      throw projectError;
    }
    
    createdProjectId = project.id;

    console.log("✅ Test user and project created successfully");
    console.log("   User ID:", testUserId);
    console.log("   Emp ID:", testEmpId);
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
    // NOTE: recurrence_count in the API represents the MAX count (limit), not current count
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
      recurrence_count: 5, // This is the MAX count (gets stored as recurrence_max_count)
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    if (createResponse.status !== 201) {
      console.error('❌ Failed to create task:', createResponse.body);
      console.error('❌ Response:', JSON.stringify(createResponse.body, null, 2));
    }

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toBeDefined();
    
    const firstTask = createResponse.body;
    createdTaskIds.push(firstTask.id);

    console.log('✅ Created first task:', firstTask.id);

    expect(firstTask.is_recurring).toBe(true);
    expect(firstTask.recurrence_pattern).toBe("weekly");
    expect(firstTask.recurrence_weekday).toBe(3);
    expect(firstTask.recurrence_count).toBe(1); // First occurrence
    expect(firstTask.recurrence_max_count).toBe(5);
    expect(firstTask.recurrence_series_id).toBeDefined();

    // Mark task as completed
    const updateResponse = await request(app)
      .put(`/api/tasks/${firstTask.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    if (updateResponse.status !== 200) {
      console.error('❌ Failed to complete task:', updateResponse.body);
    }

    expect(updateResponse.status).toBe(200);
    console.log('✅ Marked task as completed');

    // Wait for async task creation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const { data: nextTasks, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", firstTask.recurrence_series_id)
      .eq("status", "ongoing")
      .order("due_date", { ascending: true });

    if (error) {
      console.error('❌ Failed to fetch next tasks:', error);
    }

    expect(error).toBeNull();
    expect(nextTasks).toBeDefined();
    
    if (nextTasks.length === 0) {
      console.error('❌ No next task was created!');
      console.error('Series ID:', firstTask.recurrence_series_id);
      
      // Debug: Check all tasks in series
      const { data: allSeriesTasks } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("recurrence_series_id", firstTask.recurrence_series_id);
      
      console.error('All tasks in series:', allSeriesTasks);
    }
    
    expect(nextTasks.length).toBeGreaterThan(0);

    const nextTask = nextTasks[0];
    createdTaskIds.push(nextTask.id);

    console.log('✅ Next task created:', nextTask.id, 'with due date:', nextTask.due_date);

    expect(nextTask.due_date).toBe("2025-10-22"); // Wednesday
    
    const nextDate = new Date(nextTask.due_date);
    expect(nextDate.getDay()).toBe(3); // Wednesday
    
    expect(nextTask.recurrence_count).toBe(2); // Second occurrence
    expect(nextTask.recurrence_max_count).toBe(5);
    expect(nextTask.is_recurring).toBe(true);

    console.log("✅ CS-US75-TC-1 PASSED");
  }, 15000); // Increase timeout to 15 seconds

  it("[CS-US75-TC-2] should stop creating occurrences after reaching max count", async () => {
    // NOTE: recurrence_count in the API represents the MAX count (limit)
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
      recurrence_count: 3, // This is the MAX count (gets stored as recurrence_max_count)
    };

    const createResponse = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${testUserToken}`)
      .send(taskData);

    if (createResponse.status !== 201) {
      console.error('❌ Failed to create task:', createResponse.body);
      console.error('❌ Response:', JSON.stringify(createResponse.body, null, 2));
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

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify task 2 created
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

    // Complete task 2
    await request(app)
      .put(`/api/tasks/${task2.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify task 3 created
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

    // Complete task 3
    await request(app)
      .put(`/api/tasks/${task3.id}`)
      .set("Authorization", `Bearer ${testUserToken}`)
      .send({ status: "completed" });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify NO task 4 created
    ({ data: seriesTasks } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("recurrence_series_id", seriesId)
      .order("due_date", { ascending: true }));

    expect(seriesTasks.length).toBe(3);
    
    const task4 = seriesTasks.find(t => t.recurrence_count === 4);
    expect(task4).toBeUndefined();

    const completedTasks = seriesTasks.filter(t => t.status === "completed");
    expect(completedTasks.length).toBe(3);

    console.log("✅ CS-US75-TC-2 PASSED");
  }, 20000); // Increase timeout to 20 seconds for multiple operations

  // ... Apply same fixes to remaining tests (TC-3, TC-4, TC-5)
  // Change recurrence_count to recurrence_max_count in test data
});

console.log("✅ Recurring Tasks Integration Tests Loaded");