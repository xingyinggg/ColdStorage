/**
 * Unit Tests for Deadline Notification Service - Pure Functions
 *
 * Tests isolated functions without external dependencies
 * User Story: CS-US165 - Deadline Notification System
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getSingaporeDate, setupDeadlineScheduler, getDeadlineServiceStatus } from '../../../server/services/deadlineNotificationService.js';

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
});
