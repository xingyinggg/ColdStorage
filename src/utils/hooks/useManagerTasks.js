// utils/hooks/useManagerTasks.js
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export const useManagerTasks = () => {
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Fetch all tasks (manager can see everything)
  const fetchAllTasks = useCallback(async () => {
    try {
      // First fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // If there are tasks, fetch owner information for each task
      if (tasksData && tasksData.length > 0) {
        // Get unique owner_ids
        const ownerIds = [...new Set(tasksData.map(task => task.owner_id).filter(Boolean))];
        
        if (ownerIds.length > 0) {
          // Fetch owner info for all unique owner_ids
          const { data: ownersData, error: ownersError } = await supabase
            .from('users')
            .select('emp_id, name, role')
            .in('emp_id', ownerIds);
          
          if (!ownersError && ownersData) {
            // Create a map of emp_id to owner info
            const ownersMap = {};
            ownersData.forEach(owner => {
              ownersMap[owner.emp_id] = owner;
            });
            
            // Add owner info to each task
            tasksData.forEach(task => {
              if (task.owner_id && ownersMap[task.owner_id]) {
                task.task_owner = ownersMap[task.owner_id];
              }
            });
          }
        }
      }

      setAllTasks(tasksData || []);
    } catch (err) {
      console.error('Error fetching all tasks:', err);
      setError(err.message);
    }
  }, [supabase]);

  // Fetch all projects
  const fetchAllProjects = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllProjects(data || []);
    } catch (err) {
      console.error('Error fetching all projects:', err);
      setError(err.message);
    }
  }, [supabase]);

  // Fetch all staff members
  const fetchStaffMembers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('emp_id, name, role, department')
        .eq('role', 'staff')
        .order('name');

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
      setError(err.message);
    }
  }, [supabase]);

  // Assign task to staff members
  const assignTask = async (taskData, collaboratorEmpIds) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get manager's emp_id to set as owner_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('emp_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            ...taskData,
            owner_id: userData.emp_id,
            collaborators: collaboratorEmpIds
          }
        ])
        .select();

      if (error) throw error;
      
      // Refresh tasks list
      await fetchAllTasks();
      return { success: true, data: data[0] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update task assignment
  const updateTaskAssignment = async (taskId, newCollaborators, updates = {}) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          collaborators: newCollaborators,
          ...updates
        })
        .eq('id', taskId)
        .select();

      if (error) throw error;
      
      // Refresh tasks list
      await fetchAllTasks();
      return { success: true, data: data[0] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Get tasks by status
  const getTasksByStatus = (status) => {
    return allTasks.filter(task => task.status === status);
  };

  // Get tasks by priority
  const getTasksByPriority = (priority) => {
    return allTasks.filter(task => task.priority === priority);
  };

  // Get overdue tasks
  const getOverdueTasks = () => {
    const today = new Date();
    return allTasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < today && 
      task.status !== 'completed'
    );
  };

  // Get tasks assigned to specific staff member
  const getTasksByStaff = (empId) => {
    return allTasks.filter(task => 
      task.collaborators && task.collaborators.includes(empId)
    );
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchAllTasks(),
        fetchAllProjects(),
        fetchStaffMembers()
      ]);
      setLoading(false);
    };

    loadData();
  }, [fetchAllTasks, fetchAllProjects, fetchStaffMembers]);

  return {
    allTasks,
    allProjects,
    staffMembers,
    loading,
    error,
    assignTask,
    updateTaskAssignment,
    getTasksByStatus,
    getTasksByPriority,
    getOverdueTasks,
    getTasksByStaff,
    refreshData: () => {
      fetchAllTasks();
      fetchAllProjects();
      fetchStaffMembers();
    }
  };
};