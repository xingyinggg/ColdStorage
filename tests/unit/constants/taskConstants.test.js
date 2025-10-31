import { describe, it, expect } from 'vitest';
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_COLORS,
  PRIORITY_VALUES,
  STATUS_VALUES
} from '@/constants/taskConstants';

describe('Task Constants', () => {
  describe('TASK_STATUS', () => {
    it('should have all required statuses', () => {
      expect(TASK_STATUS).toHaveProperty('OPEN');
      expect(TASK_STATUS).toHaveProperty('IN_PROGRESS');
      expect(TASK_STATUS).toHaveProperty('COMPLETED');
    });

    it('should have string values', () => {
      Object.values(TASK_STATUS).forEach(status => {
        expect(typeof status).toBe('string');
      });
    });
  });

  describe('TASK_PRIORITY', () => {
    it('should have all priority levels', () => {
      expect(TASK_PRIORITY).toHaveProperty('LOW');
      expect(TASK_PRIORITY).toHaveProperty('MEDIUM');
      expect(TASK_PRIORITY).toHaveProperty('HIGH');
    });
  });

  describe('TASK_COLORS', () => {
    it('should have color for each status', () => {
      Object.keys(TASK_STATUS).forEach(status => {
        expect(TASK_COLORS).toHaveProperty(status);
      });
    });

    it('should have valid color codes', () => {
      Object.values(TASK_COLORS).forEach(color => {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$|^rgb/);
      });
    });
  });

  describe('PRIORITY_VALUES', () => {
    it('should have numeric values for sorting', () => {
      expect(PRIORITY_VALUES.LOW).toBeLessThan(PRIORITY_VALUES.MEDIUM);
      expect(PRIORITY_VALUES.MEDIUM).toBeLessThan(PRIORITY_VALUES.HIGH);
    });
  });

  describe('STATUS_VALUES', () => {
    it('should be an array', () => {
      expect(Array.isArray(STATUS_VALUES)).toBe(true);
    });

    it('should contain all statuses', () => {
      Object.values(TASK_STATUS).forEach(status => {
        expect(STATUS_VALUES).toContain(status);
      });
    });
  });
});

