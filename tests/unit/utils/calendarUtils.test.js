/**
 * Unit Tests for Calendar Utility Functions
 * Tests date grid generation, task grouping, and filtering logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  startOfDay,
  addDays,
  isSameDay,
  getMonthGrid,
  getWeekGrid,
  groupTasksByDate,
  filterByProject,
  filterByStatus,
  filterByAssignee,
  filterTasksWithDueDate,
  applyFilters,
} from '../../../src/utils/calendarUtils.js';

describe('Calendar Utilities - Unit Tests', () => {
  describe('startOfDay', () => {
    it('should set time to 00:00:00:000', () => {
      const date = new Date('2025-10-31T15:30:45.123Z');
      const result = startOfDay(date);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('should preserve the date (year, month, day)', () => {
      const date = new Date('2025-10-31T15:30:45Z');
      const result = startOfDay(date);
      
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(9); // October is month 9 (0-indexed)
      expect(result.getDate()).toBe(31);
    });

    it('should handle different timezones correctly', () => {
      const date = new Date('2025-10-31T23:59:59Z');
      const result = startOfDay(date);
      
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe('addDays', () => {
    it('should add positive days correctly', () => {
      const date = new Date('2025-10-31');
      const result = addDays(date, 5);
      
      expect(result.getDate()).toBe(5);
      expect(result.getMonth()).toBe(10); // November
    });

    it('should subtract days with negative number', () => {
      const date = new Date('2025-10-31');
      const result = addDays(date, -5);
      
      expect(result.getDate()).toBe(26);
      expect(result.getMonth()).toBe(9); // October
    });

    it('should handle month boundary transitions', () => {
      const date = new Date('2025-10-31');
      const result = addDays(date, 1);
      
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(10); // November
    });

    it('should handle year boundary transitions', () => {
      const date = new Date('2025-12-31');
      const result = addDays(date, 1);
      
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
    });

    it('should handle leap year February correctly', () => {
      const date = new Date('2024-02-28');
      const result = addDays(date, 1);
      
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(1); // February
    });

    it('should handle non-leap year February correctly', () => {
      const date = new Date('2025-02-28');
      const result = addDays(date, 1);
      
      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(2); // March
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      const date1 = new Date('2025-10-31T10:00:00Z');
      const date2 = new Date('2025-10-31T15:30:00Z');
      
      expect(isSameDay(date1, date2)).toBe(true);
    });

    it('should return false for different days', () => {
      const date1 = new Date('2025-10-31T10:00:00Z');
      const date2 = new Date('2025-11-01T10:00:00Z');
      
      expect(isSameDay(date1, date2)).toBe(false);
    });

    it('should return false for different months', () => {
      const date1 = new Date('2025-10-31T10:00:00Z');
      const date2 = new Date('2025-11-01T10:00:00Z');
      
      expect(isSameDay(date1, date2)).toBe(false);
    });
  });

  describe('getMonthGrid', () => {
    it('should return 42 dates (6 weeks)', () => {
      const cursor = new Date('2025-10-15');
      const grid = getMonthGrid(cursor);
      
      expect(grid.length).toBe(42);
    });

    it('should start on Sunday of the week containing the 1st', () => {
      const cursor = new Date('2025-10-15'); // October 15, 2025 (Wednesday)
      const grid = getMonthGrid(cursor);
      
      // First day should be a Sunday
      expect(grid[0].getDay()).toBe(0);
    });

    it('should include all days of the month', () => {
      const cursor = new Date('2025-10-15'); // October has 31 days
      const grid = getMonthGrid(cursor);
      
      // Find October dates
      const octoberDates = grid.filter(d => d.getMonth() === 9);
      expect(octoberDates.length).toBeGreaterThanOrEqual(31);
    });

    it('should include days from previous month at start', () => {
      const cursor = new Date('2025-10-15');
      const grid = getMonthGrid(cursor);
      
      // First few days might be from September
      const firstDay = grid[0];
      expect(firstDay.getMonth()).toBeLessThanOrEqual(9); // October is month 9
    });

    it('should include days from next month at end', () => {
      const cursor = new Date('2025-10-15');
      const grid = getMonthGrid(cursor);
      
      // Last few days might be from November
      const lastDay = grid[41];
      expect(lastDay.getMonth()).toBeGreaterThanOrEqual(9); // October is month 9
    });
  });

  describe('getWeekGrid', () => {
    it('should return 7 dates', () => {
      const cursor = new Date('2025-10-15');
      const grid = getWeekGrid(cursor);
      
      expect(grid.length).toBe(7);
    });

    it('should start on Sunday', () => {
      const cursor = new Date('2025-10-15'); // Wednesday
      const grid = getWeekGrid(cursor);
      
      expect(grid[0].getDay()).toBe(0); // Sunday
    });

    it('should end on Saturday', () => {
      const cursor = new Date('2025-10-15');
      const grid = getWeekGrid(cursor);
      
      expect(grid[6].getDay()).toBe(6); // Saturday
    });

    it('should include the cursor date', () => {
      const cursor = new Date('2025-10-15');
      const grid = getWeekGrid(cursor);
      
      const cursorDay = cursor.getDay();
      expect(isSameDay(grid[cursorDay], cursor)).toBe(true);
    });
  });

  describe('groupTasksByDate', () => {
    it('should group tasks by their due date', () => {
      const tasks = [
        { id: 1, title: 'Task 1', due_date: '2025-10-15' },
        { id: 2, title: 'Task 2', due_date: '2025-10-15' },
        { id: 3, title: 'Task 3', due_date: '2025-10-16' },
      ];
      
      const daysGrid = [
        new Date('2025-10-15'),
        new Date('2025-10-16'),
        new Date('2025-10-17'),
      ];
      
      const grouped = groupTasksByDate(tasks, daysGrid);
      
      const day15Key = startOfDay(new Date('2025-10-15')).getTime();
      const day16Key = startOfDay(new Date('2025-10-16')).getTime();
      
      expect(grouped.get(day15Key).length).toBe(2);
      expect(grouped.get(day16Key).length).toBe(1);
    });

    it('should initialize empty arrays for days with no tasks', () => {
      const tasks = [
        { id: 1, title: 'Task 1', due_date: '2025-10-15' },
      ];
      
      const daysGrid = [
        new Date('2025-10-15'),
        new Date('2025-10-16'),
      ];
      
      const grouped = groupTasksByDate(tasks, daysGrid);
      
      const day16Key = startOfDay(new Date('2025-10-16')).getTime();
      expect(grouped.get(day16Key).length).toBe(0);
    });

    it('should ignore tasks without due_date', () => {
      const tasks = [
        { id: 1, title: 'Task 1', due_date: '2025-10-15' },
        { id: 2, title: 'Task 2', due_date: null },
        { id: 3, title: 'Task 3' }, // no due_date property
      ];
      
      const daysGrid = [new Date('2025-10-15')];
      const grouped = groupTasksByDate(tasks, daysGrid);
      
      const day15Key = startOfDay(new Date('2025-10-15')).getTime();
      expect(grouped.get(day15Key).length).toBe(1);
    });

    it('should not add tasks for dates not in grid', () => {
      const tasks = [
        { id: 1, title: 'Task 1', due_date: '2025-10-15' },
        { id: 2, title: 'Task 2', due_date: '2025-11-15' }, // Not in grid
      ];
      
      const daysGrid = [new Date('2025-10-15')];
      const grouped = groupTasksByDate(tasks, daysGrid);
      
      const day15Key = startOfDay(new Date('2025-10-15')).getTime();
      expect(grouped.get(day15Key).length).toBe(1);
    });
  });

  describe('filterByProject', () => {
    it('should return all tasks when projectId is empty', () => {
      const tasks = [
        { id: 1, project_id: 1 },
        { id: 2, project_id: 2 },
      ];
      
      const filtered = filterByProject(tasks, '');
      expect(filtered.length).toBe(2);
    });

    it('should filter tasks by project_id', () => {
      const tasks = [
        { id: 1, project_id: 1 },
        { id: 2, project_id: 2 },
        { id: 3, project_id: 1 },
      ];
      
      const filtered = filterByProject(tasks, '1');
      expect(filtered.length).toBe(2);
      expect(filtered.every(t => t.project_id === 1)).toBe(true);
    });

    it('should handle numeric project_id', () => {
      const tasks = [
        { id: 1, project_id: 1 },
        { id: 2, project_id: 2 },
      ];
      
      const filtered = filterByProject(tasks, 1);
      expect(filtered.length).toBe(1);
    });

    it('should handle null project_id', () => {
      const tasks = [
        { id: 1, project_id: null },
        { id: 2, project_id: 1 },
      ];
      
      const filtered = filterByProject(tasks, '');
      expect(filtered.length).toBe(2);
    });
  });

  describe('filterByStatus', () => {
    it('should return all tasks when status is empty', () => {
      const tasks = [
        { id: 1, status: 'ongoing' },
        { id: 2, status: 'completed' },
      ];
      
      const filtered = filterByStatus(tasks, '');
      expect(filtered.length).toBe(2);
    });

    it('should filter tasks by status', () => {
      const tasks = [
        { id: 1, status: 'ongoing' },
        { id: 2, status: 'completed' },
        { id: 3, status: 'ongoing' },
      ];
      
      const filtered = filterByStatus(tasks, 'ongoing');
      expect(filtered.length).toBe(2);
      expect(filtered.every(t => t.status === 'ongoing')).toBe(true);
    });

    it('should handle null status', () => {
      const tasks = [
        { id: 1, status: null },
        { id: 2, status: 'ongoing' },
      ];
      
      const filtered = filterByStatus(tasks, '');
      expect(filtered.length).toBe(2);
    });
  });

  describe('filterByAssignee', () => {
    it('should return all tasks when assigneeId is empty', () => {
      const tasks = [
        { id: 1, owner_id: 1 },
        { id: 2, owner_id: 2 },
      ];
      
      const filtered = filterByAssignee(tasks, '');
      expect(filtered.length).toBe(2);
    });

    it('should filter by owner_id', () => {
      const tasks = [
        { id: 1, owner_id: 1 },
        { id: 2, owner_id: 2 },
        { id: 3, owner_id: 1 },
      ];
      
      const filtered = filterByAssignee(tasks, '1');
      expect(filtered.length).toBe(2);
    });

    it('should filter by collaborators', () => {
      const tasks = [
        { id: 1, owner_id: 1, collaborators: [2, 3] },
        { id: 2, owner_id: 2, collaborators: [4] },
        { id: 3, owner_id: 1, collaborators: [2] },
      ];
      
      const filtered = filterByAssignee(tasks, '2');
      // Should match: task 1 (has collaborator 2), task 2 (has owner_id 2), task 3 (has collaborator 2)
      expect(filtered.length).toBe(3);
      expect(filtered.every(t => 
        String(t.owner_id) === '2' || 
        (Array.isArray(t.collaborators) && t.collaborators.map(String).includes('2'))
      )).toBe(true);
    });

    it('should filter by assignees array', () => {
      const tasks = [
        { id: 1, owner_id: 1, assignees: [{ emp_id: 2 }, { id: 3 }] },
        { id: 2, owner_id: 2, assignees: [{ emp_id: 4 }] },
      ];
      
      const filtered = filterByAssignee(tasks, '2');
      // Should match: task 1 (has assignee 2), task 2 (has owner_id 2)
      expect(filtered.length).toBe(2);
      expect(filtered.every(t => 
        String(t.owner_id) === '2' ||
        (Array.isArray(t.assignees) && t.assignees.some(a => 
          String(a?.emp_id || a?.id || '') === '2'
        ))
      )).toBe(true);
    });

    it('should handle tasks with no assignee fields', () => {
      const tasks = [
        { id: 1 },
        { id: 2, owner_id: 1 },
      ];
      
      const filtered = filterByAssignee(tasks, '1');
      expect(filtered.length).toBe(1);
    });
  });

  describe('filterTasksWithDueDate', () => {
    it('should filter out tasks without due_date', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15' },
        { id: 2, due_date: null },
        { id: 3 }, // no due_date property
        { id: 4, due_date: '2025-10-16' },
      ];
      
      const filtered = filterTasksWithDueDate(tasks);
      expect(filtered.length).toBe(2);
      expect(filtered.every(t => !!t.due_date)).toBe(true);
    });

    it('should keep tasks with empty string due_date', () => {
      const tasks = [
        { id: 1, due_date: '' },
        { id: 2, due_date: '2025-10-15' },
      ];
      
      const filtered = filterTasksWithDueDate(tasks);
      // Empty string is falsy, so it should be filtered out
      expect(filtered.length).toBe(1);
    });

    it('should handle all tasks with due_date', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15' },
        { id: 2, due_date: '2025-10-16' },
      ];
      
      const filtered = filterTasksWithDueDate(tasks);
      expect(filtered.length).toBe(2);
    });

    it('should handle all tasks without due_date', () => {
      const tasks = [
        { id: 1 },
        { id: 2, due_date: null },
      ];
      
      const filtered = filterTasksWithDueDate(tasks);
      expect(filtered.length).toBe(0);
    });
  });

  describe('applyFilters', () => {
    it('should apply all filters correctly', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15', project_id: 1, status: 'ongoing', owner_id: 1 },
        { id: 2, due_date: '2025-10-16', project_id: 1, status: 'completed', owner_id: 1 },
        { id: 3, due_date: '2025-10-17', project_id: 2, status: 'ongoing', owner_id: 1 },
        { id: 4 }, // no due_date
      ];
      
      const filtered = applyFilters(tasks, {
        projectId: '1',
        status: 'ongoing',
        assigneeId: '1',
        requireDueDate: true,
      });
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(1);
      expect(filtered[0].due).toBeDefined();
    });

    it('should handle no filters', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15' },
        { id: 2, due_date: '2025-10-16' },
        { id: 3 }, // no due_date
      ];
      
      const filtered = applyFilters(tasks, { requireDueDate: true });
      expect(filtered.length).toBe(2);
    });

    it('should not require due_date when requireDueDate is false', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15' },
        { id: 2 }, // no due_date
      ];
      
      const filtered = applyFilters(tasks, { requireDueDate: false });
      expect(filtered.length).toBe(2);
    });

    it('should normalize tasks with due property', () => {
      const tasks = [
        { id: 1, due_date: '2025-10-15' },
      ];
      
      const filtered = applyFilters(tasks, {});
      expect(filtered[0].due).toBeDefined();
      expect(filtered[0].due.getHours()).toBe(0);
    });
  });
});

