// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import SubtaskEditModal from '@/components/tasks/SubtaskEditModal.jsx';

describe('SubtaskEditModal', () => {
  const sub = { id: 9, title: 'T', description: 'D', priority: 5, status: 'ongoing', due_date: '2025-10-17' };

  beforeEach(() => {
    cleanup();
  });

  it('calls onSave with normalized payload', () => {
    const onSave = vi.fn();
    render(<SubtaskEditModal open subtask={sub} onSave={onSave} onClose={() => {}} isOwner={true} />);

    const title = screen.getByDisplayValue('T');
    fireEvent.change(title, { target: { value: 'Updated' } });
    const save = screen.getByRole('button', { name: /save/i });
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith(9, expect.objectContaining({ title: 'Updated', priority: 5, status: 'ongoing' }));
  });

  it('only allows status changes for collaborators', () => {
    const onSave = vi.fn();
    render(<SubtaskEditModal open subtask={sub} onSave={onSave} onClose={() => {}} isCollaborator={true} isOwner={false} />);

    // Check that title and other fields are disabled
    const title = screen.getByDisplayValue('T');
    // Get all textboxes and find the textarea (which is the second one)
    const textboxes = screen.getAllByRole('textbox');
    const description = textboxes.find(el => el.tagName === 'TEXTAREA');
    const priority = screen.getByDisplayValue('5');
    // Get all comboboxes and find the enabled one (status field)
    const comboboxes = screen.getAllByRole('combobox');
    const status = comboboxes.find(el => !el.disabled);

    expect(title.disabled).toBe(true);
    expect(description.disabled).toBe(true);
    expect(priority.disabled).toBe(true);
    expect(status.disabled).toBe(false);

    // Change status and save
    fireEvent.change(status, { target: { value: 'completed' } });
    const save = screen.getByRole('button', { name: /save/i });
    fireEvent.click(save);

    // Should only send status update
    expect(onSave).toHaveBeenCalledWith(9, { status: 'completed' });
  });
});


