/**
 * Unit Tests for Supabase Library - Pure Functions
 *
 * Tests isolated utility functions without external dependencies
 */

import { describe, it, expect } from 'vitest';
import { getNumericIdFromEmpId } from '../../../server/lib/supabase.js';

describe('Supabase Library - Unit Tests', () => {
  describe('getNumericIdFromEmpId', () => {
    it('should extract numeric portion from end of string', () => {
      expect(getNumericIdFromEmpId('EMP001')).toBe(1);
      expect(getNumericIdFromEmpId('TEST123')).toBe(123);
      expect(getNumericIdFromEmpId('USER456')).toBe(456);
    });

    it('should return the full number if input is already numeric', () => {
      expect(getNumericIdFromEmpId(123)).toBe(123);
      expect(getNumericIdFromEmpId(999999)).toBe(999999);
    });

    it('should extract last numeric sequence from mixed strings', () => {
      expect(getNumericIdFromEmpId('ABC123DEF456')).toBe(456);
      expect(getNumericIdFromEmpId('USER001TASK002')).toBe(2);
      expect(getNumericIdFromEmpId('TEST001VER002')).toBe(2);
    });

    it('should return null for strings without numeric portions', () => {
      expect(getNumericIdFromEmpId('ABC')).toBe(null);
      expect(getNumericIdFromEmpId('TEST')).toBe(null);
      expect(getNumericIdFromEmpId('')).toBe(null);
    });

    it('should return null for null and undefined', () => {
      expect(getNumericIdFromEmpId(null)).toBe(null);
      expect(getNumericIdFromEmpId(undefined)).toBe(null);
    });

    it('should handle strings ending with zeros', () => {
      expect(getNumericIdFromEmpId('EMP001')).toBe(1);
      expect(getNumericIdFromEmpId('USER100')).toBe(100);
      expect(getNumericIdFromEmpId('TEST000')).toBe(0);
    });

    it('should handle very large numbers', () => {
      expect(getNumericIdFromEmpId('BIG999999999999999')).toBe(999999999999999);
    });

    it('should return null for strings ending with non-numeric characters', () => {
      expect(getNumericIdFromEmpId('TEST123ABC')).toBe(null);
      expect(getNumericIdFromEmpId('USER456XYZ')).toBe(null);
    });

    it('should handle single digit numbers', () => {
      expect(getNumericIdFromEmpId('A1')).toBe(1);
      expect(getNumericIdFromEmpId('B2')).toBe(2);
      expect(getNumericIdFromEmpId('C0')).toBe(0);
    });
  });
});
