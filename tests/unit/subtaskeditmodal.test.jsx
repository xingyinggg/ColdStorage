// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SubtaskEditModal from '@/components/tasks/SubtaskEditModal.jsx';

describe('SubtaskEditModal', () => {
  const sub = { id: 9, title: 'T', description: 'D', priority: 5, status: 'ongoing', due_date: '2025-10-17' };

  it('calls onSave with normalized payload', () => {
    const onSave = vi.fn();
    render(<SubtaskEditModal open subtask={sub} onSave={onSave} onClose={() => {}} />);

    const title = screen.getByDisplayValue('T');
    fireEvent.change(title, { target: { value: 'Updated' } });
    const save = screen.getByRole('button', { name: /save/i });
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith(9, expect.objectContaining({ title: 'Updated', priority: 5, status: 'ongoing' }));
  });
});


