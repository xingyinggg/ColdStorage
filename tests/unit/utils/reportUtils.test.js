/**
 * Unit Tests for Report Utility Functions
 * Tests task status grouping, timeline sorting, and project membership validation
 */

import { describe, it, expect } from 'vitest';
import {
  groupTasksByStatus,
  getProjectStats,
  sortTasksByDueDate,
  isProjectMember,
  filterProjectsByMembership,
  hasProjectAccess,
  processTasksForReport,
} from '../../../src/utils/reportUtils.js';

describe('Report Utilities - Unit Tests', () => {
  describe('groupTasksByStatus', () => {
    it('should group tasks by status correctly', () => {
      const tasks = [
        { id: 1, status: 'ongoing', title: 'Task 1' },
        { id: 2, status: 'completed', title: 'Task 2' },
        { id: 3, status: 'under review', title: 'Task 3' },
        { id: 4, status: 'unassigned', title: 'Task 4' },
        { id: 5, status: 'ongoing', title: 'Task 5' },
      ];

      const grouped = groupTasksByStatus(tasks);

      expect(grouped.ongoing.length).toBe(2);
      expect(grouped.completed.length).toBe(1);
      expect(grouped.underReview.length).toBe(1);
      expect(grouped.unassigned.length).toBe(1);
    });

    it('should handle case-insensitive status matching', () => {
      const tasks = [
        { id: 1, status: 'ONGOING', title: 'Task 1' },
        { id: 2, status: 'Completed', title: 'Task 2' },
        { id: 3, status: 'UNDER REVIEW', title: 'Task 3' },
      ];

      const grouped = groupTasksByStatus(tasks);

      expect(grouped.ongoing.length).toBe(1);
      expect(grouped.completed.length).toBe(1);
      expect(grouped.underReview.length).toBe(1);
    });

    it('should handle tasks with null or undefined status', () => {
      const tasks = [
        { id: 1, status: null, title: 'Task 1' },
        { id: 2, status: undefined, title: 'Task 2' },
        { id: 3, title: 'Task 3' }, // no status property
      ];

      const grouped = groupTasksByStatus(tasks);

      // Tasks with null/undefined status should not be grouped
      expect(grouped.ongoing.length).toBe(0);
      expect(grouped.completed.length).toBe(0);
      expect(grouped.unassigned.length).toBe(0);
    });

    it('should return empty arrays for all statuses when no tasks match', () => {
      const tasks = [
        { id: 1, status: 'custom_status', title: 'Task 1' },
      ];

      const grouped = groupTasksByStatus(tasks);

      expect(grouped.ongoing.length).toBe(0);
      expect(grouped.completed.length).toBe(0);
      expect(grouped.underReview.length).toBe(0);
      expect(grouped.unassigned.length).toBe(0);
    });

    it('should handle empty task array', () => {
      const grouped = groupTasksByStatus([]);

      expect(grouped.ongoing.length).toBe(0);
      expect(grouped.completed.length).toBe(0);
      expect(grouped.underReview.length).toBe(0);
      expect(grouped.unassigned.length).toBe(0);
    });
  });

  describe('getProjectStats', () => {
    it('should calculate correct statistics', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      const tasks = [
        { id: 1, status: 'ongoing', due_date: futureDate.toISOString().split('T')[0] },
        { id: 2, status: 'completed', due_date: pastDate.toISOString().split('T')[0] },
        { id: 3, status: 'under review', due_date: futureDate.toISOString().split('T')[0] },
        { id: 4, status: 'ongoing', due_date: pastDate.toISOString().split('T')[0] }, // Overdue
        { id: 5, status: 'unassigned', due_date: futureDate.toISOString().split('T')[0] },
      ];

      const stats = getProjectStats(tasks);

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(1);
      expect(stats.ongoing).toBe(2);
      expect(stats.underReview).toBe(1);
      expect(stats.overdue).toBe(1); // Only task 4 is overdue (ongoing with past due_date)
    });

    it('should not count completed tasks as overdue', () => {
      const tasks = [
        { id: 1, status: 'completed', due_date: '2020-01-01' }, // Old completed task
        { id: 2, status: 'ongoing', due_date: '2020-01-01' }, // Old overdue task
      ];

      const stats = getProjectStats(tasks);

      expect(stats.overdue).toBe(1); // Only ongoing task is overdue
    });

    it('should handle tasks without due dates', () => {
      const tasks = [
        { id: 1, status: 'ongoing' }, // No due_date
        { id: 2, status: 'completed', due_date: null },
      ];

      const stats = getProjectStats(tasks);

      expect(stats.total).toBe(2);
      expect(stats.overdue).toBe(0); // No overdue (no valid due dates)
    });

    it('should handle empty task array', () => {
      const stats = getProjectStats([]);

      expect(stats.total).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.ongoing).toBe(0);
      expect(stats.underReview).toBe(0);
      expect(stats.overdue).toBe(0);
    });
  });

  describe('sortTasksByDueDate', () => {
    it('should sort tasks by due date ascending', () => {
      const tasks = [
        { id: 1, due_date: '2025-12-31' },
        { id: 2, due_date: '2025-10-01' },
        { id: 3, due_date: '2025-11-15' },
      ];

      const sorted = sortTasksByDueDate(tasks);

      expect(sorted[0].id).toBe(2); // Earliest date
      expect(sorted[1].id).toBe(3);
      expect(sorted[2].id).toBe(1); // Latest date
    });

    it('should place tasks without due_date at the end', () => {
      const tasks = [
        { id: 1, due_date: '2025-12-31' },
        { id: 2 }, // No due_date
        { id: 3, due_date: '2025-10-01' },
        { id: 4, due_date: null },
      ];

      const sorted = sortTasksByDueDate(tasks);

      expect(sorted[0].id).toBe(3); // Earliest date
      expect(sorted[1].id).toBe(1); // Latest date
      // Tasks without due_date should be at the end
      expect(sorted[2].id).toBe(2);
      expect(sorted[3].id).toBe(4);
    });

    it('should handle empty task array', () => {
      const sorted = sortTasksByDueDate([]);
      expect(sorted.length).toBe(0);
    });

    it('should handle all tasks without due dates', () => {
      const tasks = [
        { id: 1 },
        { id: 2, due_date: null },
        { id: 3 },
      ];

      const sorted = sortTasksByDueDate(tasks);

      expect(sorted.length).toBe(3);
      // Order may vary, but all should be present
      expect(sorted.map(t => t.id).sort()).toEqual([1, 2, 3]);
    });
  });

  describe('isProjectMember', () => {
    it('should return true if user is project owner', () => {
      const project = { id: 1, owner_id: '123', members: ['456'] };
      const userEmpId = '123';

      expect(isProjectMember(project, userEmpId)).toBe(true);
    });

    it('should return true if user is in members array', () => {
      const project = { id: 1, owner_id: '123', members: ['456', '789'] };
      const userEmpId = '456';

      expect(isProjectMember(project, userEmpId)).toBe(true);
    });

    it('should return false if user is neither owner nor member', () => {
      const project = { id: 1, owner_id: '123', members: ['456'] };
      const userEmpId = '999';

      expect(isProjectMember(project, userEmpId)).toBe(false);
    });

    it('should handle numeric and string IDs', () => {
      const project = { id: 1, owner_id: 123, members: ['456'] };
      const userEmpId = '123';

      expect(isProjectMember(project, userEmpId)).toBe(true);
    });

    it('should handle project without members array', () => {
      const project = { id: 1, owner_id: '123' };
      const userEmpId = '123';

      expect(isProjectMember(project, userEmpId)).toBe(true);
    });

    it('should handle project without owner_id', () => {
      const project = { id: 1, members: ['456'] };
      const userEmpId = '456';

      expect(isProjectMember(project, userEmpId)).toBe(true);
    });

    it('should return false for null/undefined project or userEmpId', () => {
      expect(isProjectMember(null, '123')).toBe(false);
      expect(isProjectMember({ id: 1 }, null)).toBe(false);
      expect(isProjectMember(undefined, '123')).toBe(false);
    });
  });

  describe('filterProjectsByMembership', () => {
    it('should filter projects to only those user belongs to', () => {
      const projects = [
        { id: 1, owner_id: '123', members: [] },
        { id: 2, owner_id: '456', members: ['123'] },
        { id: 3, owner_id: '789', members: ['999'] },
      ];
      const userEmpId = '123';

      const filtered = filterProjectsByMembership(projects, userEmpId);

      expect(filtered.length).toBe(2);
      expect(filtered.every(p => p.id === 1 || p.id === 2)).toBe(true);
    });

    it('should return empty array for user with no projects', () => {
      const projects = [
        { id: 1, owner_id: '456', members: [] },
        { id: 2, owner_id: '789', members: ['999'] },
      ];
      const userEmpId = '123';

      const filtered = filterProjectsByMembership(projects, userEmpId);

      expect(filtered.length).toBe(0);
    });

    it('should handle empty projects array', () => {
      const filtered = filterProjectsByMembership([], '123');
      expect(filtered.length).toBe(0);
    });

    it('should handle null/undefined inputs', () => {
      expect(filterProjectsByMembership(null, '123').length).toBe(0);
      expect(filterProjectsByMembership([], null).length).toBe(0);
    });
  });

  describe('hasProjectAccess', () => {
    it('should allow director access to all projects', () => {
      const project = { id: 1, owner_id: '999', members: [] };
      const userEmpId = '123';
      const userRole = 'director';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(true);
    });

    it('should allow HR access to all projects', () => {
      const project = { id: 1, owner_id: '999', members: [] };
      const userEmpId = '123';
      const userRole = 'hr';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(true);
    });

    it('should allow manager access to projects they belong to', () => {
      const project = { id: 1, owner_id: '123', members: [] };
      const userEmpId = '123';
      const userRole = 'manager';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(true);
    });

    it('should deny manager access to projects they do not belong to', () => {
      const project = { id: 1, owner_id: '999', members: [] };
      const userEmpId = '123';
      const userRole = 'manager';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(false);
    });

    it('should allow staff access to projects they belong to', () => {
      const project = { id: 1, owner_id: '123', members: [] };
      const userEmpId = '123';
      const userRole = 'staff';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(true);
    });

    it('should deny staff access to projects they do not belong to', () => {
      const project = { id: 1, owner_id: '999', members: [] };
      const userEmpId = '123';
      const userRole = 'staff';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(false);
    });

    it('should handle case-insensitive role matching', () => {
      const project = { id: 1, owner_id: '999', members: [] };
      const userEmpId = '123';

      expect(hasProjectAccess(project, userEmpId, 'DIRECTOR')).toBe(true);
      expect(hasProjectAccess(project, userEmpId, 'HR')).toBe(true);
    });

    it('should default to membership check for unknown roles', () => {
      const project = { id: 1, owner_id: '123', members: [] };
      const userEmpId = '123';
      const userRole = 'unknown_role';

      expect(hasProjectAccess(project, userEmpId, userRole)).toBe(true);
    });
  });

  describe('processTasksForReport', () => {
    it('should process tasks correctly with all statuses', () => {
      const tasks = [
        { id: 1, status: 'ongoing', due_date: '2025-12-31' },
        { id: 2, status: 'completed', due_date: '2025-11-01' },
        { id: 3, status: 'under review', due_date: '2025-10-01' },
        { id: 4, status: 'unassigned', due_date: '2025-09-01' },
      ];

      const result = processTasksForReport(tasks);

      expect(result.hasData).toBe(true);
      expect(result.stats.total).toBe(4);
      expect(result.tasksByStatus.ongoing.length).toBe(1);
      expect(result.tasksByStatus.completed.length).toBe(1);
      expect(result.tasksByStatus.underReview.length).toBe(1);
      expect(result.tasksByStatus.unassigned.length).toBe(1);
      expect(result.sortedTasks.length).toBe(4);
      expect(result.sortedTasks[0].id).toBe(4); // Earliest due date
    });

    it('should handle empty task array', () => {
      const result = processTasksForReport([]);

      expect(result.hasData).toBe(false);
      expect(result.stats.total).toBe(0);
      expect(result.sortedTasks.length).toBe(0);
    });

    it('should handle null/undefined tasks', () => {
      const result1 = processTasksForReport(null);
      const result2 = processTasksForReport(undefined);

      expect(result1.hasData).toBe(false);
      expect(result2.hasData).toBe(false);
      expect(result1.stats.total).toBe(0);
      expect(result2.stats.total).toBe(0);
    });

    it('should handle non-array input', () => {
      const result = processTasksForReport({});

      expect(result.hasData).toBe(false);
      expect(result.stats.total).toBe(0);
    });

    it('should sort tasks by due date in result', () => {
      const tasks = [
        { id: 1, status: 'ongoing', due_date: '2025-12-31' },
        { id: 2, status: 'ongoing', due_date: '2025-10-01' },
        { id: 3, status: 'ongoing', due_date: '2025-11-15' },
      ];

      const result = processTasksForReport(tasks);

      expect(result.sortedTasks[0].id).toBe(2); // Earliest
      expect(result.sortedTasks[1].id).toBe(3);
      expect(result.sortedTasks[2].id).toBe(1); // Latest
    });
  });
});

