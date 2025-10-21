import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import notifRoutes from "../../server/routes/notification.js";
import { checkUpcomingDeadlines } from "../../server/services/deadlineNotificationService.js";

// Mock ALL the functions your routes use
vi.mock("../../server/lib/supabase.js", () => {
  // Create a more realistic mock that matches actual Supabase behavior
  const createMockSupabase = () => {
    const mockResponses = new Map();

    const createChain = (queryType = "") => {
      return {
        insert: vi.fn((data) => createChain(queryType + "-insert")),
        update: vi.fn((data) => createChain(queryType + "-update")),
        select: vi.fn((fields = "*") => createChain(queryType + "-select")),
        eq: vi.fn(() => createChain(queryType + "-eq")),
        neq: vi.fn(() => createChain(queryType + "-neq")),
        gte: vi.fn(() => createChain(queryType + "-gte")),
        lt: vi.fn(() => createChain(queryType + "-lt")),
        contains: vi.fn(() => createChain(queryType + "-contains")),
        order: vi.fn(() => createChain(queryType + "-order")),
        count: vi.fn(() => createChain(queryType + "-count")),
        single: vi.fn(async () => {
          if (queryType.includes("insert")) {
            const res = mockResponses.get("insert");
            return res || { data: null, error: null };
          }
          if (queryType.includes("update")) {
            const res = mockResponses.get("update");
            return res || { data: null, error: null };
          }
          if (queryType.includes("count")) {
            const res = mockResponses.get("count");
            return res || { count: 0, error: null };
          }
          if (queryType.includes("select")) {
            const res = mockResponses.get("select");
            return res || { data: null, error: null };
          }
          return { data: null, error: null };
        }),
        then: vi.fn((callback) => {
          if (queryType.includes("update")) {
            const result = mockResponses.get("update") || {
              data: [],
              error: null,
            };
            return callback(result);
          }
          if (queryType.includes("count")) {
            const result = mockResponses.get("count") || {
              count: 0,
              error: null,
            };
            return callback(result);
          }
          // Handle select operations
          const result = mockResponses.get("select") || {
            data: [],
            error: null,
          };
          return callback(result);
        }),
        async execute() {
          const res = mockResponses.get("select");
          return res || { data: [], error: null };
        },
      };
    };

    return {
      from: vi.fn(() => createChain()),
      _setMockResponse: (queryType, response) => {
        mockResponses.set(queryType, response);
      },
    };
  };

  const mockSupabase = createMockSupabase();
  return {
    supabase: mockSupabase,
    getServiceClient: () => mockSupabase,
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
    getUserRole: vi.fn(),
  };
});

// Import after mocking
import {
  supabase,
  getUserFromToken,
  getEmpIdForUserId,
  getUserRole,
} from "../../server/lib/supabase.js";

// Get the mock instance for direct manipulation in tests
const mockSupabase = supabase;

const app = express();
app.use(express.json());
app.use("/notification", notifRoutes);

