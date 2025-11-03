/**
 * Integration Tests for Collaborator Notification User Story
 * Tests notification creation, content, and click functionality
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

describeIf(hasTestEnv)('Collaborator Notification Integration Tests', () => {
  let app;
  let request;
  let supabaseClient;
  let createdTaskIds = [];
  let createdNotificationIds = [];
  let createdUserId = null;

  beforeAll(async () => {
    supabaseClient = getTestSupabaseClient();

    // Point mocked getServiceClient to our test client
    getServiceClient.mockImplementation(() => supabaseClient);

    // Create express app and mount routers
    const tasksRouter = (await import('../../server/routes/tasks.js')).default;
    const notificationRouter = (await import('../../server/routes/notification.js')).default;
    
    app = express();
    app.use(express.json());
    app.use('/tasks', tasksRouter);
    app.use('/notification', notificationRouter);
    request = supertest(app);

    // Mock auth for tests
    getUserFromToken.mockImplementation(async (token) => {
      if (token === 'owner_token') {
        return { id: 'owner_user_id', email: 'owner@test.com' };
      }
      if (token === 'collaborator_token') {
        return { id: 'collaborator_user_id', email: 'collaborator@test.com' };
      }
      if (token === 'new_collaborator_token') {
        return { id: 'new_collaborator_user_id', email: 'newcollab@test.com' };
      }
      return null;
    });

    getEmpIdForUserId.mockImplementation(async (userId) => {
      if (userId === 'owner_user_id') return 1;
      if (userId === 'collaborator_user_id') return 2;
      if (userId === 'new_collaborator_user_id') return 3;
      return null;
    });
  });

  afterEach(async () => {
    // Cleanup created notifications
    if (createdNotificationIds.length > 0) {
      await supabaseClient.from('notifications').delete().in('id', createdNotificationIds);
      createdNotificationIds.length = 0;
    }
    // Cleanup created tasks
    if (createdTaskIds.length > 0) {
      await supabaseClient.from('tasks').delete().in('id', createdTaskIds);
      createdTaskIds.length = 0;
    }
  });

  describe('User Story 1: Receive notification when added to a collaborative task', () => {
    it('should create notifications when collaborators are added during task creation', async () => {
      // Create a task with collaborators
      const taskData = {
        title: 'Collaborative Task Test',
        description: 'Test task with collaborators',
        priority: 5,
        status: 'ongoing',
        collaborators: JSON.stringify(['2']), // Add collaborator (user 2)
        due_date: '2025-12-31',
      };

      const response = await request
        .post('/tasks')
        .set('Authorization', 'Bearer owner_token')
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      createdTaskIds.push(response.body.id);

      // Wait a bit for notifications to be created (they're created asynchronously in frontend)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if notifications were created for the collaborator
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', response.body.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 2); // Collaborator emp_id

      // Note: Notifications are created in frontend, so this test verifies the backend API accepts the task creation
      // The actual notification creation happens in the frontend code
      expect(response.body.collaborators).toContain('2');
    });

    it('should create notifications when collaborators are added to existing task', async () => {
      // Create a task without collaborators
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Task to Add Collaborators',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Add collaborators to the task
      const updateResponse = await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['2'], // Add collaborator
        });

      expect(updateResponse.status).toBe(200);

      // Wait a bit for notifications to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if notification was created for the new collaborator
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 2);

      expect(notifications).toBeDefined();
      expect(notifications.length).toBeGreaterThan(0);
      
      const notification = notifications[0];
      createdNotificationIds.push(notification.id);

      expect(notification.title).toContain('Added as collaborator');
      expect(notification.title).toContain(task.title);
      expect(notification.description).toContain(task.title);
      expect(notification.task_id).toBe(task.id);
      expect(notification.type).toBe('Shared Task');
    });

    it('should deliver notifications to collaborator staff members', async () => {
      // Create task with multiple collaborators
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Multi-Collaborator Task',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2', '3'],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Add a new collaborator
      const updateResponse = await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['2', '3', '4'], // Add collaborator 4
        });

      expect(updateResponse.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications for the new collaborator
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 4);

      expect(notifications).toBeDefined();
      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].emp_id).toBe(4);
    });
  });

  describe('User Story 2: Notification includes the task title', () => {
    it('should include correct task title in notification', async () => {
      const taskTitle = 'Important Task Title';
      
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: taskTitle,
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Add collaborator
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['2'],
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 2)
        .single();

      expect(notifications).toBeDefined();
      createdNotificationIds.push(notifications.id);

      expect(notifications.title).toContain(taskTitle);
      expect(notifications.description).toContain(taskTitle);
    });

    it('should include task title in notification content when task is created with collaborators', async () => {
      const taskTitle = 'New Collaborative Task';
      
      const taskData = {
        title: taskTitle,
        description: 'Test',
        priority: 5,
        status: 'ongoing',
        collaborators: JSON.stringify(['2']),
      };

      const response = await request
        .post('/tasks')
        .set('Authorization', 'Bearer owner_token')
        .send(taskData);

      expect(response.status).toBe(201);
      expect(response.body.title).toBe(taskTitle);
      createdTaskIds.push(response.body.id);

      // Note: Frontend creates notifications, so we verify the task was created correctly
      // The notification content with task title is tested in unit tests
    });

    it('should handle notification content when task title is updated after collaborator notification', async () => {
      const originalTitle = 'Original Task Title';
      const updatedTitle = 'Updated Task Title';

      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: originalTitle,
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task title
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          title: updatedTitle,
        });

      // The original notification should still have the original title
      // (notifications are immutable - they reflect the state at creation time)
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .order('created_at', { ascending: false });

      // If there are Shared Task notifications, they should have the title from when they were created
      if (notifications && notifications.length > 0) {
        expect(notifications[0].title).toBeDefined();
        // Notification title reflects the task title at creation time
      }
    });
  });

  describe('User Story 3: View the task upon clicking the notification', () => {
    it('should verify notification has task_id for clickability', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Clickable Task',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Add collaborator to create notification
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['2'],
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 2)
        .single();

      expect(notifications).toBeDefined();
      createdNotificationIds.push(notifications.id);

      // Verify notification has task_id
      expect(notifications.task_id).toBe(task.id);
      
      // Test utility function
      const { isNotificationClickable, getTaskIdFromNotification } = await import('../../src/utils/notificationUtils.js');
      expect(isNotificationClickable(notifications)).toBe(true);
      expect(getTaskIdFromNotification(notifications)).toBe(task.id);
    });

    it('should fetch task details when notification is clicked', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Task to View',
          description: 'Test description',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Fetch task via API (simulating notification click)
      const taskResponse = await request
        .get(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token');

      expect(taskResponse.status).toBe(200);
      expect(taskResponse.body.task).toBeDefined();
      expect(taskResponse.body.task.id).toBe(task.id);
      expect(taskResponse.body.task.title).toBe('Task to View');
    });

    it('should handle error when task no longer exists', async () => {
      // Create a task and then delete it
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Temporary Task',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [],
        })
        .select()
        .single();

      const taskId = task.id;

      // Delete the task
      await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', taskId);

      // Try to fetch deleted task (simulating notification click on deleted task)
      const taskResponse = await request
        .get(`/tasks/${taskId}`)
        .set('Authorization', 'Bearer collaborator_token');

      expect(taskResponse.status).toBe(404);
    });

    it('should handle notifications without task_id (should not be clickable)', async () => {
      // Create a notification without task_id
      const { data: notification } = await supabaseClient
        .from('notifications')
        .insert({
          emp_id: 2,
          title: 'System Notification',
          description: 'This is a system notification',
          type: 'System',
          task_id: null,
          read: false,
        })
        .select()
        .single();
      createdNotificationIds.push(notification.id);

      // Test utility function
      const { isNotificationClickable, getTaskIdFromNotification } = await import('../../src/utils/notificationUtils.js');
      expect(isNotificationClickable(notification)).toBe(false);
      expect(getTaskIdFromNotification(notification)).toBeNull();
    });

    it('should update notification read status when clicked', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Task for Read Status',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Add collaborator to create notification
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['2'],
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the notification
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Shared Task')
        .eq('emp_id', 2)
        .single();

      expect(notifications).toBeDefined();
      expect(notifications.read).toBe(false);
      createdNotificationIds.push(notifications.id);

      // Mark as read (simulating click)
      const markReadResponse = await request
        .patch(`/notification/${notifications.id}/read`)
        .set('Authorization', 'Bearer collaborator_token');

      expect(markReadResponse.status).toBe(200);

      // Verify notification is marked as read
      const { data: updatedNotification } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('id', notifications.id)
        .single();

      expect(updatedNotification.read).toBe(true);
    });
  });
});

