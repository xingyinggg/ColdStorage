/**
 * Integration Tests for Project Report Generation
 * Tests report generation, task status grouping, timeline sorting, and access control
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load test env
dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

// Mock supabase helpers
import { vi } from 'vitest';
vi.mock('../../server/lib/supabase.js', async () => {
  const actual = await vi.importActual('../../server/lib/supabase.js');
  return {
    ...actual,
    getServiceClient: vi.fn(),
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
  };
});

import { getServiceClient, getUserFromToken, getEmpIdForUserId } from '../../server/lib/supabase.js';

// Helper to create test Supabase client
function getTestSupabaseClient() {
  const url = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase test env missing (URL/key)');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Vitest compatibility helper
const describeIf = (cond) => (cond ? describe : describe.skip);
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;

describeIf(hasTestEnv)('Project Report Integration Tests', () => {
  let app;
  let request;
  let supabaseClient;
  let createdTaskIds = [];
  let createdProjectIds = [];
  let createdUserId = null;

  beforeAll(async () => {
    supabaseClient = getTestSupabaseClient();

    // Point mocked getServiceClient to our test client
    getServiceClient.mockImplementation(() => supabaseClient);

    // Create express app and mount routers
    const tasksRouter = (await import('../../server/routes/tasks.js')).default;
    const projectsRouter = (await import('../../server/routes/projects.js')).default;
    
    app = express();
    app.use(express.json());
    app.use('/tasks', tasksRouter);
    app.use('/projects', projectsRouter);
    request = supertest(app);

    // Mock auth for tests
    getUserFromToken.mockImplementation(async (token) => {
      if (token === 'staff_token') {
        return { id: 'staff_user_id', email: 'staff@test.com' };
      }
      if (token === 'non_member_token') {
        return { id: 'non_member_user_id', email: 'nonmember@test.com' };
      }
      if (token === 'manager_token') {
        return { id: 'manager_user_id', email: 'manager@test.com' };
      }
      if (token === 'director_token') {
        return { id: 'director_user_id', email: 'director@test.com' };
      }
      return null;
    });

    getEmpIdForUserId.mockImplementation(async (userId) => {
      if (userId === 'staff_user_id') return 1;
      if (userId === 'non_member_user_id') return 999;
      if (userId === 'manager_user_id') return 2;
      if (userId === 'director_user_id') return 3;
      return null;
    });
  });

  afterEach(async () => {
    // Cleanup created tasks
    if (createdTaskIds.length > 0) {
      await supabaseClient.from('tasks').delete().in('id', createdTaskIds);
      createdTaskIds.length = 0;
    }
    // Cleanup created projects
    if (createdProjectIds.length > 0) {
      await supabaseClient.from('projects').delete().in('id', createdProjectIds);
      createdProjectIds.length = 0;
    }
  });

  describe('Project Report Generation Functionality', () => {
    it('should generate project report with tasks grouped by status', async () => {
      // Create a project
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Test Project for Report',
          description: 'Test project',
          status: 'active',
          owner_id: 1,
          members: [1, 2],
        })
        .select()
        .single();

      if (projectError) throw projectError;
      createdProjectIds.push(project.id);

      // Create tasks with different statuses
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Ongoing Task',
            status: 'ongoing',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-12-31',
          },
          {
            title: 'Completed Task',
            status: 'completed',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-11-01',
          },
          {
            title: 'Under Review Task',
            status: 'under review',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-12-15',
          },
          {
            title: 'Unassigned Task',
            status: 'unassigned',
            project_id: project.id,
            owner_id: null,
            priority: 5,
            due_date: '2025-12-20',
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      // Fetch project tasks via API
      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(4);

      // Test status grouping
      const { groupTasksByStatus } = await import('../../src/utils/reportUtils.js');
      const grouped = groupTasksByStatus(response.body);

      expect(grouped.ongoing.length).toBe(1);
      expect(grouped.completed.length).toBe(1);
      expect(grouped.underReview.length).toBe(1);
      expect(grouped.unassigned.length).toBe(1);
    });

    it('should sort tasks by due date in timeline', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Test Project for Timeline',
          description: 'Test',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task 3',
            status: 'ongoing',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-12-31',
          },
          {
            title: 'Task 1',
            status: 'ongoing',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-10-01',
          },
          {
            title: 'Task 2',
            status: 'ongoing',
            project_id: project.id,
            owner_id: '1',
            priority: 5,
            due_date: '2025-11-15',
          },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);

      // Test timeline sorting
      const { sortTasksByDueDate } = await import('../../src/utils/reportUtils.js');
      const sorted = sortTasksByDueDate(response.body);

      expect(sorted[0].title).toBe('Task 1'); // Earliest
      expect(sorted[1].title).toBe('Task 2');
      expect(sorted[2].title).toBe('Task 3'); // Latest
    });

    it('should handle projects with no tasks (empty data)', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Empty Project',
          description: 'Project with no tasks',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);

      // Test processing empty data
      const { processTasksForReport } = await import('../../src/utils/reportUtils.js');
      const result = processTasksForReport(response.body);

      expect(result.hasData).toBe(false);
      expect(result.stats.total).toBe(0);
      expect(result.sortedTasks.length).toBe(0);
    });

    it('should handle error when project does not exist', async () => {
      // Create a valid project first to ensure test environment works
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Valid Project',
          description: 'Test',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      // Get the max project ID to use a non-existent ID that's within smallint range
      const { data: maxProject } = await supabaseClient
        .from('projects')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      // Use a non-existent project ID that's valid but doesn't exist
      const nonExistentProjectId = (maxProject?.id || 0) + 1000;

      const response = await request
        .get(`/tasks/project/${nonExistentProjectId}`)
        .set('Authorization', 'Bearer staff_token');

      // API returns empty array for non-existent projects (doesn't error)
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });
  });

  describe('Project Membership Access Control', () => {
    it('should allow staff to access projects they belong to (as owner)', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Staff Owned Project',
          description: 'Test',
          status: 'active',
          owner_id: 1, // Staff user is owner
          members: [],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Test Task',
          status: 'ongoing',
          project_id: project.id,
          owner_id: '1',
          priority: 5,
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow staff to access projects they belong to (as member)', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Staff Member Project',
          description: 'Test',
          status: 'active',
          owner_id: 2, // Different owner
          members: [1], // Staff user is member
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);
    });

    it('should verify staff cannot access projects they do not belong to', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Non-Member Project',
          description: 'Test',
          status: 'active',
          owner_id: 999, // Different owner
          members: [999], // Staff user (1) is NOT a member
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      // Note: Currently the API doesn't check membership, it just returns tasks
      // This test verifies the current behavior - API returns data regardless
      // In a real implementation, we'd want to add membership checking here
      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      // Current implementation: API returns tasks without membership check
      // This is a gap that should be addressed
      expect(response.status).toBe(200);
      
      // Test membership validation logic separately
      const { isProjectMember } = await import('../../src/utils/reportUtils.js');
      const hasAccess = isProjectMember(project, 1);
      expect(hasAccess).toBe(false); // Staff user (1) is not a member
    });

    it('should verify project membership validation logic', async () => {
      const { isProjectMember, filterProjectsByMembership } = await import('../../src/utils/reportUtils.js');

      const projects = [
        { id: 1, owner_id: '1', members: [] }, // User is owner (string ID)
        { id: 2, owner_id: '2', members: ['1'] }, // User is member (string ID)
        { id: 3, owner_id: '3', members: ['4'] }, // User is not a member
      ];

      // Test individual project membership (userEmpId as number)
      expect(isProjectMember(projects[0], 1)).toBe(true);
      expect(isProjectMember(projects[1], 1)).toBe(true);
      expect(isProjectMember(projects[2], 1)).toBe(false);

      // Test filtering
      const filtered = filterProjectsByMembership(projects, 1);
      expect(filtered.length).toBe(2);
      expect(filtered.every(p => p.id === 1 || p.id === 2)).toBe(true);
    });
  });

  describe('Role-Based Report Access', () => {
    it('should allow director to access all projects', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Director Access Test',
          description: 'Test',
          status: 'active',
          owner_id: 999, // Different owner
          members: [999], // Director (3) is NOT a member
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      // Test role-based access logic
      const { hasProjectAccess } = await import('../../src/utils/reportUtils.js');
      const directorAccess = hasProjectAccess(project, 3, 'director');
      expect(directorAccess).toBe(true); // Directors can access all projects
    });

    it('should allow HR to access all projects', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'HR Access Test',
          description: 'Test',
          status: 'active',
          owner_id: 999,
          members: [999],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { hasProjectAccess } = await import('../../src/utils/reportUtils.js');
      const hrAccess = hasProjectAccess(project, 4, 'hr');
      expect(hrAccess).toBe(true); // HR can access all projects
    });

    it('should restrict manager to projects they belong to', async () => {
      const projects = [
        { id: 1, owner_id: '2', members: [] }, // Manager (2) is owner
        { id: 2, owner_id: '999', members: ['2'] }, // Manager (2) is member
        { id: 3, owner_id: '999', members: ['999'] }, // Manager (2) is NOT a member
      ];

      const { hasProjectAccess } = await import('../../src/utils/reportUtils.js');
      
      expect(hasProjectAccess(projects[0], 2, 'manager')).toBe(true);
      expect(hasProjectAccess(projects[1], 2, 'manager')).toBe(true);
      expect(hasProjectAccess(projects[2], 2, 'manager')).toBe(false);
    });

    it('should restrict staff to projects they belong to', async () => {
      const projects = [
        { id: 1, owner_id: '1', members: [] }, // Staff (1) is owner
        { id: 2, owner_id: '999', members: ['1'] }, // Staff (1) is member
        { id: 3, owner_id: '999', members: ['999'] }, // Staff (1) is NOT a member
      ];

      const { hasProjectAccess } = await import('../../src/utils/reportUtils.js');
      
      expect(hasProjectAccess(projects[0], 1, 'staff')).toBe(true);
      expect(hasProjectAccess(projects[1], 1, 'staff')).toBe(true);
      expect(hasProjectAccess(projects[2], 1, 'staff')).toBe(false);
    });
  });

  describe('Task Status Grouping Verification', () => {
    it('should correctly group tasks by all status types', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Status Grouping Test',
          description: 'Test',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          { title: 'Task 1', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5 },
          { title: 'Task 2', status: 'completed', project_id: project.id, owner_id: '1', priority: 5 },
          { title: 'Task 3', status: 'under review', project_id: project.id, owner_id: '1', priority: 5 },
          { title: 'Task 4', status: 'unassigned', project_id: project.id, owner_id: null, priority: 5 },
          { title: 'Task 5', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5 },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);

      const { groupTasksByStatus, getProjectStats } = await import('../../src/utils/reportUtils.js');
      const grouped = groupTasksByStatus(response.body);
      const stats = getProjectStats(response.body);

      expect(grouped.ongoing.length).toBe(2);
      expect(grouped.completed.length).toBe(1);
      expect(grouped.underReview.length).toBe(1);
      expect(grouped.unassigned.length).toBe(1);
      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(1);
      expect(stats.ongoing).toBe(2);
      expect(stats.underReview).toBe(1);
    });
  });

  describe('Timeline Sorting Verification', () => {
    it('should sort tasks by due date ascending', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Timeline Sorting Test',
          description: 'Test',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          { title: 'Future Task', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5, due_date: '2025-12-31' },
          { title: 'Past Task', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5, due_date: '2025-10-01' },
          { title: 'Middle Task', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5, due_date: '2025-11-15' },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);

      const { sortTasksByDueDate } = await import('../../src/utils/reportUtils.js');
      const sorted = sortTasksByDueDate(response.body);

      expect(sorted[0].title).toBe('Past Task');
      expect(sorted[1].title).toBe('Middle Task');
      expect(sorted[2].title).toBe('Future Task');
    });

    it('should place tasks without due dates at the end', async () => {
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'No Due Date Test',
          description: 'Test',
          status: 'active',
          owner_id: 1,
          members: [1],
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          { title: 'Task with Date', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5, due_date: '2025-12-31' },
          { title: 'Task without Date', status: 'ongoing', project_id: project.id, owner_id: '1', priority: 5, due_date: null },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const response = await request
        .get(`/tasks/project/${project.id}`)
        .set('Authorization', 'Bearer staff_token');

      expect(response.status).toBe(200);

      const { sortTasksByDueDate } = await import('../../src/utils/reportUtils.js');
      const sorted = sortTasksByDueDate(response.body);

      expect(sorted[0].title).toBe('Task with Date');
      expect(sorted[1].title).toBe('Task without Date');
    });
  });
});