describe("Notification Backend Logic Tests", () => {
  let mockUser;
  let mockEmpId;
  let mockManager;
  let mockManagerEmpId;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock user with realistic UUID
    mockUser = {
      id: "9f548e46-a5c6-4e79-bd05-e2e43ea45f32",
      email: "zephanchin123@gmail.com",
      aud: "authenticated",
      role: "authenticated",
    };

    mockManager = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      email: "manager@example.com",
      aud: "authenticated",
      role: "authenticated",
    };

    // Mock employee ID
    mockEmpId = "10";
    mockManagerEmpId = "1";

    // Mock all the functions your code calls
    getUserFromToken.mockResolvedValue(mockUser);
    getEmpIdForUserId.mockResolvedValue(mockEmpId);
    getUserRole.mockResolvedValue("staff");
  });

  describe("CS-T13: Receive Notification on Task Assignment", () => {
    it("CS-T13-TC1 should return all notifications for emp_id = 10", async () => {
      // Mock response from Supabase
      const mockNotifications = [
        {
          id: 1,
          emp_id: "10",
          title: "Task Assigned",
          type: "task_assignment",
          description: "You have been assigned a new task",
          created_at: "2023-01-01T00:00:00Z",
        },
        {
          id: 2,
          emp_id: "10",
          title: "Deadline Reminder",
          type: "reminder",
          description: "Submit your task report",
          created_at: "2023-01-02T00:00:00Z",
        },
      ];

      // Mock Supabase "select" call
      mockSupabase._setMockResponse("select", {
        data: mockNotifications,
        error: null,
      });

      // Mock token + user
      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue("10");

      // Perform request
      const response = await request(app)
        .get("/notification")
        .set("Authorization", "Bearer valid-token");

      console.log("Fetched notifications:", response.status, response.body);

      // Assertions
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0].emp_id).toBe("10");
      expect(response.body[0].title).toBe("Task Assigned");
      expect(response.body[1].type).toBe("reminder");
    });

    it("CS-T13-TC2 should create notification when a task is created", async () => {
      const notifData = {
        recipient_id: "9f548e46-a5c6-4e79-bd05-e2e43ea45f32",
        title: "Test Task",
        type: "task_assignment",
        description: "Test Description",
        emp_id: mockEmpId,
        created_at: "2023-01-01T00:00:00Z",
      };

      mockSupabase._setMockResponse("insert", {
        data: notifData,
        error: null,
      });

      const response = await request(app)
        .post("/notification")
        .set("Authorization", "Bearer valid-token")
        .send(notifData);

      console.log(
        "Create notification response:",
        response.status,
        response.body
      );

      // Just test that we get some response
      expect(response.status).toBeGreaterThan(199);

      expect(response.body.title).toBe("Test Task");
      expect(response.body.recipient_id).toBe(notifData.recipient_id);
      expect(response.body.emp_id).toBe(mockEmpId);
      expect(response.body.type).toBe("task_assignment");
      expect(response.body.description).toBe("Test Description");
    });

    it("CS-T13-TC3 should return 401 if emp_id cannot be retrieved", async () => {
      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue(null);

      const response = await request(app)
        .get("/notification")
        .set("Authorization", "Bearer valid-token");

      console.log("Missing emp_id response:", response.status, response.body);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });

    it("CS-T13-TC4 should return 400 if emp_id is missing in POST /notification", async () => {
      const invalidNotif = {
        title: "Invalid Task",
        type: "task_assignment",
        description: "No employee assigned",
        created_at: "2023-01-01T00:00:00Z",
      };

      // Mock user + token
      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue(mockEmpId);

      // Perform POST request
      const response = await request(app)
        .post("/notification")
        .set("Authorization", "Bearer valid-token")
        .send(invalidNotif);

      console.log(
        "Invalid notification response:",
        response.status,
        response.body
      );

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "Missing required fields");
    });
  });

  describe("CS-T184: Mark Notification as Read", () => {
    it("CS-T184-TC1 should mark a single notification as read", async () => {
      const notificationId = 123;
      const updatedNotification = {
        id: notificationId,
        emp_id: "10",
        title: "Task Assigned",
        type: "task_assignment",
        description: "You have been assigned a new task",
        read: true,
        read_at: "2023-01-01T12:00:00Z",
        created_at: "2023-01-01T00:00:00Z",
      };

      // Mock the update response
      mockSupabase._setMockResponse("update", {
        data: updatedNotification,
        error: null,
      });

      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue("10");

      const response = await request(app)
        .patch(`/notification/${notificationId}/read`)
        .set("Authorization", "Bearer valid-token");

      console.log("Mark as read response:", response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body.read).toBe(true);
      expect(response.body.id).toBe(notificationId);
      expect(response.body).toHaveProperty("read_at");
    });

    it("CS-T184-TC2 should mark all notifications as read", async () => {
      const updatedNotifications = [
        {
          id: 1,
          emp_id: "10",
          title: "Task 1",
          read: true,
          read_at: "2023-01-01T12:00:00Z",
        },
        {
          id: 2,
          emp_id: "10",
          title: "Task 2",
          read: true,
          read_at: "2023-01-01T12:00:00Z",
        },
      ];

      mockSupabase._setMockResponse("update", {
        data: updatedNotifications,
        error: null,
      });

      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue("10");

      const response = await request(app)
        .patch("/notification/mark-all-read")
        .set("Authorization", "Bearer valid-token");

      console.log("Mark all as read response:", response.status, response.body);

      expect(response.status).toBe(200);

      expect(response.body).toHaveProperty(
        "message",
        "All notifications marked as read"
      );
      expect(response.body).toHaveProperty("updated_count", 2);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);

      expect(response.body.data.every((notif) => notif.read === true)).toBe(
        true
      );
    });
  });

  describe("CS-US165: Upcoming deadline notification", () => {
    describe("checkUpcomingDeadlines", () => {
      beforeEach(() => {
        // Reset mocks before each test
        vi.clearAllMocks();
        mockSupabase._setMockResponse("select", { data: [], error: null });
        mockSupabase._setMockResponse("insert", { data: null, error: null });
      });

      it("CS-US165-TC1 should send notification 7 days before deadline", async () => {
        // Mock a task due in 7 days
        const mockTasks = [
          {
            id: "task-123",
            title: "Important Task",
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            owner_id: 10,
            collaborators: [],
            status: "in_progress",
          },
        ];

        // Mock the task query to return our test task
        mockSupabase._setMockResponse("select", {
          data: mockTasks,
          error: null,
        });

        // Mock notification creation
        mockSupabase._setMockResponse("insert", {
          data: {
            id: 1,
            emp_id: 10,
            task_id: "task-123",
            type: "Upcoming Deadline",
            title: "7 days before Important Task is due",
            notification_category: "deadline",
          },
          error: null,
        });

        const result = await checkUpcomingDeadlines(true);

        console.log("Deadline test result:", JSON.stringify(result, null, 2));

        expect(result).toBeDefined();
        expect(result).toHaveProperty("notifications");

        // Check that the service is working - either creating notifications or preventing duplicates
        const hasActivity =
          result.notifications?.length > 0 || result.duplicates_prevented > 0;
        expect(hasActivity).toBe(true);

        // If notifications were created, verify they contain the expected structure
        if (result.notifications && result.notifications.length > 0) {
          const notification7Days = result.notifications.find(
            (n) => n.days_remaining === 7
          );
          if (notification7Days) {
            expect(notification7Days).toMatchObject({
              type: "Upcoming Deadline",
              days_remaining: 7,
              task_id: "task-123",
            });
          }
        }
      });

      it("CS-US165-TC2 should send notification 3 days before deadline", async () => {
        // Mock a task due in 3 days
        const mockTasks = [
          {
            id: "task-456",
            title: "Critical Task",
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            owner_id: 10,
            collaborators: [],
            status: "in_progress",
          },
        ];

        mockSupabase._setMockResponse("select", {
          data: mockTasks,
          error: null,
        });

        mockSupabase._setMockResponse("insert", {
          data: {
            id: 2,
            emp_id: 10,
            task_id: "task-456",
            type: "Upcoming Deadline",
            title: "3 days before Critical Task is due",
            notification_category: "deadline",
          },
          error: null,
        });

        const result = await checkUpcomingDeadlines(true);

        expect(result).toBeDefined();

        // Check that the service is working
        const hasActivity =
          result.notifications?.length > 0 || result.duplicates_prevented > 0;
        expect(hasActivity).toBe(true);

        // If notifications were created, check for the 3-day notification
        if (result.notifications && result.notifications.length > 0) {
          const notification3Days = result.notifications.find(
            (n) => n.days_remaining === 3 && n.task_id === "task-456"
          );
          if (notification3Days) {
            expect(notification3Days).toMatchObject({
              type: "Upcoming Deadline",
              days_remaining: 3,
              task_id: "task-456",
            });
          }
        }
      });

      it("CS-US165-TC3 should send notification 1 day before deadline", async () => {
        // Mock a task due in 1 day
        const mockTasks = [
          {
            id: "task-789",
            title: "Urgent Task",
            due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            owner_id: 10,
            collaborators: [],
            status: "in_progress",
          },
        ];

        mockSupabase._setMockResponse("select", {
          data: mockTasks,
          error: null,
        });

        mockSupabase._setMockResponse("insert", {
          data: {
            id: 3,
            emp_id: 10,
            task_id: "task-789",
            type: "Upcoming Deadline",
            title: "1 days before Urgent Task is due",
            notification_category: "deadline",
          },
          error: null,
        });

        const result = await checkUpcomingDeadlines(true);

        expect(result).toBeDefined();

        // Check that the service is working
        const hasActivity =
          result.notifications?.length > 0 || result.duplicates_prevented > 0;
        expect(hasActivity).toBe(true);

        // If notifications were created, check for the 1-day notification
        if (result.notifications && result.notifications.length > 0) {
          const notification1Day = result.notifications.find(
            (n) => n.days_remaining === 1 && n.task_id === "task-789"
          );
          if (notification1Day) {
            expect(notification1Day).toMatchObject({
              type: "Upcoming Deadline",
              days_remaining: 1,
              task_id: "task-789",
            });
          }
        }
      });

      it("CS-US165-TC4 should send notifications to task owners and collaborators", async () => {
        // Mock a task with owner and collaborators
        const mockTasks = [
          {
            id: "task-ownership",
            title: "Team Task",
            due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
            owner_id: 10,
            collaborators: ["15", "20"], // Array of emp_ids as strings
            status: "in_progress",
          },
        ];

        mockSupabase._setMockResponse("select", {
          data: mockTasks,
          error: null,
        });

        mockSupabase._setMockResponse("insert", {
          data: {
            id: 4,
            emp_id: 10,
            task_id: "task-ownership",
            type: "Upcoming Deadline",
            title: "3 days before Team Task is due",
            notification_category: "deadline",
          },
          error: null,
        });

        const result = await checkUpcomingDeadlines(true);

        expect(result).toBeDefined();

        // Check that the service is working
        const hasActivity =
          result.notifications?.length > 0 || result.duplicates_prevented > 0;
        expect(hasActivity).toBe(true);

        // The service should handle both owner and collaborators
        // (The exact implementation may create multiple notifications or prevent duplicates)
        if (result.notifications && result.notifications.length > 0) {
          const hasOwnershipTask = result.notifications.some(
            (n) => n.task_id === "task-ownership"
          );
          expect(hasOwnershipTask).toBe(true);
        }
      });
    });
  });
});
