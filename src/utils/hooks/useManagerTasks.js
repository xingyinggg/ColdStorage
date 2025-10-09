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

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }, [supabase]);

  // Fallback: direct Supabase fetch for all tasks with owner enrichment
  // COMMENTED OUT - App should fully rely on API calls
  // const fetchAllTasksViaSupabase = useCallback(async () => {
  //   try {
  //     const { data: tasksData, error: tasksError } = await supabase
  //       .from('tasks')
  //       .select('*')
  //       .order('created_at', { ascending: false });
  //     if (tasksError) throw tasksError;

  //     if (tasksData && tasksData.length > 0) {
  //       const ownerIds = [...new Set(tasksData.map(t => t.owner_id).filter(Boolean))];
  //       if (ownerIds.length > 0) {
  //         const { data: owners, error: ownersErr } = await supabase
  //           .from('users')
  //           .select('emp_id, name, role')
  //           .in('emp_id', ownerIds);
  //         if (!ownersErr && owners) {
  //           const ownersMap = {};
  //           owners.forEach(o => { ownersMap[o.emp_id] = o; });
  //           tasksData.forEach(t => {
  //             if (t.owner_id && ownersMap[t.owner_id]) {
  //               t.task_owner = ownersMap[t.owner_id];
  //             }
  //           });
  //         }
  //       }
  //     }
  //     setAllTasks(tasksData || []);
  //   } catch (fallbackErr) {
  //     console.error('Fallback Supabase task fetch failed:', fallbackErr);
  //     setAllTasks([]);
  //     setError(fallbackErr.message);
  //   }
  // }, [supabase]);

  const fetchAllTasks = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No authentication token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/tasks/manager/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const body = await res.json();
      
      // Sort tasks by priority in descending order (10 to 1), then by created_at
      const sortedTasks = (body.tasks || []).sort((a, b) => {
        // Handle null/undefined priorities - treat them as 0 (lowest)
        const priorityA = a.priority !== null && a.priority !== undefined ? a.priority : 0;
        const priorityB = b.priority !== null && b.priority !== undefined ? b.priority : 0;
        
        // Sort by priority descending (higher priority first)
        if (priorityB !== priorityA) {
          return priorityB - priorityA;
        }
        
        // If priorities are equal, sort by created_at (newer first)
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      
      setAllTasks(sortedTasks);
    } catch (err) {
      console.error('Error fetching all tasks:', err);
      setError(err.message);
      setAllTasks([]); // Set empty array instead of fallback
    }
  }, [getToken]);

  const fetchAllProjects = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No authentication token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setAllProjects(Array.isArray(data) ? data : (data?.projects || []));
    } catch (err) {
      console.error('Error fetching all projects:', err);
      setError(err.message);
      setAllProjects([]);
    }
  }, [getToken]);

  // Fallback: Supabase staff list
  // COMMENTED OUT - App should fully rely on API calls
  // const fetchStaffMembersViaSupabase = useCallback(async () => {
  //   try {
  //     const { data, error } = await supabase
  //       .from('users')
  //       .select('emp_id, name, role, department')
  //       .eq('role', 'staff')
  //       .order('name');
  //     if (error) throw error;
  //     setStaffMembers(data || []);
  //   } catch (fallbackErr) {
  //     console.error('Fallback Supabase staff fetch failed:', fallbackErr);
  //     setStaffMembers([]);
  //     setError(fallbackErr.message);
  //   }
  // }, [supabase]);

  const fetchStaffMembers = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No authentication token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/tasks/manager/staff-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const body = await res.json();
      setStaffMembers(body.staffMembers || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
      setError(err.message);
      setStaffMembers([]); // Set empty array instead of fallback
    }
  }, [getToken]);

  const updateTaskAssignment = async (taskId, _collaborators, updates = {}) => {
    try {
      const token = await getToken();
      if (!token) throw new Error('No authentication token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/tasks/manager/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const updated = await res.json();
      await fetchAllTasks();
      return { success: true, data: updated };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const getTasksByStatus = (status) => allTasks.filter((t) => t.status === status);
  const getTasksByPriority = (priority) => allTasks.filter((t) => t.priority === priority);
  const getOverdueTasks = () => {
    const today = new Date();
    return allTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < today && t.status !== 'completed'
    );
  };
  const getTasksByStaff = (empId) => allTasks.filter((t) => t.collaborators && t.collaborators.includes(empId));



  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAllTasks(), fetchAllProjects(), fetchStaffMembers()]);
      setLoading(false);
    };
    load();
  }, [fetchAllTasks, fetchAllProjects, fetchStaffMembers]);

  return {
    allTasks,
    allProjects,
    staffMembers,
    loading,
    error,
    updateTaskAssignment,
    getTasksByStatus,
    getTasksByPriority,
    getOverdueTasks,
    getTasksByStaff,
    refreshData: () => {
      fetchAllTasks();
      fetchAllProjects();
      fetchStaffMembers();
    },
  };
};