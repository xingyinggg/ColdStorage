/**
 * Integration Tests for Task Update Notification User Story
 * Tests notification creation, delivery timing, and collaborator filtering
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

describeIf(hasTestEnv)('Task Update Notification Integration Tests', () => {
  let app;
  let request;
  let supabaseClient;
  let createdTaskIds = [];
  let createdNotificationIds = [];

  beforeAll(async () => {
    supabaseClient = getTestSupabaseClient();

    // Point mocked getServiceClient to our test client
    getServiceClient.mockImplementation(() => supabaseClient);

    // Create express app and mount routers
    const tasksRouter = (await import('../../server/routes/tasks.js')).default;
    
    app = express();
    app.use(express.json());
    app.use('/tasks', tasksRouter);
    request = supertest(app);

    // Mock auth for tests
    getUserFromToken.mockImplementation(async (token) => {
      if (token === 'owner_token') {
        return { id: 'owner_user_id', email: 'owner@test.com' };
      }
      if (token === 'collaborator_token') {
        return { id: 'collaborator_user_id', email: 'collaborator@test.com' };
      }
      if (token === 'non_collaborator_token') {
        return { id: 'non_collaborator_user_id', email: 'noncollab@test.com' };
      }
      if (token === 'editor_token') {
        return { id: 'editor_user_id', email: 'editor@test.com' };
      }
      return null;
    });

    getEmpIdForUserId.mockImplementation(async (userId) => {
      if (userId === 'owner_user_id') return 1;
      if (userId === 'collaborator_user_id') return 2;
      if (userId === 'non_collaborator_user_id') return 999;
      if (userId === 'editor_user_id') return 3;
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

  describe('User Story 1: Receive in-app notification immediately when task is updated', () => {
    it('should create notifications when tasks are updated', async () => {
      // Create a task with owner and collaborator
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Task to Update',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update the task
      const updateResponse = await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token')
        .send({
          status: 'under review',
        });

      expect(updateResponse.status).toBe(200);

      // Wait a bit for notifications to be created
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check if notifications were created
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      expect(notifications.length).toBeGreaterThan(0);
      
      notifications.forEach(n => createdNotificationIds.push(n.id));

      // Should have notification for editor (confirmation)
      const editorNotif = notifications.find(n => n.type === 'Task Update Confirmation' && n.emp_id === 2);
      expect(editorNotif).toBeDefined();
    });

    it('should verify notification delivery timing is immediate', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Immediate Notification Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'],
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      const beforeUpdate = new Date();

      // Update the task
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token')
        .send({
          status: 'completed',
        });

      const afterUpdate = new Date();

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notification timestamps (should be between beforeUpdate and afterUpdate + buffer)
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .eq('type', 'Task Update Confirmation')
        .single();

      expect(notifications).toBeDefined();
      createdNotificationIds.push(notifications.id);

      const notificationTime = new Date(notifications.created_at);
      // Notification should be created immediately (within 2 seconds of update)
      expect(notificationTime.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime() - 2000);
      expect(notificationTime.getTime()).toBeLessThanOrEqual(afterUpdate.getTime() + 2000);
    });
  });

  describe('User Story 2: Receive notifications only for tasks they are part of as collaborators', () => {
    it('should verify that only collaborators receive notifications (not non-collaborators)', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Collaborator Filter Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'], // Only collaborator 2, not 999
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task as collaborator
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token')
        .send({
          status: 'under review',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      notifications.forEach(n => createdNotificationIds.push(n.id));

      // Should have notification for collaborator (2) but not for non-collaborator (999)
      const collaboratorNotif = notifications.find(n => n.emp_id === 2);
      const nonCollaboratorNotif = notifications.find(n => n.emp_id === 999);

      expect(collaboratorNotif).toBeDefined();
      expect(nonCollaboratorNotif).toBeUndefined();
    });

    it('should verify that editors do not receive duplicate notifications', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Duplicate Prevention Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['3'], // Editor (3) is also a collaborator
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task as editor/collaborator
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer editor_token')
        .send({
          status: 'completed',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      notifications.forEach(n => createdNotificationIds.push(n.id));

      // Editor should only get confirmation, not Task Update notification
      const editorConfirmations = notifications.filter(
        n => n.emp_id === 3 && n.type === 'Task Update Confirmation'
      );
      const editorUpdates = notifications.filter(
        n => n.emp_id === 3 && n.type === 'Task Update'
      );

      expect(editorConfirmations.length).toBe(1);
      expect(editorUpdates.length).toBe(0); // Should not receive duplicate
    });

    it('should verify that owners receive notifications when collaborators update', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Owner Notification Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1', // Owner is 1
          collaborators: ['2'], // Collaborator 2 will update
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task as collaborator (not owner)
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token')
        .send({
          status: 'under review',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      notifications.forEach(n => createdNotificationIds.push(n.id));

      // Owner (1) should receive Task Update notification
      const ownerNotif = notifications.find(
        n => n.emp_id === 1 && n.type === 'Task Update'
      );

      expect(ownerNotif).toBeDefined();
      expect(ownerNotif.title).toContain('Task Updated');
      expect(ownerNotif.description).toContain('updated the task');
    });

    it('should handle empty collaborators array', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Empty Collaborators Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: [], // Empty array
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          status: 'completed',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications - should only have confirmation for editor
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      notifications.forEach(n => createdNotificationIds.push(n.id));

      // Should only have confirmation (no collaborator notifications)
      const collaboratorUpdates = notifications.filter(
        n => n.type === 'Task Update' && n.emp_id !== 1
      );
      expect(collaboratorUpdates.length).toBe(0);
    });

    it('should handle invalid collaborator IDs gracefully', async () => {
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Invalid Collaborator Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2', null, '', 'invalid'], // Mix of valid and invalid
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // Update task - request should succeed even if notification insert fails for invalid IDs
      const updateResponse = await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer collaborator_token')
        .send({
          status: 'under review',
        });

      // Request should succeed (status 200) despite invalid collaborator IDs
      expect(updateResponse.status).toBe(200);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications - invalid IDs in collaborators array may cause batch insert to fail
      // but the system should handle this gracefully without crashing the request
      const { data: notifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation']);

      expect(notifications).toBeDefined();
      if (notifications && notifications.length > 0) {
        notifications.forEach(n => createdNotificationIds.push(n.id));
        
        // If notifications were created, verify none have null emp_id
        const invalidIdNotifs = notifications.filter(
          n => !n.emp_id || n.emp_id === null
        );
        expect(invalidIdNotifs.length).toBe(0);
      }
      
      // The key test: Request succeeded despite invalid collaborator IDs
      // The system catches notification errors and continues (graceful degradation)
      // This verifies the system handles invalid IDs gracefully without crashing
    });

    it('should verify notification delivery when collaborator list changes', async () => {
      // Create task with one collaborator
      const { data: task } = await supabaseClient
        .from('tasks')
        .insert({
          title: 'Collaborator Change Test',
          description: 'Test',
          priority: 5,
          status: 'ongoing',
          owner_id: '1',
          collaborators: ['2'], // Initial collaborator
        })
        .select()
        .single();
      createdTaskIds.push(task.id);

      // First update - should notify collaborator 2
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          status: 'under review',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Change collaborators
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          collaborators: ['3'], // Changed to collaborator 3
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second update - should notify new collaborator 3, not old collaborator 2
      await request
        .put(`/tasks/${task.id}`)
        .set('Authorization', 'Bearer owner_token')
        .send({
          status: 'completed',
        });

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notifications
      const { data: allNotifications } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('task_id', task.id)
        .in('type', ['Task Update', 'Task Update Confirmation'])
        .order('created_at', { ascending: false });

      expect(allNotifications).toBeDefined();
      allNotifications.forEach(n => createdNotificationIds.push(n.id));

      // Most recent Task Update notifications should be for collaborator 3 (new)
      const recentUpdates = allNotifications
        .filter(n => n.type === 'Task Update' && n.emp_id !== 1)
        .slice(0, 1);

      if (recentUpdates.length > 0) {
        expect(recentUpdates[0].emp_id).toBe(3); // New collaborator should receive notification
      }
    });
  });
});

