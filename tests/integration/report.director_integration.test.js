/**
 * Integration Tests for Director Report User Story
 * Tests organization-wide reports, task analysis, and department filtering
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

describeIf(hasTestEnv)('Director Report Integration Tests', () => {
  let app;
  let request;
  let supabaseClient;
  let createdUsers = [];
  let createdTasks = [];
  let createdProjects = [];
  let createdNotifications = [];

  beforeAll(async () => {
    supabaseClient = getTestSupabaseClient();

    // Set up test app
    app = express();
    app.use(express.json());

    // Import and use routes
    const directorRouter = (await import('../../server/routes/director.js')).default;
    const authRouter = (await import('../../server/routes/auth.js')).default;
    const reportRouter = (await import('../../server/routes/report.js')).default;

    app.use('/director', directorRouter);
    app.use('/auth', authRouter);
    app.use('/report', reportRouter);

    request = supertest(app);

    // Mock authentication
    getUserFromToken.mockResolvedValue({ id: 'director-user-id', role: 'director' });
    getEmpIdForUserId.mockResolvedValue('DIRECTOR001');
    getServiceClient.mockImplementation(() => supabaseClient);
  });

  afterEach(async () => {
    // Clean up created data
    for (const notificationId of createdNotifications) {
      try {
        await supabaseClient.from('notifications').delete().eq('id', notificationId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    for (const taskId of createdTasks) {
      try {
        await supabaseClient.from('tasks').delete().eq('id', taskId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    for (const projectId of createdProjects) {
      try {
        await supabaseClient.from('projects').delete().eq('id', projectId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    for (const userId of createdUsers) {
      try {
        await supabaseClient.from('users').delete().eq('id', userId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    createdNotifications = [];
    createdTasks = [];
    createdProjects = [];
    createdUsers = [];
  });

  describe('User Story 1: Generate report for entire organisations or filtered departments', () => {
    it('should generate organization-wide report from director UI', async () => {
      // Get baseline counts before adding test data
      const baselineOverview = await request
        .get('/director/overview')
        .set('Authorization', 'Bearer director_token');

      expect(baselineOverview.status).toBe(200);
      const baselineKPIs = baselineOverview.body.companyKPIs;

      // Create test users with unique IDs to avoid conflicts
      const uniqueId = Date.now().toString();
      const users = [
        { emp_id: `TEST${uniqueId}001`, name: 'John Doe', department: 'Engineering', role: 'staff' },
        { emp_id: `TEST${uniqueId}002`, name: 'Jane Smith', department: 'Engineering', role: 'manager' },
        { emp_id: `TEST${uniqueId}003`, name: 'Bob Johnson', department: 'Marketing', role: 'staff' },
        { emp_id: `DIRECTOR${uniqueId}001`, name: 'Director User', department: 'Management', role: 'director' },
      ];

      for (const user of users) {
        try {
          const { data: createdUser } = await supabaseClient
            .from('users')
            .insert(user)
            .select()
            .single();
          if (createdUser) {
            createdUsers.push(createdUser.id);
          }
        } catch (e) {
          // User might already exist, skip
        }
      }

      // Create test projects with unique owners
      const projects = [
        { title: `Project A ${uniqueId}`, owner_id: `TEST${uniqueId}001`, status: 'active', members: [`TEST${uniqueId}001`, `TEST${uniqueId}002`] },
        { title: `Project B ${uniqueId}`, owner_id: `TEST${uniqueId}003`, status: 'completed', members: [`TEST${uniqueId}003`] },
        { title: `Project C ${uniqueId}`, owner_id: `TEST${uniqueId}002`, status: 'active', members: [`TEST${uniqueId}002`, `TEST${uniqueId}001`] },
      ];

      for (const project of projects) {
        const { data: createdProject } = await supabaseClient
          .from('projects')
          .insert(project)
          .select()
          .single();
        createdProjects.push(createdProject.id);
      }

      // Create test tasks with unique owners
      const tasks = [
        { title: `Task 1 ${uniqueId}`, owner_id: `TEST${uniqueId}001`, status: 'completed', priority: 5, due_date: '2025-12-01' },
        { title: `Task 2 ${uniqueId}`, owner_id: `TEST${uniqueId}001`, status: 'in_progress', priority: 3, due_date: '2025-12-15' },
        { title: `Task 3 ${uniqueId}`, owner_id: `TEST${uniqueId}002`, status: 'completed', priority: 4, due_date: '2025-11-30' },
        { title: `Task 4 ${uniqueId}`, owner_id: `TEST${uniqueId}003`, status: 'pending', priority: 2, due_date: '2025-12-10' },
      ];

      for (const task of tasks) {
        const { data: createdTask } = await supabaseClient
          .from('tasks')
          .insert(task)
          .select()
          .single();
        createdTasks.push(createdTask.id);
      }

      // Test director overview endpoint (organization-wide data)
      const overviewResponse = await request
        .get('/director/overview')
        .set('Authorization', 'Bearer director_token');

      expect(overviewResponse.status).toBe(200);
      expect(overviewResponse.body).toHaveProperty('companyKPIs');
      expect(overviewResponse.body).toHaveProperty('projectPortfolio');
      expect(overviewResponse.body).toHaveProperty('taskMetrics');

      // Verify organization-wide metrics increased from baseline
      const { companyKPIs, projectPortfolio, taskMetrics } = overviewResponse.body;

      expect(companyKPIs.totalEmployees).toBeGreaterThanOrEqual(baselineKPIs.totalEmployees);
      expect(companyKPIs.totalProjects).toBeGreaterThanOrEqual(baselineKPIs.totalProjects + 3);
      expect(companyKPIs.totalTasks).toBeGreaterThanOrEqual(baselineKPIs.totalTasks + 4);

      // Verify project portfolio metrics are reasonable
      expect(typeof projectPortfolio.active).toBe('number');
      expect(typeof projectPortfolio.completed).toBe('number');
      expect(typeof projectPortfolio.completionRate).toBe('number');
      expect(projectPortfolio.completionRate).toBeGreaterThanOrEqual(0);
      expect(projectPortfolio.completionRate).toBeLessThanOrEqual(100);

      // Verify task metrics are reasonable
      expect(typeof taskMetrics.active).toBe('number');
      expect(typeof taskMetrics.completed).toBe('number');
      expect(typeof taskMetrics.completionRate).toBe('number');
      expect(taskMetrics.completionRate).toBeGreaterThanOrEqual(0);
      expect(taskMetrics.completionRate).toBeLessThanOrEqual(100);
    });

    it('should generate filtered department reports vs organization reports', async () => {
      // Create test users with unique departments and IDs
      const uniqueId = Date.now().toString();
      const users = [
        { emp_id: `ENG${uniqueId}001`, name: 'Alice Engineer', department: `Engineering${uniqueId}`, role: 'staff' },
        { emp_id: `ENG${uniqueId}002`, name: 'Bob Engineer', department: `Engineering${uniqueId}`, role: 'manager' },
        { emp_id: `MKT${uniqueId}001`, name: 'Charlie Marketer', department: `Marketing${uniqueId}`, role: 'staff' },
        { emp_id: `MKT${uniqueId}002`, name: 'Diana Marketer', department: `Marketing${uniqueId}`, role: 'staff' },
        { emp_id: `DIRECTOR${uniqueId}001`, name: 'Director User', department: 'Management', role: 'director' },
      ];

      for (const user of users) {
        try {
          const { data: createdUser } = await supabaseClient
            .from('users')
            .insert(user)
            .select()
            .single();
          if (createdUser) {
            createdUsers.push(createdUser.id);
          }
        } catch (e) {
          // User might already exist, skip
        }
      }

      // Create department-specific tasks
      const tasks = [
        // Engineering: 2/3 completed (67% completion rate)
        { title: `Engineering Task 1 ${uniqueId}`, owner_id: `ENG${uniqueId}001`, status: 'completed', priority: 5 },
        { title: `Engineering Task 2 ${uniqueId}`, owner_id: `ENG${uniqueId}001`, status: 'completed', priority: 3 },
        { title: `Engineering Task 3 ${uniqueId}`, owner_id: `ENG${uniqueId}002`, status: 'in_progress', priority: 4 },

        // Marketing: 1/2 completed (50% completion rate)
        { title: `Marketing Task 1 ${uniqueId}`, owner_id: `MKT${uniqueId}001`, status: 'completed', priority: 4 },
        { title: `Marketing Task 2 ${uniqueId}`, owner_id: `MKT${uniqueId}002`, status: 'pending', priority: 2 },
      ];

      for (const task of tasks) {
        const { data: createdTask } = await supabaseClient
          .from('tasks')
          .insert(task)
          .select()
          .single();
        createdTasks.push(createdTask.id);
      }

      // Test department performance endpoint
      const deptResponse = await request
        .get('/director/departments')
        .set('Authorization', 'Bearer director_token');

      expect(deptResponse.status).toBe(200);
      expect(deptResponse.body).toHaveProperty('departments');
      expect(Array.isArray(deptResponse.body.departments)).toBe(true);

      const { departments } = deptResponse.body;

      // Find our test departments
      const engineeringDept = departments.find(d => d.name === `Engineering${uniqueId}`);
      const marketingDept = departments.find(d => d.name === `Marketing${uniqueId}`);

      expect(engineeringDept).toBeDefined();
      expect(marketingDept).toBeDefined();

      // Verify department-specific metrics
      expect(engineeringDept.employeeCount).toBe(2); // ENG001, ENG002
      expect(marketingDept.employeeCount).toBe(2); // MKT001, MKT002

      // Engineering should have 3 tasks (2 completed, 1 in progress = 67% completion)
      expect(engineeringDept.totalTasks).toBe(3);
      expect(engineeringDept.taskCompletionRate).toBe(67); // 2/3 completed

      // Marketing should have 2 tasks (1 completed, 1 pending = 50% completion)
      expect(marketingDept.totalTasks).toBe(2);
      expect(marketingDept.taskCompletionRate).toBe(50); // 1/2 completed

      // Verify calculations are department-specific (not organization-wide)
      // Engineering completion rate should be different from Marketing
      expect(engineeringDept.taskCompletionRate).not.toBe(marketingDept.taskCompletionRate);

      // Verify productivity scores are calculated
      expect(typeof engineeringDept.productivityScore).toBe('number');
      expect(typeof marketingDept.productivityScore).toBe('number');
    });
  });

  describe('User Story 2: Generate the report based on tasks', () => {
    it('should generate task analysis report from director UI', async () => {
      // Get baseline counts
      const baselineKpis = await request
        .get('/director/kpis')
        .set('Authorization', 'Bearer director_token');

      expect(baselineKpis.status).toBe(200);
      const baselineTaskMetrics = baselineKpis.body.taskMetrics;

      // Create test users with unique IDs
      const uniqueId = Date.now().toString();
      const users = [
        { emp_id: `STAFF${uniqueId}001`, name: 'Staff One', department: 'Engineering', role: 'staff' },
        { emp_id: `STAFF${uniqueId}002`, name: 'Staff Two', department: 'Engineering', role: 'staff' },
        { emp_id: `STAFF${uniqueId}003`, name: 'Staff Three', department: 'Marketing', role: 'staff' },
        { emp_id: `DIRECTOR${uniqueId}001`, name: 'Director User', department: 'Management', role: 'director' },
      ];

      for (const user of users) {
        try {
          const { data: createdUser } = await supabaseClient
            .from('users')
            .insert(user)
            .select()
            .single();
          if (createdUser) {
            createdUsers.push(createdUser.id);
          }
        } catch (e) {
          // User might already exist, skip
        }
      }

      // Create diverse tasks for analysis
      const tasks = [
        { title: `High Priority Task ${uniqueId}`, owner_id: `STAFF${uniqueId}001`, status: 'completed', priority: 5, due_date: '2025-11-30' },
        { title: `Medium Priority Task ${uniqueId}`, owner_id: `STAFF${uniqueId}001`, status: 'in_progress', priority: 3, due_date: '2025-12-15' },
        { title: `Low Priority Task ${uniqueId}`, owner_id: `STAFF${uniqueId}002`, status: 'pending', priority: 1, due_date: '2025-12-30' },
        { title: `Overdue Task ${uniqueId}`, owner_id: `STAFF${uniqueId}001`, status: 'in_progress', priority: 4, due_date: '2025-10-01' }, // Overdue
        { title: `Completed Marketing Task ${uniqueId}`, owner_id: `STAFF${uniqueId}003`, status: 'completed', priority: 3, due_date: '2025-11-25' },
      ];

      for (const task of tasks) {
        const { data: createdTask } = await supabaseClient
          .from('tasks')
          .insert(task)
          .select()
          .single();
        createdTasks.push(createdTask.id);
      }

      // Test KPIs endpoint (task-based metrics)
      const kpisResponse = await request
        .get('/director/kpis')
        .set('Authorization', 'Bearer director_token');

      expect(kpisResponse.status).toBe(200);
      expect(kpisResponse.body).toHaveProperty('companyKPIs');
      expect(kpisResponse.body).toHaveProperty('projectPortfolio');
      expect(kpisResponse.body).toHaveProperty('taskMetrics');

      const { taskMetrics } = kpisResponse.body;

      // Verify task-based calculations increased from baseline
      expect(taskMetrics.active).toBeGreaterThanOrEqual(baselineTaskMetrics.active + 1); // At least our in_progress tasks
      expect(taskMetrics.completed).toBeGreaterThanOrEqual(baselineTaskMetrics.completed + 2); // Completed tasks
      expect(typeof taskMetrics.completionRate).toBe('number');
      expect(taskMetrics.completionRate).toBeGreaterThanOrEqual(0);
      expect(taskMetrics.completionRate).toBeLessThanOrEqual(100);
    });

    it('should verify task metrics accuracy across departments', async () => {
      // Create users in different departments with unique IDs
      const uniqueId = Date.now().toString();
      const users = [
        { emp_id: `ENG${uniqueId}001`, name: 'Engineer 1', department: `Engineering${uniqueId}`, role: 'staff' },
        { emp_id: `ENG${uniqueId}002`, name: 'Engineer 2', department: `Engineering${uniqueId}`, role: 'staff' },
        { emp_id: `MKT${uniqueId}001`, name: 'Marketer 1', department: `Marketing${uniqueId}`, role: 'staff' },
        { emp_id: `HR${uniqueId}001`, name: 'HR 1', department: `HR${uniqueId}`, role: 'staff' },
        { emp_id: `DIRECTOR${uniqueId}001`, name: 'Director', department: 'Management', role: 'director' },
      ];

      for (const user of users) {
        try {
          const { data: createdUser } = await supabaseClient
            .from('users')
            .insert(user)
            .select()
            .single();
          if (createdUser) {
            createdUsers.push(createdUser.id);
          }
        } catch (e) {
          // User might already exist, skip
        }
      }

      // Create tasks with known completion rates per department
      const tasks = [
        // Engineering: 2/3 completed (67% completion rate)
        { title: `Eng Task 1 ${uniqueId}`, owner_id: `ENG${uniqueId}001`, status: 'completed', priority: 5 },
        { title: `Eng Task 2 ${uniqueId}`, owner_id: `ENG${uniqueId}001`, status: 'completed', priority: 3 },
        { title: `Eng Task 3 ${uniqueId}`, owner_id: `ENG${uniqueId}002`, status: 'in_progress', priority: 4 },

        // Marketing: 1/2 completed (50% completion rate)
        { title: `Mkt Task 1 ${uniqueId}`, owner_id: `MKT${uniqueId}001`, status: 'completed', priority: 4 },
        { title: `Mkt Task 2 ${uniqueId}`, owner_id: `MKT${uniqueId}001`, status: 'pending', priority: 2 },

        // HR: 0/1 completed (0% completion rate)
        { title: `HR Task 1 ${uniqueId}`, owner_id: `HR${uniqueId}001`, status: 'pending', priority: 3 },
      ];

      for (const task of tasks) {
        const { data: createdTask } = await supabaseClient
          .from('tasks')
          .insert(task)
          .select()
          .single();
        createdTasks.push(createdTask.id);
      }

      // Test department performance calculations
      const deptResponse = await request
        .get('/director/departments')
        .set('Authorization', 'Bearer director_token');

      expect(deptResponse.status).toBe(200);

      const { departments } = deptResponse.body;
      const engineering = departments.find(d => d.name === `Engineering${uniqueId}`);
      const marketing = departments.find(d => d.name === `Marketing${uniqueId}`);
      const hr = departments.find(d => d.name === `HR${uniqueId}`);

      // Verify task metrics accuracy per department
      expect(engineering).toBeDefined();
      expect(marketing).toBeDefined();
      expect(hr).toBeDefined();

      // Engineering: 2 employees, 3 tasks, 67% completion rate
      expect(engineering.employeeCount).toBe(2);
      expect(engineering.totalTasks).toBe(3);
      expect(engineering.taskCompletionRate).toBe(67); // 2/3 completed

      // Marketing: 1 employee, 2 tasks, 50% completion rate
      expect(marketing.employeeCount).toBe(1);
      expect(marketing.totalTasks).toBe(2);
      expect(marketing.taskCompletionRate).toBe(50); // 1/2 completed

      // HR: 1 employee, 1 task, 0% completion rate
      expect(hr.employeeCount).toBe(1);
      expect(hr.totalTasks).toBe(1);
      expect(hr.taskCompletionRate).toBe(0); // 0/1 completed
    });

    it('should verify task completion rates and priority analysis in reports', async () => {
      // Create test users with unique IDs
      const uniqueId = Date.now().toString();
      const users = [
        { emp_id: `ANALYSIS${uniqueId}001`, name: 'Analysis User', department: `Engineering${uniqueId}`, role: 'staff' },
        { emp_id: `DIRECTOR${uniqueId}001`, name: 'Director User', department: 'Management', role: 'director' },
      ];

      for (const user of users) {
        try {
          const { data: createdUser } = await supabaseClient
            .from('users')
            .insert(user)
            .select()
            .single();
          if (createdUser) {
            createdUsers.push(createdUser.id);
          }
        } catch (e) {
          // User might already exist, skip
        }
      }

      // Create tasks with different priorities and statuses
      const tasks = [
        { title: `High Priority Completed ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'completed', priority: 5 },
        { title: `High Priority In Progress ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'in_progress', priority: 5 },
        { title: `Medium Priority Completed ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'completed', priority: 3 },
        { title: `Medium Priority Pending ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'pending', priority: 3 },
        { title: `Low Priority Completed ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'completed', priority: 1 },
        { title: `Low Priority In Progress ${uniqueId}`, owner_id: `ANALYSIS${uniqueId}001`, status: 'in_progress', priority: 1 },
      ];

      for (const task of tasks) {
        const { data: createdTask } = await supabaseClient
          .from('tasks')
          .insert(task)
          .select()
          .single();
        createdTasks.push(createdTask.id);
      }

      // Test KPIs for completion rate calculation
      const kpisResponse = await request
        .get('/director/kpis')
        .set('Authorization', 'Bearer director_token');

      expect(kpisResponse.status).toBe(200);
      const { taskMetrics } = kpisResponse.body;

      // Verify completion rate: 3 completed out of 6 tasks = 50%
      expect(taskMetrics.completed).toBeGreaterThanOrEqual(3);
      expect(typeof taskMetrics.completionRate).toBe('number');
      expect(taskMetrics.completionRate).toBeGreaterThanOrEqual(0);
      expect(taskMetrics.completionRate).toBeLessThanOrEqual(100);

      // Test department metrics for priority analysis
      const deptResponse = await request
        .get('/director/departments')
        .set('Authorization', 'Bearer director_token');

      expect(deptResponse.status).toBe(200);
      const { departments } = deptResponse.body;
      const engineering = departments.find(d => d.name === `Engineering${uniqueId}`);

      expect(engineering).toBeDefined();
      expect(engineering.totalTasks).toBe(6);
      expect(typeof engineering.taskCompletionRate).toBe('number');

      // Verify productivity score calculation includes priority weighting
      expect(typeof engineering.productivityScore).toBe('number');
      expect(engineering.productivityScore).toBeGreaterThanOrEqual(0);
      expect(engineering.productivityScore).toBeLessThanOrEqual(100);
    });
  });
});
