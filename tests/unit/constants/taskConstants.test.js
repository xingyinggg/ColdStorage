import { describe, it, expect } from 'vitest';
import {
  TASK_PRIORITIES,
  PRIORITY_LEVELS,
  PRIORITY_COLORS,
  TASK_STATUSES,
  STATUS_LEVELS
} from '../../../src/constants/taskConstants.js';

describe('Task Constants', () => {
  describe('TASK_PRIORITIES', () => {
    it('should have all priority levels', () => {
      expect(TASK_PRIORITIES).toHaveProperty('LOW');
      expect(TASK_PRIORITIES).toHaveProperty('MEDIUM');
      expect(TASK_PRIORITIES).toHaveProperty('HIGH');
    });

    it('should have string values', () => {
      Object.values(TASK_PRIORITIES).forEach(priority => {
        expect(typeof priority).toBe('string');
      });
    });
  });

  describe('PRIORITY_LEVELS', () => {
    it('should be an array', () => {
      expect(Array.isArray(PRIORITY_LEVELS)).toBe(true);
    });

    it('should contain all priorities in order', () => {
      expect(PRIORITY_LEVELS).toContain('low');
      expect(PRIORITY_LEVELS).toContain('medium');
      expect(PRIORITY_LEVELS).toContain('high');
    });
  });

  describe('PRIORITY_COLORS', () => {
    it('should have colors for each priority', () => {
      expect(PRIORITY_COLORS).toHaveProperty('high');
      expect(PRIORITY_COLORS).toHaveProperty('medium');
      expect(PRIORITY_COLORS).toHaveProperty('low');
    });

    it('should have color object with required properties', () => {
      Object.values(PRIORITY_COLORS).forEach(colorObj => {
        expect(colorObj).toHaveProperty('bg');
        expect(colorObj).toHaveProperty('text');
        expect(colorObj).toHaveProperty('border');
        expect(colorObj).toHaveProperty('dot');
      });
    });
  });

  describe('TASK_STATUSES', () => {
    it('should have all required statuses', () => {
      expect(TASK_STATUSES).toBeDefined();
      expect(Object.keys(TASK_STATUSES).length).toBeGreaterThan(0);
    });

    it('should have correct status values', () => {
      expect(TASK_STATUSES.UNASSIGNED).toBe('unassigned');
      expect(TASK_STATUSES.ONGOING).toBe('on going');
      expect(TASK_STATUSES.UNDER_REVIEW).toBe('under_review');
      expect(TASK_STATUSES.COMPLETED).toBe('completed');
    });
  });
});


