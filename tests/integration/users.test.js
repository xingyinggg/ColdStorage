import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../../server/index.js";

// Check if test environment variables are configured
const hasTestEnv = process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SERVICE_KEY;

describe.skipIf(!hasTestEnv)("Users Routes Integration Tests", () => {
  let authToken;
  let testUserEmpId;

  beforeAll(async () => {
    // Set environment variables for server routes
    process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;

    // Login to get auth token for testing
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "test@example.com",
        password: "testpassword"
      });

    if (loginResponse.status === 200 && loginResponse.body.token) {
      authToken = loginResponse.body.token;
      testUserEmpId = "TEST001"; // Known test user
    }
  });

  describe("GET /users - Get users with filtering", () => {
    it("should get all users with authentication", async () => {
      if (!authToken) return; // Skip if login failed

      const response = await request(app)
        .get("/users")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it("should filter users by roles", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/users?roles=staff,manager")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(Array.isArray(response.body.users)).toBe(true);

      // Verify only allowed roles are returned
      const roles = response.body.users.map(u => u.role);
      const allowedRoles = ["staff", "manager"];
      roles.forEach(role => {
        if (role) expect(allowedRoles).toContain(role);
      });
    });

    it("should exclude self when requested", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/users?exclude_self=true")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("users");
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it("should reject unauthorized requests", async () => {
      const response = await request(app).get("/users");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /users/search - Search users by name", () => {
    it("should search users by name", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/users/search?q=Test")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10); // Limited results
    });

    it("should return empty array for empty search query", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/users/search?q=")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it("should reject unauthorized search requests", async () => {
      const response = await request(app).get("/users/search?q=test");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("POST /users/bulk - Get multiple users by emp_ids", () => {
    it("should get multiple users by emp_ids", async () => {
      if (!authToken) return;

      const response = await request(app)
        .post("/users/bulk")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ emp_ids: ["TEST001", "TEST002"] });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it("should return empty array for non-existent emp_ids", async () => {
      if (!authToken) return;

      const response = await request(app)
        .post("/users/bulk")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ emp_ids: ["NONEXISTENT"] });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    it("should reject requests without emp_ids array", async () => {
      if (!authToken) return;

      const response = await request(app)
        .post("/users/bulk")
        .set("Authorization", `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error", "emp_ids array is required");
    });

    it("should reject unauthorized bulk requests", async () => {
      const response = await request(app)
        .post("/users/bulk")
        .send({ emp_ids: ["TEST001"] });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });

  describe("GET /users/profile/:empId - Get user profile", () => {
    it("should get user profile by emp_id", async () => {
      if (!authToken || !testUserEmpId) return;

      const response = await request(app)
        .get(`/users/profile/${testUserEmpId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("emp_id", testUserEmpId);
      expect(response.body).toHaveProperty("name");
      expect(response.body).toHaveProperty("email");
    });

    it("should return 404 for non-existent user profile", async () => {
      if (!authToken) return;

      const response = await request(app)
        .get("/users/profile/NONEXISTENT")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error", "User not found");
    });

    it("should reject unauthorized profile requests", async () => {
      const response = await request(app).get("/users/profile/TEST001");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error", "No token provided");
    });
  });
});

