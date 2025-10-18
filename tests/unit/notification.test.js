import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import notifRoutes from "../../server/routes/notification.js";

// Create a more realistic mock that matches actual Supabase behavior
const createMockSupabase = () => {
  const mockResponses = new Map();

  const createChain = (queryType = "") => {
    return {
      insert: vi.fn((data) => createChain(queryType + "-insert")),
      update: vi.fn((data) => createChain(queryType + "-update")),
      select: vi.fn((fields = "*") => createChain(queryType + "-select")),
      eq: vi.fn(() => createChain(queryType + "-eq")),
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
        // Handle count operations
        if (queryType.includes("count")) {
          const result = mockResponses.get("count") || {
            count: 0,
            error: null,
          };
          return callback(result);
        }
        // Handle select operations
        const result = mockResponses.get("select") || { data: [], error: null };
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

  describe("CS-US13: Receive Notification on Task Assignment", () => {
    it("should return all notifications for emp_id = 10", async () => {
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

    it("should create notification when a task is created", async () => {
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

    it("should return 401 if emp_id cannot be retrieved", async () => {
      getUserFromToken.mockResolvedValue(mockUser);
      getEmpIdForUserId.mockResolvedValue(null);

      const response = await request(app)
        .get("/notification")
        .set("Authorization", "Bearer valid-token");

      console.log("Missing emp_id response:", response.status, response.body);

      expect(response.status).toBe(401); // or 401 if your route explicitly handles this
      expect(response.body).toHaveProperty("error");
      // expect(response.body.error).toMatch(/emp/i);
    });

    it("should return 400 if emp_id is missing in POST /notification", async () => {
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

      // ✅ Assertions
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
});
