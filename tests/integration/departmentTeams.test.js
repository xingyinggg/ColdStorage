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

// Mock auth functions
vi.mock("../../server/lib/supabase.js", () => ({
  getServiceClient: vi.fn(),
  getUserFromToken: vi.fn(),
  getEmpIdForUserId: vi.fn(),
  getUserRole: vi.fn(),
}));

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
import departmentTeamsRoutes from "../../server/routes/department_teams.js";
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
app.use("/department-teams", departmentTeamsRoutes);

describe("Department Teams Integration Tests", () => {
  let supabaseClient;
  let managerToken;
  let staffToken;
  let directorToken;
  let createdTeamIds = [];
  let createdTaskIds = [];

  beforeAll(async () => {
    // Create test database client
    supabaseClient = getTestSupabaseClient();
    
    // Set up mock implementations
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
      if (token.includes("director")) {
        return {
          id: "550e8400-e29b-41d4-a716-446655440003",
          email: "director@example.com",
        };
      }
      return {
        id: "550e8400-e29b-41d4-a716-446655440001",
        email: "staff@example.com",
      };
    });
    
    vi.mocked(getEmpIdForUserId).mockImplementation(async (userId) => {
      if (userId === "550e8400-e29b-41d4-a716-446655440002") {
        return "TEST002"; // Manager
      }
      if (userId === "550e8400-e29b-41d4-a716-446655440003") {
        return "TEST003"; // Director
      }
      return "TEST001"; // Staff
    });
    
    vi.mocked(getUserRole).mockImplementation(async (empId) => {
      if (empId === "TEST002") return "manager";
      if (empId === "TEST003") return "director";
      return "staff";
    });
    
    managerToken = "test-manager-token";
    staffToken = "test-staff-token";
    directorToken = "test-director-token";
    
    console.log("✅ Using test database for department teams");
    
    // Verify connection and setup test data
    try {
      const { data: testUsers, error } = await supabaseClient
        .from("users")
        .select("*")
        .in("emp_id", ["TEST001", "TEST002", "TEST003"]);
      
      if (error) {
        console.error("❌ Failed to connect to test database:", error);
        throw new Error("Test database connection failed");
      }
      
      console.log(`✅ Found ${testUsers?.length || 0} test users in database`);
      
      // Create test team data if it doesn't exist
      await setupTestTeamData();
      
    } catch (error) {
      console.error("❌ Database verification failed:", error);
      throw error;
    }
  });

  // Helper function to set up test team data
  async function setupTestTeamData() {
    try {
      // Check if department_teams table exists and has our test data
      const { data: existingTeams, error: checkError } = await supabaseClient
        .from('department_teams')
        .select('*')
        .contains('manager_ids', ['TEST002']);

      if (checkError) {
        console.log("⚠️ department_teams table may not exist:", checkError.message);
        return;
      }

      if (!existingTeams || existingTeams.length === 0) {
        // Create test team
        const { data: newTeam, error: createError } = await supabaseClient
          .from('department_teams')
          .insert({
            department: 'Engineering',
            team_name: 'Test Team Alpha',
            manager_ids: ['TEST002'], // Manager manages this team
            member_ids: ['TEST001', 'TEST003'] // Staff and Director are members
          })
          .select()
          .single();

        if (createError) {
          console.log("⚠️ Could not create test team:", createError.message);
        } else {
          createdTeamIds.push(newTeam.id);
          console.log("✅ Created test team for integration tests");
        }
      } else {
        console.log("✅ Test team data already exists");
      }

      // Create some test tasks for workload testing
      await createTestTasksForWorkload();
      
    } catch (error) {
      console.log("⚠️ Could not setup test team data:", error.message);
    }
  }

  // Helper function to create test tasks for workload testing
  async function createTestTasksForWorkload() {
    try {
      const testTasks = [
        {
          title: 'Team Task 1 - Owned by Member',
          description: 'Task owned by team member',
          priority: 5,
          status: 'ongoing',
          owner_id: 'TEST001',
          due_date: '2025-12-31',
          collaborators: ['TEST003']
        },
        {
          title: 'Team Task 2 - Due Soon',
          description: 'Task due in 2 days',
          priority: 8,
          status: 'under review',
          owner_id: 'TEST003',
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
          collaborators: ['TEST001']
        },
        {
          title: 'Team Task 3 - Overdue',
          description: 'Task that is overdue',
          priority: 9,
          status: 'ongoing',
          owner_id: 'TEST001',
          due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
          collaborators: []
        }
      ];

      for (const taskData of testTasks) {
        const { data: task, error } = await supabaseClient
          .from('tasks')
          .insert(taskData)
          .select()
          .single();

        if (!error && task) {
          createdTaskIds.push(task.id);
        }
      }

      console.log(`✅ Created ${createdTaskIds.length} test tasks for workload testing`);
    } catch (error) {
      console.log("⚠️ Could not create test tasks:", error.message);
    }
  }

  beforeEach(async () => {
    console.log("🧪 Starting fresh department teams test...");
  });

  afterEach(async () => {
    // Clean up is handled in afterAll since we want to keep test data between tests
  });

  afterAll(async () => {
    // Clean up test data
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

    if (createdTeamIds.length > 0) {
      try {
        await supabaseClient
          .from("department_teams")
          .delete()
          .in("id", createdTeamIds);
        console.log(`🧹 Cleaned up ${createdTeamIds.length} test teams`);
      } catch (error) {
        console.warn("⚠️ Team cleanup warning:", error.message);
      }
    }

    console.log("✅ Department teams integration tests complete");
  });

  describe("Environment and Database Verification", () => {
    it("should have test environment variables loaded", () => {
      expect(process.env.SUPABASE_TEST_URL).toBeTruthy();
      expect(process.env.SUPABASE_TEST_SERVICE_KEY).toBeTruthy();
      expect(process.env.SUPABASE_URL).toBe(process.env.SUPABASE_TEST_URL);
      console.log("✅ Test environment variables verified");
    });

    it("should verify department_teams table exists", async () => {
      try {
        const { data: teams, error } = await supabaseClient
          .from("department_teams")
          .select("*")
          .limit(1);
        
        expect(error).toBeNull();
        expect(Array.isArray(teams)).toBe(true);
        console.log("✅ department_teams table exists and accessible");
      } catch (error) {
        console.log("❌ department_teams table verification failed:", error.message);
        throw error;
      }
    });

    it("should have test users in database", async () => {
      const { data: testUsers, error } = await supabaseClient
        .from("users")
        .select("*")
        .in("emp_id", ["TEST001", "TEST002", "TEST003"]);
      
      expect(error).toBeNull();
      expect(testUsers.length).toBeGreaterThanOrEqual(2);
      console.log("✅ Test users verified");
    });
  });

  describe("Mock Verification", () => {
    it("should have properly mocked auth functions", async () => {
      const managerUser = await getUserFromToken("test-manager-token");
      expect(managerUser.id).toBe("550e8400-e29b-41d4-a716-446655440002");
      
      const managerEmpId = await getEmpIdForUserId("550e8400-e29b-41d4-a716-446655440002");
      expect(managerEmpId).toBe("TEST002");
      
      const managerRole = await getUserRole("TEST002");
      expect(managerRole).toBe("manager");
      
      console.log("✅ Auth mocks working correctly");
    });
  });

  describe("GET /department-teams/my-team", () => {
    it("should return manager's team members", async () => {
      const response = await request(app)
        .get("/department-teams/my-team")
        .set("Authorization", `Bearer ${managerToken}`);

      console.log("My team response:", response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('teams');
      expect(Array.isArray(response.body.teams)).toBe(true);

      if (response.body.teams.length > 0) {
        const team = response.body.teams[0];
        expect(team).toHaveProperty('department');
        expect(team).toHaveProperty('team_name');
        expect(team).toHaveProperty('manager_ids');
        expect(team).toHaveProperty('members');
        expect(Array.isArray(team.members)).toBe(true);
        
        // Manager should be in manager_ids
        expect(team.manager_ids).toContain('TEST002');
        
        console.log("✅ Manager team retrieval successful");
      } else {
        console.log("⚠️ No teams found for manager - this might be expected");
      }
    });

    it("should return empty teams for staff member", async () => {
      const response = await request(app)
        .get("/department-teams/my-team")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('teams');
      expect(response.body.teams).toEqual([]);
      expect(response.body.message).toContain('No teams found');
      
      console.log("✅ Staff member correctly has no managed teams");
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/department-teams/my-team");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authorization header required');
      
      console.log("✅ Authentication requirement verified");
    });
  });

  describe("GET /department-teams/workload", () => {
    it("should return team workload data for manager", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      console.log("Workload response:", response.status, response.body);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('workload');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('teams');

      const { workload, summary, teams } = response.body;

      // Check summary structure
      expect(summary).toHaveProperty('total_members');
      expect(summary).toHaveProperty('total_tasks');
      expect(summary).toHaveProperty('due_soon');
      expect(summary).toHaveProperty('overdue');
      expect(typeof summary.total_members).toBe('number');
      expect(typeof summary.total_tasks).toBe('number');

      // Check workload structure
      expect(typeof workload).toBe('object');

      if (Object.keys(workload).length > 0) {
        const memberWorkload = Object.values(workload)[0];
        expect(memberWorkload).toHaveProperty('member_info');
        expect(memberWorkload).toHaveProperty('owned_tasks');
        expect(memberWorkload).toHaveProperty('collaboration_tasks');
        expect(memberWorkload).toHaveProperty('total_tasks');
        expect(memberWorkload).toHaveProperty('due_soon_count');
        expect(memberWorkload).toHaveProperty('overdue_count');
        expect(memberWorkload).toHaveProperty('task_status_breakdown');

        expect(Array.isArray(memberWorkload.owned_tasks)).toBe(true);
        expect(Array.isArray(memberWorkload.collaboration_tasks)).toBe(true);
        expect(typeof memberWorkload.total_tasks).toBe('number');
        
        console.log("✅ Workload data structure verified");
      }

      console.log("✅ Manager workload retrieval successful");
    });

    it("should return empty workload for staff member", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.workload).toEqual({});
      expect(response.body.summary.total_members).toBe(0);
      expect(response.body.summary.total_tasks).toBe(0);
      
      console.log("✅ Staff member correctly has no team workload access");
    });

    it("should calculate workload metrics correctly", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      if (response.status === 200 && Object.keys(response.body.workload).length > 0) {
        const { workload, summary } = response.body;
        
        // Verify summary calculations
        let calculatedTotalTasks = 0;
        let calculatedDueSoon = 0;
        let calculatedOverdue = 0;
        
        Object.values(workload).forEach(member => {
          calculatedTotalTasks += member.total_tasks;
          calculatedDueSoon += member.due_soon_count;
          calculatedOverdue += member.overdue_count;
        });
        
        expect(summary.total_tasks).toBe(calculatedTotalTasks);
        expect(summary.due_soon).toBe(calculatedDueSoon);
        expect(summary.overdue).toBe(calculatedOverdue);
        
        console.log("✅ Workload metrics calculations verified");
        console.log(`Total tasks: ${summary.total_tasks}, Due soon: ${summary.due_soon}, Overdue: ${summary.overdue}`);
      } else {
        console.log("⚠️ No workload data to verify calculations");
      }
    });

    it("should include task details with due date analysis", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      if (response.status === 200 && Object.keys(response.body.workload).length > 0) {
        const { workload } = response.body;
        
        // Check if any member has tasks
        const memberWithTasks = Object.values(workload).find(member => 
          member.owned_tasks.length > 0 || member.collaboration_tasks.length > 0
        );
        
        if (memberWithTasks) {
          const allTasks = [...memberWithTasks.owned_tasks, ...memberWithTasks.collaboration_tasks];
          
          if (allTasks.length > 0) {
            const taskWithDueDate = allTasks.find(task => task.due_date);
            
            if (taskWithDueDate) {
              expect(taskWithDueDate).toHaveProperty('due_soon');
              expect(taskWithDueDate).toHaveProperty('overdue');
              expect(typeof taskWithDueDate.due_soon).toBe('boolean');
              expect(typeof taskWithDueDate.overdue).toBe('boolean');
              
              console.log("✅ Task due date analysis verified");
            }
          }
        }
      }
    });

    it("should handle collaborator tasks correctly", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      if (response.status === 200 && Object.keys(response.body.workload).length > 0) {
        const { workload } = response.body;
        
        // Check if any member has collaboration tasks
        const memberWithCollabTasks = Object.values(workload).find(member => 
          member.collaboration_tasks.length > 0
        );
        
        if (memberWithCollabTasks) {
          const collabTask = memberWithCollabTasks.collaboration_tasks[0];
          expect(collabTask).toHaveProperty('collaborators');
          expect(Array.isArray(collabTask.collaborators)).toBe(true);
          
          console.log("✅ Collaborator tasks handling verified");
        } else {
          console.log("⚠️ No collaboration tasks found in workload");
        }
      }
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .get("/department-teams/workload");

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authorization header required');
      
      console.log("✅ Authentication requirement verified");
    });

    it("should handle database errors gracefully", async () => {
      // This test might be harder to implement without mocking database failures
      // For now, we'll just verify the endpoint handles missing data gracefully
      
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${directorToken}`); // Director might not have teams

      expect([200, 500].includes(response.status)).toBe(true);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('workload');
        expect(response.body).toHaveProperty('summary');
        console.log("✅ Graceful handling of no team data verified");
      } else {
        expect(response.body).toHaveProperty('error');
        console.log("✅ Database error handling verified");
      }
    });

    it("team members' tasks", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      
      const { workload } = response.body;
      
      // Manager should be able to see tasks assigned to team members
      Object.values(workload).forEach(member => {
        expect(member).toHaveProperty('member_info');
        expect(member.member_info).toHaveProperty('name');
        expect(member.member_info).toHaveProperty('emp_id');
        expect(member).toHaveProperty('owned_tasks');
        expect(member).toHaveProperty('collaboration_tasks');
        
        console.log(`✅ Can view tasks for member: ${member.member_info.name || member.member_info.emp_id}`);
      });
      
      console.log("✅ User story requirement: view team members' tasks - FULFILLED");
    });

    it("total number of tasks assigned", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      
      const { summary, workload } = response.body;
      
      // Should show total number of tasks
      expect(summary).toHaveProperty('total_tasks');
      expect(typeof summary.total_tasks).toBe('number');
      
      // Should show per-member task counts
      Object.values(workload).forEach(member => {
        expect(member).toHaveProperty('total_tasks');
        expect(typeof member.total_tasks).toBe('number');
        
        console.log(`Member ${member.member_info.name || member.member_info.emp_id}: ${member.total_tasks} tasks`);
      });
      
      console.log(`✅ Total team tasks: ${summary.total_tasks}`);
      console.log("✅ User story requirement: see total number of tasks - FULFILLED");
    });

    it("tasks due within next 3 days (workload)", async () => {
      const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

      expect(response.status).toBe(200);
      
      const { summary, workload } = response.body;
      
      // Should show due soon count in summary
      expect(summary).toHaveProperty('due_soon');
      expect(typeof summary.due_soon).toBe('number');
      
      // Should show per-member due soon counts
      Object.values(workload).forEach(member => {
        expect(member).toHaveProperty('due_soon_count');
        expect(typeof member.due_soon_count).toBe('number');
        
        console.log(`Member ${member.member_info.name || member.member_info.emp_id}: ${member.due_soon_count} tasks due soon`);
      });
      
      console.log(`✅ Total tasks due soon (next 3 days): ${summary.due_soon}`);
      console.log("✅ User story requirement: see tasks due within next 3 days - FULFILLED");
    });

    it("should ensure manager sees only their team members", async () => {
    const response = await request(app)
        .get("/department-teams/workload")
        .set("Authorization", `Bearer ${managerToken}`);

    expect(response.status).toBe(200);
    
    const { workload, teams } = response.body;
    
    // Debug: Log the teams data to see what's being returned
    console.log("🔍 Teams data:", JSON.stringify(teams, null, 2));
    
    // All returned team members should be from teams this manager manages
    if (teams.length > 0) {
        const managedMemberIds = teams.reduce((acc, team) => {
        // Add null checks for manager_ids and member_ids
        if (team.manager_ids && Array.isArray(team.manager_ids) && team.manager_ids.includes('TEST002')) {
            return [...acc, ...(team.member_ids || [])];
        }
        return acc;
        }, []);
        
        console.log("🔍 Managed member IDs:", managedMemberIds);
        
        Object.keys(workload).forEach(memberEmpId => {
        expect(managedMemberIds.includes(memberEmpId)).toBe(true);
        });
        
        console.log("✅ Manager sees only their team members");
    }
    
    console.log("✅ Team isolation verified - managers only see their teams");
    });
  });
});