// utils/hooks/useTasks.js
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Fetch all tasks for the current user
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, get the user's emp_id from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('emp_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      if (!userData?.emp_id) throw new Error('User emp_id not found');

      // Then fetch tasks using the emp_id as owner_id
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('owner_id', userData.emp_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error in fetchTasks:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Get active tasks (not completed)
  const getActiveTasks = () => {
    return tasks.filter(task => task.status !== 'completed');
  };

  // Get completed tasks
  const getCompletedTasks = () => {
    return tasks.filter(task => task.status === 'completed');
  };

  // Get tasks by priority
  const getTasksByPriority = (priority) => {
    return tasks.filter(task => task.priority === priority);
  };

  // Get overdue tasks
  const getOverdueTasks = () => {
    const today = new Date();
    return tasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < today && 
      task.status !== 'completed'
    );
  };

  // Create a new task
  const createTask = async (taskData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // First, get the user's emp_id from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('emp_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      if (!userData?.emp_id) throw new Error('User emp_id not found');

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            ...taskData,
            owner_id: userData.emp_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) throw error;
      
      setTasks(prev => [data[0], ...prev]);
      return { success: true, data: data[0] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update a task
  const updateTask = async (taskId, updates) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select();

      if (error) throw error;

      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? { ...task, ...updates } : task
        )
      );
      
      return { success: true, data: data[0] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskId));
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Toggle task completion
  const toggleTaskComplete = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === 'completed' ? 'in_progress' : 'completed';
    return await updateTask(taskId, { status: newStatus });
  };

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    tasks,
    loading,
    error,
    activeTasks: getActiveTasks(),
    completedTasks: getCompletedTasks(),
    overdueTasks: getOverdueTasks(),
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    getTasksByPriority
  };
};
