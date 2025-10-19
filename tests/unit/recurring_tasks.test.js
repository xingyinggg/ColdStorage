/**
 * Unit Tests for Recurring Tasks Functionality
 * User Story: CS-US75 - Recurring Tasks
 * 
 * Tests cover:
 * - Creating recurring tasks with various patterns (daily, weekly, monthly)
 * - Calculating next occurrences
 * - Handling task completion and generating next instances
 * - End conditions (date, count, never)
 * - Weekday selection for weekly tasks
 * - Edge cases and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateNextOccurrence,
  shouldContinueRecurrence,
  createRecurringTask,
  handleTaskCompletion
} from '../../server/services/recurrenceService.js';

// Mock Supabase client
const createMockSupabase = () => {
  const mockData = {
    tasks: [],
    history: []
  };

  return {
    from: (table) => ({
      insert: vi.fn((data) => {
        const record = Array.isArray(data) ? data : [data];
        record.forEach(r => {
          // Ensure the table array exists
          if (!mockData[table]) {
            mockData[table] = [];
          }
          const id = mockData[table].length + 1;
          mockData[table].push({ id, ...r });
        });
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: mockData[table][mockData[table].length - 1],
              error: null
            }))
          }))
        };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: mockData[table][0] || null,
            error: null
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: mockData[table].slice(0, 1),
              error: null
            }))
          }))
        })),
        order: vi.fn(() => ({
          data: mockData[table],
          error: null
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: mockData[table],
          error: null
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: mockData[table],
          error: null
        }))
      }))
    }),
    mockData // Expose for testing
  };
};

describe('[UNIT] Recurring Tasks - calculateNextOccurrence', () => {
  
  it('should calculate next daily occurrence', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'daily', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-15');
  });

  it('should calculate next daily occurrence with interval 3', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'daily', 3);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-17');
  });

  it('should calculate next weekly occurrence', () => {
    const currentDate = new Date('2025-10-14'); // Monday
    const nextDate = calculateNextOccurrence(currentDate, 'weekly', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-21');
  });

  it('should calculate next weekly occurrence with specific weekday', () => {
    const currentDate = new Date('2025-10-14'); // Monday
    const weekday = 5; // Friday
    const nextDate = calculateNextOccurrence(currentDate, 'weekly', 1, weekday);
    
    // With interval=1, it should find Friday ONE week from now (not this week's Friday)
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-24'); // Next Friday (1 week later)
  });

  it('should calculate next weekly occurrence maintaining same weekday', () => {
    const currentDate = new Date('2025-10-15'); // Wednesday
    const weekday = 3; // Wednesday
    const nextDate = calculateNextOccurrence(currentDate, 'weekly', 1, weekday);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-22'); // Next Wednesday
  });

  it('should calculate biweekly occurrence', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'biweekly', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-28');
  });

  it('should calculate monthly occurrence', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'monthly', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-11-14');
  });

  it('should calculate quarterly occurrence', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'quarterly', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2026-01-14');
  });

  it('should calculate yearly occurrence', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'yearly', 1);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2026-10-14');
  });

  it('should handle leap year for yearly recurrence', () => {
    const currentDate = new Date('2024-02-29'); // Leap year
    const nextDate = calculateNextOccurrence(currentDate, 'yearly', 1);
    
    // Feb 29, 2024 + 1 year = March 1, 2025 (2025 is not a leap year, so JS adjusts)
    expect(nextDate.getMonth()).toBe(2); // March (0-indexed)
    expect(nextDate.getDate()).toBe(1); // 1st day
  });

  it('should throw error for invalid pattern', () => {
    const currentDate = new Date('2025-10-14');
    
    expect(() => {
      calculateNextOccurrence(currentDate, 'invalid', 1);
    }).toThrow('Invalid recurrence pattern: invalid');
  });
});

describe('[UNIT] Recurring Tasks - shouldContinueRecurrence', () => {
  
  it('should continue when no end conditions are set', () => {
    const nextDate = new Date('2025-10-21');
    const result = shouldContinueRecurrence(nextDate, null, null, 5);
    
    expect(result).toBe(true);
  });

  it('should stop when end date is reached', () => {
    const nextDate = new Date('2025-11-30');
    const endDate = new Date('2025-11-26');
    const result = shouldContinueRecurrence(nextDate, endDate, null, 5);
    
    expect(result).toBe(false);
  });

  it('should continue when before end date', () => {
    const nextDate = new Date('2025-11-20');
    const endDate = new Date('2025-11-26');
    const result = shouldContinueRecurrence(nextDate, endDate, null, 5);
    
    expect(result).toBe(true);
  });

  it('should stop when max count is reached', () => {
    const nextDate = new Date('2025-10-21');
    const result = shouldContinueRecurrence(nextDate, null, 5, 5);
    
    expect(result).toBe(false);
  });

  it('should continue when below max count', () => {
    const nextDate = new Date('2025-10-21');
    const result = shouldContinueRecurrence(nextDate, null, 10, 5);
    
    expect(result).toBe(true);
  });

  it('should stop when both end date and count are reached', () => {
    const nextDate = new Date('2025-11-30');
    const endDate = new Date('2025-11-26');
    const result = shouldContinueRecurrence(nextDate, endDate, 5, 5);
    
    expect(result).toBe(false);
  });

  it('should handle edge case: exactly on end date', () => {
    const nextDate = new Date('2025-11-26');
    const endDate = new Date('2025-11-26');
    const result = shouldContinueRecurrence(nextDate, endDate, null, 5);
    
    expect(result).toBe(true); // Should allow on exact date
  });
});

describe('[UNIT] Recurring Tasks - createRecurringTask', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  it('should create a recurring task with master task only', async () => {
    const taskData = {
      title: 'Weekly Meeting',
      description: 'Team sync',
      due_date: '2025-10-15',
      priority: 5,
      owner_id: 1001,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      recurrence_end_date: '2025-11-26'
    };

    const result = await createRecurringTask(mockSupabase, taskData, 3); // Wednesday

    expect(result.success).toBe(true);
    expect(result.task).toBeDefined();
    expect(result.task.status).toBe('ongoing');
    expect(result.task.is_recurring).toBe(true);
  });

  it('should adjust due date to selected weekday for weekly task', async () => {
    const taskData = {
      title: 'Friday Task',
      description: 'End of week task',
      due_date: '2025-10-14', // Monday
      priority: 5,
      owner_id: 1001,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1
    };

    const result = await createRecurringTask(mockSupabase, taskData, 5); // Friday

    expect(result.success).toBe(true);
    // Should adjust to Friday (Oct 17)
    expect(result.task.due_date).toBe('2025-10-17');
  });

  it('should create daily recurring task without weekday adjustment', async () => {
    const taskData = {
      title: 'Daily Standup',
      description: 'Morning meeting',
      due_date: '2025-10-15',
      priority: 3,
      owner_id: 1001,
      recurrence_pattern: 'daily',
      recurrence_interval: 1,
      recurrence_count: 10
    };

    const result = await createRecurringTask(mockSupabase, taskData, null);

    expect(result.success).toBe(true);
    expect(result.task.due_date).toBe('2025-10-15'); // No adjustment for daily
  });

  it('should create monthly recurring task', async () => {
    const taskData = {
      title: 'Monthly Report',
      description: 'Submit monthly report',
      due_date: '2025-10-15',
      priority: 8,
      owner_id: 1001,
      recurrence_pattern: 'monthly',
      recurrence_interval: 1,
      recurrence_count: 6
    };

    const result = await createRecurringTask(mockSupabase, taskData, null);

    expect(result.success).toBe(true);
    expect(result.task.recurrence_pattern).toBe('monthly');
  });
});

describe('[UNIT] Recurring Tasks - handleTaskCompletion', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  it('should create next instance when master task is completed', async () => {
    // Setup: Create master task in mock data
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Weekly Task',
      due_date: '2025-10-15',
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      recurrence_end_date: '2025-11-26',
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    expect(result.nextTask).toBeDefined();
    expect(result.nextTask.due_date).toBe('2025-10-22'); // Next Wednesday
    expect(result.nextTask.parent_recurrence_id).toBe(100);
  });

  it('should create next instance when instance task is completed', async () => {
    // Setup: Create master and instance
    mockSupabase.mockData.tasks.push(
      {
        id: 100,
        title: 'Weekly Task',
        due_date: '2025-10-15',
        status: 'recurring_template',
        is_recurring: true,
        recurrence_pattern: 'weekly',
        recurrence_interval: 1,
        recurrence_end_date: '2025-11-26',
        owner_id: 1001,
        recurrence_series_id: 'series-123'
      },
      {
        id: 101,
        title: 'Weekly Task',
        due_date: '2025-10-22',
        status: 'ongoing',
        parent_recurrence_id: 100,
        recurrence_series_id: 'series-123',
        owner_id: 1001
      }
    );

    mockSupabase.mockData.history.push({
      original_task_id: 100,
      instance_number: 1,
      scheduled_date: '2025-10-22',
      status: 'active'
    });

    const result = await handleTaskCompletion(mockSupabase, 101);

    expect(result.success).toBe(true);
    expect(result.nextTask).toBeDefined();
    expect(result.nextTask.due_date).toBe('2025-10-29'); // Next Wednesday
  });

  it('should stop recurrence when end date is reached', async () => {
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Weekly Task',
      due_date: '2025-11-26',
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      recurrence_end_date: '2025-11-26', // Same as due date
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    expect(result.nextTask).toBeUndefined();
    expect(result.message).toBe('Recurrence series completed');
  });

  it('should stop recurrence when max count is reached', async () => {
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Weekly Task',
      due_date: '2025-10-15',
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      recurrence_count: 3, // Max 3 occurrences
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    // Add history showing we've had 2 instances already
    mockSupabase.mockData.history.push(
      { instance_number: 1, original_task_id: 100 },
      { instance_number: 2, original_task_id: 100 }
    );

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    expect(result.nextTask).toBeUndefined();
    expect(result.message).toBe('Recurrence series completed');
  });

  it('should handle non-recurring task gracefully', async () => {
    mockSupabase.mockData.tasks.push({
      id: 200,
      title: 'Regular Task',
      due_date: '2025-10-15',
      status: 'ongoing',
      is_recurring: false,
      owner_id: 1001
    });

    const result = await handleTaskCompletion(mockSupabase, 200);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Task is not recurring');
    expect(result.nextTask).toBeUndefined();
  });

  it('should maintain weekday for weekly recurring tasks', async () => {
    // Task on Wednesday
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Wednesday Task',
      due_date: '2025-10-15', // Wednesday
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    const nextDate = new Date(result.nextTask.due_date);
    expect(nextDate.getDay()).toBe(3); // Should be Wednesday (day 3)
    expect(result.nextTask.due_date).toBe('2025-10-22');
  });

  it('should handle daily recurrence correctly', async () => {
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Daily Task',
      due_date: '2025-10-15',
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'daily',
      recurrence_interval: 1,
      recurrence_count: 30,
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    expect(result.nextTask.due_date).toBe('2025-10-16'); // Next day
  });

  it('should handle monthly recurrence on month boundaries', async () => {
    mockSupabase.mockData.tasks.push({
      id: 100,
      title: 'Monthly Task',
      due_date: '2025-01-31', // January 31
      status: 'ongoing',
      is_recurring: true,
      recurrence_pattern: 'monthly',
      recurrence_interval: 1,
      owner_id: 1001,
      recurrence_series_id: 'series-123'
    });

    const result = await handleTaskCompletion(mockSupabase, 100);

    expect(result.success).toBe(true);
    // Feb 31 doesn't exist, JS will adjust to Feb 28/29
    const nextDate = new Date(result.nextTask.due_date);
    expect(nextDate.getMonth()).toBe(1); // February
  });
});

describe('[UNIT] Recurring Tasks - Edge Cases', () => {
  
  it('should handle completion on weekend for weekly task', () => {
    const saturday = new Date('2025-10-18'); // Saturday
    const weekday = 6; // Saturday
    const nextDate = calculateNextOccurrence(saturday, 'weekly', 1, weekday);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-25'); // Next Saturday
  });

  it('should handle biweekly with specific weekday', () => {
    const monday = new Date('2025-10-13'); // Monday
    const weekday = 5; // Friday
    const nextDate = calculateNextOccurrence(monday, 'biweekly', 1, weekday);
    
    // Should go to Friday, then add 2 weeks
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-31'); // Friday 2 weeks later
  });

  it('should handle interval of 0 (edge case)', () => {
    const currentDate = new Date('2025-10-14');
    // Interval should default to 1 or handle 0
    const nextDate = calculateNextOccurrence(currentDate, 'daily', 0);
    
    // With interval 0, it should still work (0 * pattern)
    expect(nextDate.toISOString().split('T')[0]).toBe('2025-10-14');
  });

  it('should handle very large interval', () => {
    const currentDate = new Date('2025-10-14');
    const nextDate = calculateNextOccurrence(currentDate, 'daily', 365);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2026-10-14'); // ~1 year later
  });

  it('should handle year boundary for weekly task', () => {
    const endOfYear = new Date('2025-12-29'); // Monday
    const weekday = 1; // Monday
    const nextDate = calculateNextOccurrence(endOfYear, 'weekly', 1, weekday);
    
    expect(nextDate.toISOString().split('T')[0]).toBe('2026-01-05'); // Next Monday in new year
  });
});

describe('[UNIT] Recurring Tasks - Integration Scenarios', () => {
  let mockSupabase;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  it('should handle complete workflow: create -> complete 3 times', async () => {
    // Create recurring task
    const taskData = {
      title: 'Test Workflow',
      due_date: '2025-10-15',
      priority: 5,
      owner_id: 1001,
      recurrence_pattern: 'weekly',
      recurrence_interval: 1,
      recurrence_count: 3
    };

    const createResult = await createRecurringTask(mockSupabase, taskData, 3);
    expect(createResult.success).toBe(true);
    const masterTaskId = createResult.task.id;

    // Complete 1st time (master)
    mockSupabase.mockData.tasks[0].status = 'ongoing';
    const complete1 = await handleTaskCompletion(mockSupabase, masterTaskId);
    expect(complete1.success).toBe(true);
    expect(complete1.nextTask).toBeDefined();

    // Complete 2nd time
    const instance1Id = complete1.nextTask.id;
    const complete2 = await handleTaskCompletion(mockSupabase, instance1Id);
    expect(complete2.success).toBe(true);
    expect(complete2.nextTask).toBeDefined();

    // Complete 3rd time - should stop after this
    const instance2Id = complete2.nextTask.id;
    const complete3 = await handleTaskCompletion(mockSupabase, instance2Id);
    
    // Since count is 3 and we've completed 3 times, next would be 4th (should stop)
    expect(complete3.success).toBe(true);
    expect(complete3.message).toBe('Recurrence series completed');
  });

  it('should verify dates progress correctly for weekly task', async () => {
    const dates = [];
    let currentDate = new Date('2025-10-15'); // Wednesday

    // Simulate 5 weeks
    for (let i = 0; i < 5; i++) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate = calculateNextOccurrence(currentDate, 'weekly', 1, 3);
    }

    expect(dates).toEqual([
      '2025-10-15',
      '2025-10-22',
      '2025-10-29',
      '2025-11-05',
      '2025-11-12'
    ]);

    // All should be Wednesdays
    dates.forEach(dateStr => {
      const date = new Date(dateStr);
      expect(date.getDay()).toBe(3);
    });
  });
});

console.log('✅ Recurring Tasks Unit Tests Loaded');
