// utils/hooks/useManagerTasks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export const useManagerTasks = () => {
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  const hasCacheRef = useRef(false);

  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const TASKS_CACHE_KEY = 'manager_tasks_cache_v1';
  const PROJECTS_CACHE_KEY = 'manager_projects_cache_v1';
  const STAFF_CACHE_KEY = 'manager_staff_cache_v1';

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabaseRef.current.auth.getSession();
    return session?.access_token;
  }, []);

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
      try {
        sessionStorage.setItem(TASKS_CACHE_KEY, JSON.stringify({ data: sortedTasks, timestamp: Date.now() }));
      } catch {}
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
      const projects = Array.isArray(data) ? data : (data?.projects || []);
      setAllProjects(projects);
      try {
        sessionStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify({ data: projects, timestamp: Date.now() }));
      } catch {}
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
      const staff = body.staffMembers || [];
      setStaffMembers(staff);
      try {
        sessionStorage.setItem(STAFF_CACHE_KEY, JSON.stringify({ data: staff, timestamp: Date.now() }));
      } catch {}
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
    // Try to load cached data first for instant rendering
    try {
      const tasksCached = JSON.parse(sessionStorage.getItem(TASKS_CACHE_KEY) || 'null');
      const projectsCached = JSON.parse(sessionStorage.getItem(PROJECTS_CACHE_KEY) || 'null');
      const staffCached = JSON.parse(sessionStorage.getItem(STAFF_CACHE_KEY) || 'null');

      const now = Date.now();
      let hadAnyCache = false;

      if (tasksCached && now - tasksCached.timestamp < CACHE_DURATION && Array.isArray(tasksCached.data)) {
        setAllTasks(tasksCached.data);
        hadAnyCache = true;
      }
      if (projectsCached && now - projectsCached.timestamp < CACHE_DURATION && Array.isArray(projectsCached.data)) {
        setAllProjects(projectsCached.data);
        hadAnyCache = true;
      }
      if (staffCached && now - staffCached.timestamp < CACHE_DURATION && Array.isArray(staffCached.data)) {
        setStaffMembers(staffCached.data);
        hadAnyCache = true;
      }

      if (hadAnyCache) {
        setLoading(false); // show cached content immediately
        hasCacheRef.current = true;
      }
    } catch {}

    const load = async () => {
      // Only show full-screen loader if no cache was available
      if (!hasCacheRef.current) setLoading(true);
      await Promise.all([fetchAllTasks(), fetchAllProjects(), fetchStaffMembers()]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - functions are stable with useCallback

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