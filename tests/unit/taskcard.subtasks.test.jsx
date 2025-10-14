// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock useSubtasks hook to control its behavior
vi.mock('@/utils/hooks/useSubtasks', () => {
  return {
    useSubtasks: () => ({
      subtasks: mockedState.subtasks,
      loading: mockedState.loading,
      error: mockedState.error,
      fetchSubtasks: vi.fn(() => Promise.resolve()),
    })
  };
});

// Provide minimal props required by TaskCard
import TaskCard from '@/components/tasks/TaskCard.jsx';

let mockedState;

describe('CS-US4: TaskCard - Subtasks panel', () => {
  beforeEach(() => {
    mockedState = { subtasks: [], loading: false, error: '' };
  });

  const baseTask = {
    id: 101,
    title: 'Parent Task',
    owner_id: 1,
    collaborators: [],
    priority: 5,
    status: 'ongoing'
  };

  it('renders a toggle to view subtasks', () => {
    render(<TaskCard task={baseTask} canEdit={false} />);
    expect(screen.getAllByRole('button', { name: /view subtasks/i }).length).toBeGreaterThan(0);
  });

  it('fetches and displays subtasks list when expanded', async () => {
    mockedState.subtasks = [
      { id: 1, title: 'S1', description: 'd', priority: 7, status: 'ongoing' },
      { id: 2, title: 'S2', priority: 3, status: 'ongoing' },
    ];

    render(<TaskCard task={baseTask} canEdit={false} />);
    const [toggleBtn] = screen.getAllByRole('button', { name: /view subtasks/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getAllByText('S1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('S2').length).toBeGreaterThan(0);
    });
  });

  it('shows count badge after first load', async () => {
    mockedState.subtasks = [{ id: 1, title: 'S1', status: 'ongoing' }];
    render(<TaskCard task={baseTask} canEdit={false} />);
    const [toggleBtn] = screen.getAllByRole('button', { name: /view subtasks/i });
    fireEvent.click(toggleBtn);
    // Badge appears with count "1" after list rendered
    await waitFor(() => {
      const badges = screen.getAllByTitle('Subtasks count');
      expect(badges.some(b => b.textContent === '1')).toBe(true);
    });
  });
});


