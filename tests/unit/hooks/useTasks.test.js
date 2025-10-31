import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTasks } from '@/utils/hooks/useTasks';

// Mock the supabase client
vi.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [
            { id: 1, title: 'Task 1', status: 'Open' },
            { id: 2, title: 'Task 2', status: 'In Progress' }
          ],
          error: null
        }))
      }))
    }))
  })
}));

describe('useTasks Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch tasks on mount', async () => {
    const { result } = renderHook(() => useTasks());

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(2);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should filter tasks by status', async () => {
    const { result } = renderHook(() => useTasks({ status: 'Open' }));

    await waitFor(() => {
      expect(result.current.tasks).toBeDefined();
    });

    // Verify the tasks are filtered
    expect(result.current.tasks.every(task => task.status === 'Open')).toBe(true);
  });

  it('should handle errors gracefully', async () => {
    // Mock an error
    vi.mock('@/utils/supabase/client', () => ({
      createClient: () => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              data: null,
              error: { message: 'Database error' }
            }))
          }))
        }))
      })
    }));

    const { result } = renderHook(() => useTasks());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
  });
});

