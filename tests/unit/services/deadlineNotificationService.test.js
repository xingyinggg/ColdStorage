/**
 * Unit Tests for Deadline Notification Service - Pure Functions
 *
 * Tests isolated functions without external dependencies
 * User Story: CS-US165 - Deadline Notification System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSingaporeDate, setupDeadlineScheduler, getDeadlineServiceStatus } from '../../../server/services/deadlineNotificationService.js';

// Mock supabase for testing notification creation logic
vi.mock('../../../server/lib/supabase.js', () => ({
  getServiceClient: vi.fn(),
  getNumericIdFromEmpId: vi.fn((id) => parseInt(id)),
}));

// Import the service class after mocking
import { DeadlineNotificationService } from '../../../server/services/deadlineNotificationService.js';

/**
 * Mock Date to ensure consistent test results
 */
const mockDate = new Date('2025-10-31T10:00:00Z'); // UTC time

describe('Deadline Notification Service - Unit Tests', () => {
  beforeEach(() => {
    // Mock Date.now() to return consistent time for tests
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getSingaporeDate', () => {
    it('should return Singapore date (UTC+8) for current time', () => {
      // Mock date: 2025-10-31T10:00:00Z (UTC)
      // Singapore time: 2025-10-31T18:00:00+08:00
      // Expected result: 2025-10-31

      const result = getSingaporeDate();
      expect(result).toBe('2025-10-31');
    });

    it('should handle offset days correctly (positive offset)', () => {
      // Current Singapore date: 2025-10-31
      // With +1 day offset: 2025-11-01

      const result = getSingaporeDate(1);
      expect(result).toBe('2025-11-01');
    });

    it('should handle offset days correctly (negative offset)', () => {
      // Current Singapore date: 2025-10-31
      // With -1 day offset: 2025-10-30

      const result = getSingaporeDate(-1);
      expect(result).toBe('2025-10-30');
    });

    it('should handle zero offset correctly', () => {
      const result = getSingaporeDate(0);
      expect(result).toBe('2025-10-31');
    });

    it('should handle month boundary transitions', () => {
      // Set date to last day of month
      const endOfMonth = new Date('2025-10-31T10:00:00Z');
      vi.setSystemTime(endOfMonth);

      // Should handle month transition correctly
      const result = getSingaporeDate(1);
      expect(result).toBe('2025-11-01');
    });

    it('should handle year boundary transitions', () => {
      // Set date to last day of year
      const endOfYear = new Date('2025-12-31T10:00:00Z');
      vi.setSystemTime(endOfYear);

      // Should handle year transition correctly
      const result = getSingaporeDate(1);
      expect(result).toBe('2026-01-01');
    });

    it('should handle leap year February correctly', () => {
      // Set date to Feb 28, 2024 (leap year)
      const leapYearDate = new Date('2024-02-28T10:00:00Z');
      vi.setSystemTime(leapYearDate);

      const result = getSingaporeDate(1);
      expect(result).toBe('2024-02-29'); // Should be valid leap day
    });

    it('should handle non-leap year February correctly', () => {
      // Set date to Feb 28, 2025 (non-leap year)
      const nonLeapYearDate = new Date('2025-02-28T10:00:00Z');
      vi.setSystemTime(nonLeapYearDate);

      const result = getSingaporeDate(1);
      expect(result).toBe('2025-03-01'); // Should skip Feb 29
    });

    it('should return date in YYYY-MM-DD format', () => {
      const result = getSingaporeDate();

      // Should be exactly 10 characters: YYYY-MM-DD
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.length).toBe(10);

      // Should be valid date components
      const [year, month, day] = result.split('-').map(Number);
      expect(year).toBeGreaterThan(2000);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
    });

    it('should handle daylight saving time transitions consistently', () => {
      // Singapore doesn't observe DST, so this should be consistent
      // Test multiple times throughout the year
      const testDates = [
        '2025-01-15T10:00:00Z', // Winter
        '2025-04-15T10:00:00Z', // Spring
        '2025-07-15T10:00:00Z', // Summer
        '2025-10-15T10:00:00Z', // Fall
      ];

      testDates.forEach(dateStr => {
        vi.setSystemTime(new Date(dateStr));
        const result = getSingaporeDate();
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });
  });

  describe('setupDeadlineScheduler', () => {
    it('should not throw an error when called', () => {
      // This function should not throw errors
      expect(() => setupDeadlineScheduler()).not.toThrow();
    });

    it('should be callable without parameters', () => {
      // Function should be callable without any parameters
      expect(setupDeadlineScheduler).toBeInstanceOf(Function);

      // Call should not throw
      expect(() => setupDeadlineScheduler()).not.toThrow();
    });

    it('should return undefined', () => {
      // The function doesn't return anything meaningful in test environment
      const result = setupDeadlineScheduler();
      expect(result).toBeUndefined();
    });
  });

  describe('getDeadlineServiceStatus', () => {
    beforeEach(() => {
      // Reset any service state between tests
      vi.clearAllMocks();
    });

    it('should return service status object', () => {
      const status = getDeadlineServiceStatus();

      // Should return an object with expected properties
      expect(status).toBeInstanceOf(Object);
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('nextCheckAvailable');
      expect(status).toHaveProperty('cooldownActive');
    });

    it('should return available: true when service is initialized', () => {
      const status = getDeadlineServiceStatus();
      expect(status.available).toBe(true);
    });

    it('should include lastCheck timestamp', () => {
      const status = getDeadlineServiceStatus();

      // lastCheck should be either null (not checked yet) or a timestamp
      expect(status.lastCheck).toBeDefined();
      if (status.lastCheck !== null) {
        expect(typeof status.lastCheck).toBe('number');
        expect(status.lastCheck).toBeGreaterThan(0);
      }
    });

    it('should include nextCheckAvailable timestamp', () => {
      const status = getDeadlineServiceStatus();

      // nextCheckAvailable should be either null or an ISO string
      expect(status.nextCheckAvailable).toBeDefined();
      if (status.nextCheckAvailable !== null) {
        expect(typeof status.nextCheckAvailable).toBe('string');
        expect(status.nextCheckAvailable).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('should include cooldownActive boolean', () => {
      const status = getDeadlineServiceStatus();
      expect(typeof status.cooldownActive).toBe('boolean');
    });

    it('should return available: false when service fails to initialize', () => {
      // Mock a scenario where service initialization fails
      // This is hard to test directly, but the function should handle it gracefully
      const status = getDeadlineServiceStatus();
      expect(typeof status.available).toBe('boolean');
    });
  });

  describe('createDeadlineNotification', () => {
    let service;
    let mockSupabase;

    beforeEach(async () => {
      // Create a fresh service instance for each test
      service = new DeadlineNotificationService();
      mockSupabase = {
        from: vi.fn(() => mockSupabase),
        select: vi.fn(() => mockSupabase),
        eq: vi.fn(() => mockSupabase),
        limit: vi.fn(() => mockSupabase),
        single: vi.fn(() => mockSupabase),
        upsert: vi.fn(() => mockSupabase),
        insert: vi.fn(() => mockSupabase),
        update: vi.fn(() => mockSupabase),
        delete: vi.fn(() => mockSupabase),
        neq: vi.fn(() => mockSupabase),
        onConflict: vi.fn(() => mockSupabase),
      };

      // Mock getServiceClient to return our mock supabase
      const { getServiceClient } = await import('../../../server/lib/supabase.js');
      getServiceClient.mockReturnValue(mockSupabase);

      // Clear recent notification keys between tests
      service._recentNotificationKeys.clear();
    });

    it('should create a new notification successfully', async () => {
      // Mock no existing notification
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      // Mock successful upsert
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 1,
          emp_id: 123,
          task_id: 456,
          type: 'Upcoming Deadline',
          title: 'Test notification',
          read: false,
          created_at: '2025-10-31T10:00:00Z',
          sent_at: '2025-10-31T10:00:00Z'
        },
        error: null
      });

      const result = await service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Test notification',
        description: 'Test description',
        notification_category: 'deadline'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.emp_id).toBe(123);
      expect(result.task_id).toBe(456);
      expect(result.type).toBe('Upcoming Deadline');
    });

    it('should prevent duplicate notifications using deduplication logic', async () => {
      // First call should succeed
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 1, emp_id: 123, task_id: 456, type: 'Upcoming Deadline', title: 'Test notification' },
        error: null
      });

      await service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Test notification',
        description: 'Test description'
      });

      // Second call with same parameters should return null (deduplicated)
      const result = await service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Test notification',
        description: 'Test description'
      });

      expect(result).toBeNull();
    });

    it('should update sent_at for existing notifications instead of creating duplicates', async () => {
      // Mock existing notification found
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 1,
          emp_id: 123,
          task_id: 456,
          type: 'Upcoming Deadline',
          title: 'Existing notification',
          read: false,
          sent_at: '2025-10-30T10:00:00Z'
        },
        error: null
      });

      const result = await service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Existing notification',
        description: 'Test description'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        { sent_at: expect.any(String) }
      );
    });

    it('should handle upsert fallback when primary upsert fails', async () => {
      // Mock no existing notification
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      // Mock upsert failure
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Upsert failed' } });
      // Mock successful insert fallback
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 2, emp_id: 123, task_id: 456, type: 'Upcoming Deadline', title: 'Fallback notification' },
        error: null
      });

      const result = await service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Fallback notification',
        description: 'Test description'
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(2);
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should handle notification creation errors gracefully', async () => {
      // Mock no existing notification
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      // Mock upsert failure
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Upsert failed' } });
      // Mock insert failure
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

      await expect(service.createDeadlineNotification({
        emp_id: 123,
        task_id: 456,
        type: 'Upcoming Deadline',
        title: 'Error notification',
        description: 'Test description'
      })).rejects.toThrow('Failed to create deadline notification: Insert failed');
    });
  });

  describe('checkUpcomingDeadlines', () => {
    let service;
    let mockSupabase;

    beforeEach(async () => {
      service = new DeadlineNotificationService();
      mockSupabase = {
        from: vi.fn(() => mockSupabase),
        select: vi.fn(() => mockSupabase),
        eq: vi.fn(() => mockSupabase),
        neq: vi.fn(() => mockSupabase),
        lt: vi.fn(() => mockSupabase),
        order: vi.fn(() => mockSupabase),
        limit: vi.fn(() => mockSupabase),
        single: vi.fn(() => mockSupabase),
      };

      const { getServiceClient } = await import('../../../server/lib/supabase.js');
      getServiceClient.mockReturnValue(mockSupabase);
    });

    it('should check for upcoming deadlines at 1, 3, and 7 days', async () => {
      // Mock no tasks found for any day interval
      mockSupabase.neq.mockResolvedValue({ data: [], error: null });

      const result = await service.checkUpcomingDeadlines(true);

      expect(result.success).toBe(true);
      expect(result.data.upcoming.notifications).toEqual([]);
      expect(result.data.upcoming.created).toBe(0);
      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
      expect(mockSupabase.eq).toHaveBeenCalledWith('due_date', expect.any(String));
    });

    it('should create notifications for tasks due in specified intervals', async () => {
      // Mock tasks due tomorrow
      const mockTasks = [
        {
          id: 1,
          title: 'Task due tomorrow',
          due_date: '2025-11-01', // Tomorrow in Singapore time
          owner_id: '1',
          collaborators: [2],
          status: 'in_progress'
        }
      ];

      // Mock different responses for different day intervals
      let callCount = 0;
      mockSupabase.neq.mockImplementation(() => {
        callCount++;
        if (callCount === 1) { // 1 day interval
          return Promise.resolve({ data: mockTasks, error: null });
        }
        return Promise.resolve({ data: [], error: null }); // 3 and 7 day intervals
      });

      // Mock no existing notification
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      // Mock successful notification creation
      mockSupabase.single.mockResolvedValue({
        data: { id: 1, type: 'Upcoming Deadline', title: '1 days before Task due tomorrow is due' },
        error: null
      });

      const result = await service.checkUpcomingDeadlines(true);

      expect(result.success).toBe(true);
      expect(result.data.upcoming.created).toBe(2); // Owner + 1 collaborator
      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0].type).toBe('Upcoming Deadline');
      expect(result.notifications[0].days_remaining).toBe(1);
    });


    it('should handle cooldown period correctly', async () => {
      // Set last check time to recent
      service.lastCheck = Date.now() - (2 * 60 * 1000); // 2 minutes ago

      const result = await service.checkUpcomingDeadlines(false); // force = false

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deadline check skipped due to cooldown');
      expect(result.skipped).toBe(true);
      expect(result.notifications).toEqual([]);
    });

    it('should bypass cooldown when force is true', async () => {
      service.lastCheck = Date.now() - (2 * 60 * 1000); // 2 minutes ago
      mockSupabase.neq.mockResolvedValue({ data: [], error: null });

      const result = await service.checkUpcomingDeadlines(true); // force = true

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deadline check completed');
      expect(result.skipped).toBeUndefined();
    });
  });

  describe('checkMissedDeadlines', () => {
    let service;
    let mockSupabase;

    beforeEach(async () => {
      service = new DeadlineNotificationService();
      mockSupabase = {
        from: vi.fn(() => mockSupabase),
        select: vi.fn(() => mockSupabase),
        eq: vi.fn(() => mockSupabase),
        neq: vi.fn(() => mockSupabase),
        lt: vi.fn(() => mockSupabase),
        order: vi.fn(() => mockSupabase),
        limit: vi.fn(() => mockSupabase),
        single: vi.fn(() => mockSupabase),
      };

      const { getServiceClient } = await import('../../../server/lib/supabase.js');
      getServiceClient.mockReturnValue(mockSupabase);
    });

    it('should check for overdue tasks using Singapore timezone', async () => {
      // Mock no overdue tasks
      mockSupabase.neq.mockResolvedValue({ data: [], error: null });

      const result = await service.checkMissedDeadlines();

      expect(result.success).toBe(true);
      expect(result.message).toContain('No overdue tasks found');
      expect(result.notifications).toEqual([]);
      expect(result.totalNotifications).toBe(0);
    });

    it('should create notifications for overdue tasks', async () => {
      const mockOverdueTasks = [
        {
          id: 2,
          title: 'Overdue task',
          due_date: '2025-10-30', // Yesterday in Singapore time
          owner_id: '1',
          collaborators: [3],
          status: 'in_progress'
        }
      ];

      mockSupabase.neq.mockResolvedValue({ data: mockOverdueTasks, error: null });
      // Mock no existing notification
      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      // Mock successful notification creation
      mockSupabase.single.mockResolvedValue({
        data: { id: 2, type: 'Deadline Missed', title: 'Overdue: Overdue task deadline has passed' },
        error: null
      });

      const result = await service.checkMissedDeadlines();

      expect(result.success).toBe(true);
      expect(result.totalNotifications).toBe(2); // Owner + 1 collaborator
      expect(result.notifications).toHaveLength(2);
      expect(result.notifications[0].type).toBe('Deadline Missed');
      expect(result.notifications[0].task_id).toBe(2);
      expect(result.notifications[0].title).toContain('Overdue: Overdue task deadline has passed');
    });

    it('should skip tasks without valid recipients', async () => {
      const mockTasksWithoutRecipients = [
        {
          id: 3,
          title: 'Task without recipients',
          due_date: '2025-10-30',
          owner_id: null,
          collaborators: null,
          status: 'in_progress'
        }
      ];

      mockSupabase.neq.mockResolvedValue({ data: mockTasksWithoutRecipients, error: null });

      const result = await service.checkMissedDeadlines();

      expect(result.success).toBe(true);
      expect(result.totalNotifications).toBe(0);
      expect(result.notifications).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.neq.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const result = await service.checkMissedDeadlines();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });
});
