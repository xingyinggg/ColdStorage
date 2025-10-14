// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Mock useSubtasks hook to control its behavior
const fetchSubtasksMock = vi.fn(() => Promise.resolve());
const updateSubtaskMock = vi.fn(() => Promise.resolve({ success: true }));
vi.mock('@/utils/hooks/useSubtasks', () => {
  return {
    useSubtasks: () => ({
      subtasks: mockedState.subtasks,
      loading: mockedState.loading,
      error: mockedState.error,
      fetchSubtasks: fetchSubtasksMock,
      updateSubtask: updateSubtaskMock,
    })
  };
});

// Provide minimal props required by TaskCard
import TaskCard from '@/components/tasks/TaskCard.jsx';

let mockedState;

describe('CS-US4: TaskCard - Subtasks panel', () => {
  beforeEach(() => {
    mockedState = { subtasks: [], loading: false, error: '' };
    fetchSubtasksMock.mockReset();
    updateSubtaskMock.mockReset();
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

  it('fetches and displays subtasks list when expanded (viewer)', async () => {
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

  it('collaborator can view subtasks but not see edit pill', async () => {
    mockedState.subtasks = [
      { id: 1, title: 'S1', description: 'd', priority: 7, status: 'ongoing' },
    ];

    // canEdit=false simulates viewer/collaborator (not owner)
    render(<TaskCard task={baseTask} canEdit={false} />);
    const [toggleBtn] = screen.getAllByRole('button', { name: /view subtasks/i });
    fireEvent.click(toggleBtn);

    await waitFor(() => {
      expect(screen.getAllByText('S1').length).toBeGreaterThan(0);
    });
    // Ensure there is no Edit pill in the subtask row
    expect(screen.queryByText(/^[\s]*edit[\s]*$/i)).toBeNull();
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

  it.skip('opens subtask edit modal from pill and saves changes showing toast', async () => {
    mockedState.subtasks = [{ id: 11, title: 'Sub A', status: 'ongoing', priority: 5 }];
    // Explicitly allow editing
    render(<TaskCard task={baseTask} canEdit={true} />);
    const [toggleBtn] = screen.getAllByRole('button', { name: /view subtasks/i });
    fireEvent.click(toggleBtn);

    // Click the Edit pill within the specific subtask row (avoid task-level Edit)
    const subRow = screen.getByText('Sub A').closest('li');
    const editPill = within(subRow).getByText(/^[\s]*edit[\s]*$/i);
    fireEvent.click(editPill);

    // Change title inside modal and save
    const titleInput = screen.getByDisplayValue('Sub A');
    fireEvent.change(titleInput, { target: { value: 'Sub A updated' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSubtaskMock).toHaveBeenCalled();
      // Toast should appear
      expect(screen.getByText(/subtask updated successfully/i)).toBeTruthy();
    });
  });
});


