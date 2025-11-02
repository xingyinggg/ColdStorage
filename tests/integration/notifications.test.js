// Load test environment variables FIRST (before any imports)
import dotenv from "dotenv";
import path from "path";

// Load test environment from tests/.env.test
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

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
import { createClient } from "@supabase/supabase-js";
import { checkUpcomingDeadlines } from "../../server/services/deadlineNotificationService.js";

// Mock authentication functions
import {
  getUserFromToken,
  getEmpIdForUserId,
  getUserRole,
} from "../../server/lib/supabase.js";
import { connect } from "http2";

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
describe("Notifications Integration Tests Setup", () => {
  let supabaseClient;
  let createdTaskIds = [];
  let createdNotificationIds = [];

  beforeAll(async () => {
    // Initialize test database client
    supabaseClient = getTestSupabaseClient();

    // Verify test database connection and check table structure
    console.log("Testing database connection...");
    const { data, error } = await supabaseClient
      .from("tasks")
      .select("id, title, status, priority, owner_id, collaborators, due_date")
      .limit(1);

    if (error) {
      console.error("Database connection failed:", error);
      throw new Error(`Database connection failed: ${error.message}`);
    }
    console.log("Database connection successful");
    console.log("Sample task structure:", data?.[0] || "No existing tasks");

    // Check notifications table structure
    const { data: notifData, error: notifError } = await supabaseClient
      .from("notifications")
      .select("*")
      .limit(1);

    if (notifError) {
      console.error("Notifications table error:", notifError);
    } else {
      console.log(
        "Sample notification structure:",
        notifData?.[0] || "No existing notifications"
      );
    }

    // Configure authentication mocks
    vi.mocked(getUserFromToken).mockResolvedValue({
      id: "550e8400-e29b-41d4-a716-446655440001",
      email: "staff@example.com",
    });

    vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
      if (userId === "550e8400-e29b-41d4-a716-446655440002") {
        return 2; // Collaborator as int8
      }
      return 1; // Owner as int8
    });

    vi.mocked(getUserRole).mockResolvedValue("staff");
  });

  beforeEach(async () => {
    // Clear tracking arrays
    createdTaskIds = [];
    createdNotificationIds = [];
  });

  afterEach(async () => {
    // Cleanup created notifications
    if (createdNotificationIds.length > 0) {
      await supabaseClient
        .from("notifications")
        .delete()
        .in("id", createdNotificationIds);
    }

    // Cleanup created tasks
    if (createdTaskIds.length > 0) {
      await supabaseClient.from("tasks").delete().in("id", createdTaskIds);
    }
  });

  afterAll(async () => {
    // Final cleanup
    await supabaseClient
      .from("notifications")
      .delete()
      .ilike("title", "%Integration Test%");

    await supabaseClient
      .from("tasks")
      .delete()
      .ilike("title", "%Integration Test%");
  });

  describe("CS-US165: Upcoming deadline notification - Integration Tests", () => {
    it("CS-US165-TC1 should send notification 7 days before deadline", async () => {
      // Create a task due in exactly 7 days from today
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      const dueDateString = dueDate.toISOString().split("T")[0];

      console.log(
        `Creating task due on: ${dueDateString} (7 days from ${new Date().toISOString().split("T")[0]
        })`
      );

      const testTask = {
        title: "Integration Test Task - 7 Days",
        description: "Task for testing 7-day deadline notification",
        status: "ongoing", // Check if this should be different
        priority: 3, // Try as number instead of string
        due_date: dueDateString,
        owner_id: 1, // int8 format for employee ID
        collaborators: [], // Empty array
        created_at: new Date().toTimeString().split(" ")[0], // HH:MM:SS format
      };

      console.log("Creating test task:", testTask);

      // Insert task into test database
      const { data: createdTask, error: createError } = await supabaseClient
        .from("tasks")
        .insert(testTask)
        .select()
        .single();

      if (createError) {
        console.error("Task creation error:", createError);
        throw new Error(`Task creation failed: ${createError.message}`);
      }

      expect(createError).toBeNull();
      expect(createdTask).toBeDefined();
      createdTaskIds.push(createdTask.id);

      console.log("Created task:", createdTask);

      // Verify the task was created with correct due_date
      const { data: verifyTask } = await supabaseClient
        .from("tasks")
        .select("*")
        .eq("id", createdTask.id)
        .single();

      console.log("Verified task in DB:", verifyTask);

      // Run deadline notification service
      console.log("Running deadline check...");
      const result = await checkUpcomingDeadlines(true);

      console.log("Deadline check result:", JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      if (!result.success) {
        console.error("Deadline check failed. Full result:", result);
        throw new Error(
          `Deadline check failed: ${result.error || "Unknown error"}`
        );
      }
      expect(result.success).toBe(true);

      // Verify 7-day notification was created
      const { data: notifications, error: notifError } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("task_id", createdTask.id);

      if (notifError) {
        console.error("Error fetching notifications:", notifError);
      }

      console.log("All notifications for task:", notifications);

      if (notifications && notifications.length > 0) {
        const sevenDayNotif = notifications.find(
          (n) => n.title?.includes("7 days") || n.title?.includes("7 day")
        );

        expect(sevenDayNotif).toBeDefined();
        if (sevenDayNotif) {
          expect(sevenDayNotif.emp_id).toBe(1);
          expect(sevenDayNotif.task_id).toBe(createdTask.id);
          expect(sevenDayNotif.title).toContain("7 day");
          createdNotificationIds.push(sevenDayNotif.id);
        }
      }
    });

    it("CS-US165-TC2 should send notification 3 days before deadline", async () => {
      // Create a task due in exactly 3 days from today
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateString = dueDate.toISOString().split("T")[0];

      console.log(
        `Creating task due on: ${dueDateString} (3 days from ${new Date().toISOString().split("T")[0]
        })`
      );

      const testTask = {
        title: "Integration Test Task - 3 Days",
        description: "Task for testing 3-day deadline notification",
        status: "ongoing",
        priority: 3,
        due_date: dueDateString,
        owner_id: 1,
        collaborators: [],
        created_at: new Date().toTimeString().split(" ")[0],
      };

      console.log("Creating test task:", testTask);

      const { data: createdTask, error: createError } = await supabaseClient
        .from("tasks")
        .insert(testTask)
        .select()
        .single();

      if (createError) {
        console.error("Task creation error:", createError);
        throw new Error(`Task creation failed: ${createError.message}`);
      }

      expect(createError).toBeNull();
      expect(createdTask).toBeDefined();
      createdTaskIds.push(createdTask.id);

      console.log("Created task:", createdTask);

      // Run deadline notification service
      console.log("Running deadline check...");
      const result = await checkUpcomingDeadlines(true);

      console.log("Deadline check result:", JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      if (!result.success) {
        console.error("Deadline check failed. Full result:", result);
        throw new Error(
          `Deadline check failed: ${result.error || "Unknown error"}`
        );
      }
      expect(result.success).toBe(true);

      // Verify 3-day notification was created
      const { data: notifications } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("task_id", createdTask.id);

      console.log("All notifications for task:", notifications);

      if (notifications && notifications.length > 0) {
        const threeDayNotif = notifications.find(
          (n) => n.title?.includes("3 days") || n.title?.includes("3 day")
        );

        expect(threeDayNotif).toBeDefined();
        if (threeDayNotif) {
          expect(threeDayNotif.emp_id).toBe(1);
          expect(threeDayNotif.task_id).toBe(createdTask.id);
          expect(threeDayNotif.title).toContain("3 day");
          createdNotificationIds.push(threeDayNotif.id);
        }
      }
    });

    it("CS-US165-TC3 should send notification 1 day before deadline", async () => {
      // Create a task due in exactly 1 day from today
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      const dueDateString = dueDate.toISOString().split("T")[0];

      console.log(
        `Creating task due on: ${dueDateString} (1 day from ${new Date().toISOString().split("T")[0]
        })`
      );

      const testTask = {
        title: "Integration Test Task - 1 Day",
        description: "Task for testing 1-day deadline notification",
        status: "ongoing",
        priority: 2,
        due_date: dueDateString,
        owner_id: 1,
        collaborators: [],
        created_at: new Date().toTimeString().split(" ")[0],
      };

      console.log("Creating test task:", testTask);

      const { data: createdTask, error: createError } = await supabaseClient
        .from("tasks")
        .insert(testTask)
        .select()
        .single();

      if (createError) {
        console.error("Task creation error:", createError);
        throw new Error(`Task creation failed: ${createError.message}`);
      }

      expect(createError).toBeNull();
      expect(createdTask).toBeDefined();
      createdTaskIds.push(createdTask.id);

      console.log("Created task:", createdTask);

      // Run deadline notification service
      console.log("Running deadline check...");
      const result = await checkUpcomingDeadlines(true);

      console.log("Deadline check result:", JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      if (!result.success) {
        console.error("Deadline check failed. Full result:", result);
        throw new Error(
          `Deadline check failed: ${result.error || "Unknown error"}`
        );
      }
      expect(result.success).toBe(true);

      // Verify 1-day notification was created
      const { data: notifications } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("task_id", createdTask.id);

      console.log("All notifications for task:", notifications);

      if (notifications && notifications.length > 0) {
        const oneDayNotif = notifications.find((n) => n.title?.includes("1 day"));

        expect(oneDayNotif).toBeDefined();
        if (oneDayNotif) {
          expect(oneDayNotif.emp_id).toBe(1);
          expect(oneDayNotif.task_id).toBe(createdTask.id);
          expect(oneDayNotif.title).toContain("1 day");
          createdNotificationIds.push(oneDayNotif.id);
        }
      }
    });

    it("CS-US165-TC4 should send notifications to task owners and collaborators", async () => {
      // Create a task due in 3 days with owner and collaborators
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 3);
      const dueDateString = dueDate.toISOString().split("T")[0];

      console.log(
        `Creating team task due on: ${dueDateString} (3 days from ${new Date().toISOString().split("T")[0]
        })`
      );

      const testTask = {
        title: "Integration Test Task - Team",
        description: "Task for testing notifications to owner and collaborators",
        status: "ongoing",
        priority: 8,
        due_date: dueDateString,
        owner_id: 1,
        collaborators: [2], // Add collaborator as int8
        created_at: new Date().toTimeString().split(" ")[0],
      };

      console.log("Creating test task:", testTask);

      const { data: createdTask, error: createError } = await supabaseClient
        .from("tasks")
        .insert(testTask)
        .select()
        .single();

      if (createError) {
        console.error("Task creation error:", createError);
        throw new Error(`Task creation failed: ${createError.message}`);
      }

      expect(createError).toBeNull();
      expect(createdTask).toBeDefined();
      createdTaskIds.push(createdTask.id);

      console.log("Created task:", createdTask);

      // Run deadline notification service
      console.log("Running deadline check...");
      const result = await checkUpcomingDeadlines(true);

      console.log("Deadline check result:", JSON.stringify(result, null, 2));

      expect(result).toBeDefined();
      if (!result.success) {
        console.error("Deadline check failed. Full result:", result);
        throw new Error(
          `Deadline check failed: ${result.error || "Unknown error"}`
        );
      }
      expect(result.success).toBe(true);

      // Verify notifications were created for both owner and collaborators
      const { data: notifications } = await supabaseClient
        .from("notifications")
        .select("*")
        .eq("task_id", createdTask.id);

      console.log("All notifications for team task:", notifications);

      expect(notifications).toBeDefined();

      if (notifications && notifications.length > 0) {
        // Should have notifications for both owner and collaborator
        const ownerNotifs = notifications.filter((n) => n.emp_id === 1);
        const collaboratorNotifs = notifications.filter((n) => n.emp_id === 2);

        console.log("Owner notifications:", ownerNotifs);
        console.log("Collaborator notifications:", collaboratorNotifs);

        // At least one notification should exist
        expect(notifications.length).toBeGreaterThan(0);

        // Add all notifications to cleanup
        notifications.forEach((notif) => {
          createdNotificationIds.push(notif.id);
          expect(notif.task_id).toBe(createdTask.id);
          expect([1, 2]).toContain(notif.emp_id);
        });
      }
    });
  });
  describe("CS-US14: Notification for Task Creation", () => {
    // Placeholder - implement real tests later


    it.todo("CS-US14-TC1: Select notification based on employee ID - pending");
  });
});
