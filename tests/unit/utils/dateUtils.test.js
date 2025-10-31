import { describe, it, expect } from 'vitest';
import {
  formatDate,
  isOverdue,
  getDaysUntilDue,
  getRelativeTimeString
} from '@/utils/dateUtils';

describe('Date Utilities', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-01-15');
      const formatted = formatDate(date);
      
      expect(formatted).toMatch(/2025/);
      expect(formatted).toMatch(/01/);
      expect(formatted).toMatch(/15/);
    });

    it('should handle null date', () => {
      expect(formatDate(null)).toBe('');
    });
  });

  describe('isOverdue', () => {
    it('should return true for past dates', () => {
      const pastDate = new Date('2020-01-01');
      expect(isOverdue(pastDate)).toBe(true);
    });

    it('should return false for future dates', () => {
      const futureDate = new Date('2030-01-01');
      expect(isOverdue(futureDate)).toBe(false);
    });

    it('should return false for null date', () => {
      expect(isOverdue(null)).toBe(false);
    });
  });

  describe('getDaysUntilDue', () => {
    it('should calculate days correctly', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const days = getDaysUntilDue(tomorrow);
      expect(days).toBe(1);
    });

    it('should return negative for overdue tasks', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const days = getDaysUntilDue(yesterday);
      expect(days).toBeLessThan(0);
    });
  });

  describe('getRelativeTimeString', () => {
    it('should return "Today" for current date', () => {
      const today = new Date();
      expect(getRelativeTimeString(today)).toMatch(/today/i);
    });

    it('should return "Tomorrow" for next day', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      expect(getRelativeTimeString(tomorrow)).toMatch(/tomorrow/i);
    });
  });
});

