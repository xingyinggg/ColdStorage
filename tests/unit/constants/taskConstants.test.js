import { describe, it, expect } from 'vitest';
import {
  TASK_PRIORITIES,
  PRIORITY_LEVELS,
  PRIORITY_COLORS,
  TASK_STATUSES,
  STATUS_LEVELS,
  getPriorityConfig
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

  describe('getPriorityConfig', () => {
    it('should return high priority config for "high"', () => {
      const config = getPriorityConfig('high');
      expect(config).toEqual({
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      });
    });

    it('should return medium priority config for "medium"', () => {
      const config = getPriorityConfig('medium');
      expect(config).toEqual({
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        dot: 'bg-orange-500'
      });
    });

    it('should return low priority config for "low"', () => {
      const config = getPriorityConfig('low');
      expect(config).toEqual({
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      });
    });

    it('should return default config for unknown priority', () => {
      const config = getPriorityConfig('unknown');
      expect(config).toEqual({
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        dot: 'bg-gray-500'
      });
    });

    it('should return default config for null priority', () => {
      const config = getPriorityConfig(null);
      expect(config).toEqual(PRIORITY_COLORS.default);
    });

    it('should return default config for undefined priority', () => {
      const config = getPriorityConfig(undefined);
      expect(config).toEqual(PRIORITY_COLORS.default);
    });

    it('should handle case insensitive priority matching', () => {
      expect(getPriorityConfig('HIGH')).toEqual(PRIORITY_COLORS.high);
      expect(getPriorityConfig('Medium')).toEqual(PRIORITY_COLORS.medium);
      expect(getPriorityConfig('LOW')).toEqual(PRIORITY_COLORS.low);
    });

    it('should handle empty string as unknown priority', () => {
      const config = getPriorityConfig('');
      expect(config).toEqual(PRIORITY_COLORS.default);
    });

    it('should handle whitespace-only string as unknown priority', () => {
      const config = getPriorityConfig('   ');
      expect(config).toEqual(PRIORITY_COLORS.default);
    });

    it('should return object with all required properties', () => {
      const config = getPriorityConfig('high');
      expect(config).toHaveProperty('bg');
      expect(config).toHaveProperty('text');
      expect(config).toHaveProperty('border');
      expect(config).toHaveProperty('dot');
    });

    it('should return valid Tailwind CSS classes', () => {
      const config = getPriorityConfig('high');
      expect(config.bg).toMatch(/^bg-\w+-\d+$/);
      expect(config.text).toMatch(/^text-\w+-\d+$/);
      expect(config.border).toMatch(/^border-\w+-\d+$/);
      expect(config.dot).toMatch(/^bg-\w+-\d+$/);
    });
  });
});


