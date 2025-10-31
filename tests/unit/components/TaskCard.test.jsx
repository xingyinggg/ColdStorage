import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '@/components/tasks/TaskCard';

describe('TaskCard Component', () => {
  const mockTask = {
    id: 1,
    title: 'Test Task',
    description: 'Test Description',
    status: 'In Progress',
    priority: 'High',
    due_date: '2025-12-31',
    assigned_to: 'TEST001'
  };

  it('should render task information correctly', () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', () => {
    const mockOnEdit = vi.fn();
    render(<TaskCard task={mockTask} onEdit={mockOnEdit} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);
    
    expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
  });

  it('should display correct priority color badge', () => {
    render(<TaskCard task={mockTask} />);
    
    const badge = screen.getByText('High');
    expect(badge).toHaveClass('bg-red-500'); // Adjust based on your styling
  });

  it('should format due date correctly', () => {
    render(<TaskCard task={mockTask} />);
    
    expect(screen.getByText(/2025-12-31/)).toBeInTheDocument();
  });
});

