/**
 * Unit Tests for Notification Utility Functions
 * Tests collaborator notification creation logic and notification click handling
 */

import { describe, it, expect } from 'vitest';
import {
  generateCollaboratorNotificationTitle,
  generateCollaboratorNotificationDescription,
  createCollaboratorNotificationData,
  isNotificationClickable,
  getTaskIdFromNotification,
} from '../../../src/utils/notificationUtils.js';

describe('Notification Utilities - Unit Tests', () => {
  describe('generateCollaboratorNotificationTitle', () => {
    it('should generate title with task title', () => {
      const title = generateCollaboratorNotificationTitle('Complete project review');
      expect(title).toBe('Added as collaborator for "Complete project review"');
    });

    it('should handle empty task title', () => {
      const title = generateCollaboratorNotificationTitle('');
      expect(title).toBe('Added as collaborator');
    });

    it('should handle null/undefined task title', () => {
      expect(generateCollaboratorNotificationTitle(null)).toBe('Added as collaborator');
      expect(generateCollaboratorNotificationTitle(undefined)).toBe('Added as collaborator');
    });

    it('should handle special characters in task title', () => {
      const title = generateCollaboratorNotificationTitle('Task with "quotes" & symbols');
      expect(title).toBe('Added as collaborator for "Task with "quotes" & symbols"');
    });
  });

  describe('generateCollaboratorNotificationDescription', () => {
    it('should generate description with assigner name and task title', () => {
      const description = generateCollaboratorNotificationDescription('John Doe', 'Complete project review');
      expect(description).toBe('John Doe has added you as a collaborator for the shared task: "Complete project review".');
    });

    it('should use default name when assigner name is missing', () => {
      const description = generateCollaboratorNotificationDescription(null, 'Task Title');
      expect(description).toBe('Someone has added you as a collaborator for the shared task: "Task Title".');
    });

    it('should use default task title when missing', () => {
      const description = generateCollaboratorNotificationDescription('John Doe', null);
      expect(description).toBe('John Doe has added you as a collaborator for the shared task: "a task".');
    });

    it('should handle both missing values', () => {
      const description = generateCollaboratorNotificationDescription(null, null);
      expect(description).toBe('Someone has added you as a collaborator for the shared task: "a task".');
    });

    it('should handle empty strings', () => {
      const description = generateCollaboratorNotificationDescription('', '');
      expect(description).toBe('Someone has added you as a collaborator for the shared task: "a task".');
    });
  });

  describe('createCollaboratorNotificationData', () => {
    it('should create complete notification data object', () => {
      const notification = createCollaboratorNotificationData({
        collaboratorEmpId: '123',
        taskId: 456,
        taskTitle: 'Review Documentation',
        assignerName: 'Jane Smith',
      });

      expect(notification.emp_id).toBe('123');
      expect(notification.task_id).toBe(456);
      expect(notification.title).toBe('Added as collaborator for "Review Documentation"');
      expect(notification.description).toContain('Jane Smith');
      expect(notification.description).toContain('Review Documentation');
      expect(notification.type).toBe('Shared Task');
      expect(notification.created_at).toBeDefined();
      expect(new Date(notification.created_at)).toBeInstanceOf(Date);
    });

    it('should handle null task ID', () => {
      const notification = createCollaboratorNotificationData({
        collaboratorEmpId: '123',
        taskId: null,
        taskTitle: 'Task Title',
        assignerName: 'John Doe',
      });

      expect(notification.task_id).toBeNull();
      expect(notification.emp_id).toBe('123');
      expect(notification.type).toBe('Shared Task');
    });

    it('should handle missing task ID', () => {
      const notification = createCollaboratorNotificationData({
        collaboratorEmpId: '123',
        taskTitle: 'Task Title',
        assignerName: 'John Doe',
      });

      expect(notification.task_id).toBeNull();
    });

    it('should use default values for missing name and title', () => {
      const notification = createCollaboratorNotificationData({
        collaboratorEmpId: '123',
        taskId: 456,
      });

      expect(notification.title).toBe('Added as collaborator');
      expect(notification.description).toContain('Someone');
      expect(notification.description).toContain('a task');
    });

    it('should handle numeric collaborator emp_id', () => {
      const notification = createCollaboratorNotificationData({
        collaboratorEmpId: 123,
        taskId: 456,
        taskTitle: 'Task',
        assignerName: 'John',
      });

      expect(notification.emp_id).toBe(123);
    });
  });

  describe('isNotificationClickable', () => {
    it('should return true when notification has task_id', () => {
      const notification = { id: 1, task_id: 123, title: 'Test' };
      expect(isNotificationClickable(notification)).toBe(true);
    });

    it('should return false when notification has no task_id', () => {
      const notification = { id: 1, title: 'Test' };
      expect(isNotificationClickable(notification)).toBe(false);
    });

    it('should return false when task_id is null', () => {
      const notification = { id: 1, task_id: null, title: 'Test' };
      expect(isNotificationClickable(notification)).toBe(false);
    });

    it('should return false when task_id is 0', () => {
      const notification = { id: 1, task_id: 0, title: 'Test' };
      expect(isNotificationClickable(notification)).toBe(false);
    });

    it('should return false for null/undefined notification', () => {
      expect(isNotificationClickable(null)).toBe(false);
      expect(isNotificationClickable(undefined)).toBe(false);
    });

    it('should return true for task_id as string', () => {
      const notification = { id: 1, task_id: '123', title: 'Test' };
      expect(isNotificationClickable(notification)).toBe(true);
    });
  });

  describe('getTaskIdFromNotification', () => {
    it('should extract task_id from notification', () => {
      const notification = { id: 1, task_id: 123, title: 'Test' };
      expect(getTaskIdFromNotification(notification)).toBe(123);
    });

    it('should return null when task_id is missing', () => {
      const notification = { id: 1, title: 'Test' };
      expect(getTaskIdFromNotification(notification)).toBeNull();
    });

    it('should return null when task_id is null', () => {
      const notification = { id: 1, task_id: null, title: 'Test' };
      expect(getTaskIdFromNotification(notification)).toBeNull();
    });

    it('should return null for null/undefined notification', () => {
      expect(getTaskIdFromNotification(null)).toBeNull();
      expect(getTaskIdFromNotification(undefined)).toBeNull();
    });

    it('should handle task_id as string', () => {
      const notification = { id: 1, task_id: '123', title: 'Test' };
      expect(getTaskIdFromNotification(notification)).toBe('123');
    });
  });
});

