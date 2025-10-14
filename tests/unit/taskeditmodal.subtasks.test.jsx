// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock useSubtasks hook to simulate fetch/create/delete behaviors
const fetchSubtasksMock = vi.fn();
const createSubtaskMock = vi.fn();
const deleteSubtaskMock = vi.fn();

vi.mock('@/utils/hooks/useSubtasks', () => {
  return {
    useSubtasks: () => ({
      subtasks: mockedState.subtasks,
      loading: mockedState.loading,
      error: mockedState.error,
      fetchSubtasks: fetchSubtasksMock,
      createSubtask: createSubtaskMock,
      deleteSubtask: deleteSubtaskMock,
    })
  };
});

import TaskEditModal from '@/components/tasks/TaskEditModal.jsx';

let mockedState;

describe('TaskEditModal - Subtask management', () => {
  beforeEach(() => {
    mockedState = { subtasks: [], loading: false, error: '' };
    fetchSubtasksMock.mockReset();
    createSubtaskMock.mockReset();
    deleteSubtaskMock.mockReset();
  });

  const baseTask = {
    id: 100,
    title: 'Parent Task',
    owner_id: 1,
    status: 'ongoing',
    priority: 5,
  };

  const renderModal = (overrides = {}) =>
    render(
      <TaskEditModal
        open
        task={baseTask}
        onClose={() => {}}
        onSave={() => {}}
        {...overrides}
      />
    );

  it('loads subtasks when opening', () => {
    renderModal();
    expect(fetchSubtasksMock).toHaveBeenCalledWith(baseTask.id);
  });

  it('shows existing subtasks in list', async () => {
    mockedState.subtasks = [
      { id: 1, title: 'S1', status: 'ongoing' },
      { id: 2, title: 'S2', status: 'ongoing' },
    ];
    renderModal();
    await waitFor(() => {
      expect(screen.getAllByText('S1').length).toBeGreaterThan(0);
      expect(screen.getAllByText('S2').length).toBeGreaterThan(0);
    });
  });

  it('adds a new subtask via inline form', async () => {
    createSubtaskMock.mockResolvedValue({ success: true, subtask: { id: 3 } });
    renderModal();
    const subTitleInputs = screen.getAllByTestId('new-subtask-title');
    const subTitle = subTitleInputs[subTitleInputs.length - 1];
    fireEvent.change(subTitle, { target: { value: 'New sub' } });
    const addButtons = screen.getAllByText(/add subtask/i);
    const addButton = addButtons[addButtons.length - 1].closest('button');
    fireEvent.click(addButton);
    await waitFor(() => {
      expect(createSubtaskMock).toHaveBeenCalled();
    });
  });

  it('deletes a subtask from list', async () => {
    mockedState.subtasks = [{ id: 1, title: 'S1', status: 'ongoing' }];
    deleteSubtaskMock.mockResolvedValue({ success: true });
    renderModal();
    await waitFor(() => { expect(screen.getAllByText('S1').length).toBeGreaterThan(0); });
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    await waitFor(() => {
      expect(deleteSubtaskMock).toHaveBeenCalledWith(1);
    });
  });
});


