/**
 * Integration Tests for Calendar/Schedule View
 * Tests calendar grid calculations, filtering, and task exclusion
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load test env
dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

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

describeIf(hasTestEnv)('Schedule Calendar Integration Tests', () => {
  let supabaseClient;
  let createdTaskIds = [];
  let createdProjectIds = [];

  beforeAll(async () => {
    supabaseClient = getTestSupabaseClient();
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

  describe('Calendar Grid Calculations', () => {
    it('should calculate month grid correctly with 42 cells (6 weeks)', async () => {
      // Import calendar utilities
      const { getMonthGrid } = await import('../../src/utils/calendarUtils.js');
      
      const cursor = new Date('2025-10-15');
      const grid = getMonthGrid(cursor);
      
      expect(grid.length).toBe(42);
      expect(grid[0].getDay()).toBe(0); // Starts on Sunday
    });

    it('should calculate week grid correctly with 7 days', async () => {
      const { getWeekGrid } = await import('../../src/utils/calendarUtils.js');
      
      const cursor = new Date('2025-10-15'); // Wednesday
      const grid = getWeekGrid(cursor);
      
      expect(grid.length).toBe(7);
      expect(grid[0].getDay()).toBe(0); // Starts on Sunday
      expect(grid[6].getDay()).toBe(6); // Ends on Saturday
    });

    it('should calculate day grid correctly (single day)', async () => {
      const { startOfDay } = await import('../../src/utils/calendarUtils.js');
      
      const cursor = new Date('2025-10-15');
      const dayGrid = [startOfDay(cursor)];
      
      expect(dayGrid.length).toBe(1);
      expect(dayGrid[0].getHours()).toBe(0);
      expect(dayGrid[0].getMinutes()).toBe(0);
    });

    it('should handle month boundary correctly in grid', async () => {
      const { getMonthGrid } = await import('../../src/utils/calendarUtils.js');
      
      // Test with month that starts mid-week
      const cursor = new Date('2025-10-01'); // October 1, 2025 (Wednesday)
      const grid = getMonthGrid(cursor);
      
      // Should include days from previous month
      const firstDay = grid[0];
      expect(firstDay.getMonth()).toBeLessThanOrEqual(9); // October is month 9
      
      // Should include October 1st
      const october1st = grid.find(d => d.getDate() === 1 && d.getMonth() === 9);
      expect(october1st).toBeDefined();
    });
  });

  describe('Filter Logic Correctness', () => {
    it('should filter tasks by project correctly', async () => {
      // Create a project
      const { data: project, error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Test Project for Calendar Filter',
          description: 'Test project',
          status: 'active',
        })
        .select()
        .single();

      if (projectError) throw projectError;
      createdProjectIds.push(project.id);

      // Create tasks with different projects
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task in Project',
            due_date: '2025-12-01',
            project_id: project.id,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task without Project',
            due_date: '2025-12-02',
            project_id: null,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      // Test filter function
      const { filterByProject } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterByProject(tasks, String(project.id));

      expect(filtered.length).toBe(1);
      expect(filtered[0].project_id).toBe(project.id);
    });

    it('should filter tasks by status correctly', async () => {
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Ongoing Task',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Completed Task',
            due_date: '2025-12-02',
            owner_id: '1',
            status: 'completed',
            priority: 5,
          },
          {
            title: 'Under Review Task',
            due_date: '2025-12-03',
            owner_id: '1',
            status: 'under review',
            priority: 5,
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { filterByStatus } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterByStatus(tasks, 'ongoing');

      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe('ongoing');
    });

    it('should filter tasks by assignee (owner) correctly', async () => {
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task for Owner 1',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task for Owner 2',
            due_date: '2025-12-02',
            owner_id: '2',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { filterByAssignee } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterByAssignee(tasks, '1');

      expect(filtered.length).toBe(1);
      expect(filtered[0].owner_id).toBe('1');
    });

    it('should filter tasks by assignee (collaborators) correctly', async () => {
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task with Collaborator 2',
            due_date: '2025-12-01',
            owner_id: '1',
            collaborators: ['2', '3'],
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task without Collaborator 2',
            due_date: '2025-12-02',
            owner_id: '1',
            collaborators: ['3'],
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { filterByAssignee } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterByAssignee(tasks, '2');

      expect(filtered.length).toBe(1);
      expect(filtered[0].collaborators).toContain('2');
    });

    it('should apply multiple filters correctly', async () => {
      // Create a project
      const { data: project } = await supabaseClient
        .from('projects')
        .insert({
          title: 'Test Project for Multi-Filter',
          description: 'Test',
          status: 'active',
        })
        .select()
        .single();
      createdProjectIds.push(project.id);

      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Matching Task',
            due_date: '2025-12-01',
            project_id: project.id,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Wrong Project',
            due_date: '2025-12-02',
            project_id: null,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Wrong Status',
            due_date: '2025-12-03',
            project_id: project.id,
            owner_id: '1',
            status: 'completed',
            priority: 5,
          },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { applyFilters } = await import('../../src/utils/calendarUtils.js');
      const filtered = applyFilters(tasks, {
        projectId: String(project.id),
        status: 'ongoing',
        assigneeId: '1',
        requireDueDate: true,
      });

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Matching Task');
    });
  });

  describe('Tasks Without Due Dates Exclusion', () => {
    it('should exclude tasks without due_date from calendar', async () => {
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task with Due Date',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task without Due Date',
            due_date: null,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();

      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      // Create task with empty string manually (Supabase rejects empty string for date fields)
      const tasksWithVariations = [
        ...tasks,
        { id: 999, title: 'Task with Empty Due Date', due_date: '', owner_id: '1' },
      ];

      const { filterTasksWithDueDate } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterTasksWithDueDate(tasksWithVariations);

      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Task with Due Date');
      expect(filtered[0].due_date).toBe('2025-12-01');
    });

    it('should exclude tasks with null due_date', async () => {
      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task with Date',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task with Null',
            due_date: null,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { filterTasksWithDueDate } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterTasksWithDueDate(tasks);

      expect(filtered.length).toBe(1);
      expect(filtered[0].due_date).not.toBeNull();
    });

    it('should exclude tasks with empty string due_date', async () => {
      const { data: tasks, error: tasksError } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task with Date',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();
      
      if (tasksError) throw tasksError;
      tasks.forEach(t => createdTaskIds.push(t.id));

      // Create task with empty string manually (Supabase might convert empty string to null)
      const tasksWithEmptyString = [
        ...tasks,
        { id: 999, title: 'Task with Empty String', due_date: '', owner_id: '1' },
      ];

      const { filterTasksWithDueDate } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterTasksWithDueDate(tasksWithEmptyString);

      expect(filtered.length).toBe(1);
      expect(filtered[0].due_date).toBe('2025-12-01');
    });

    it('should handle tasks missing due_date property', async () => {
      // Create task without due_date field
      const { data: task, error: taskError } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Task Missing Due Date Property',
          owner_id: '1',
          status: 'ongoing',
          priority: 5,
        })
        .select()
        .single();

      if (taskError) throw taskError;
      createdTaskIds.push(task.id);

      // Manually create task object without due_date
      const tasks = [
        { id: task.id, title: task.title },
        { id: 999, title: 'Task with Date', due_date: '2025-12-01' },
      ];

      const { filterTasksWithDueDate } = await import('../../src/utils/calendarUtils.js');
      const filtered = filterTasksWithDueDate(tasks);

      expect(filtered.length).toBe(1);
      expect(filtered[0].due_date).toBeDefined();
    });

    it('should group only tasks with due dates', async () => {
      const { data: tasks } = await supabaseClient
        .from('tasks')
        .insert([
          {
            title: 'Task 1',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task 2',
            due_date: '2025-12-01',
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
          {
            title: 'Task 3',
            due_date: null,
            owner_id: '1',
            status: 'ongoing',
            priority: 5,
          },
        ])
        .select();
      tasks.forEach(t => createdTaskIds.push(t.id));

      const { groupTasksByDate, getMonthGrid } = await import('../../src/utils/calendarUtils.js');
      
      // Filter tasks with due dates first
      const tasksWithDates = tasks.filter(t => !!t.due_date);
      const cursor = new Date('2025-12-01');
      const daysGrid = getMonthGrid(cursor);
      const grouped = groupTasksByDate(tasksWithDates, daysGrid);

      const day1Key = new Date('2025-12-01').setHours(0, 0, 0, 0);
      expect(grouped.get(day1Key).length).toBe(2);
    });
  });
});

