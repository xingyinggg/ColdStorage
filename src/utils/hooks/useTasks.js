/* istanbul ignore file */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

const CACHE_KEY = 'tasks_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
const REQUEST_TIMEOUT = 15000; // 15 seconds

export const useTasks = (user = null) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  
  // Refs for cleanup and preventing unnecessary fetches
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const autoRefreshTimerRef = useRef(null);
  const fetchInProgressRef = useRef(false);
  const hasEverLoadedRef = useRef(false); // Track if user has ever loaded data in this session

  // Load cache on mount ONLY if we've loaded data before (subsequent visits)
  useEffect(() => {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { tasks: cachedTasks, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_DURATION && cachedTasks?.length > 0) {
          // Check if this is a subsequent load (after initial sign-in)
          const hasLoadedBefore = sessionStorage.getItem('tasks_ever_loaded') === 'true';
          
          if (hasLoadedBefore) {
            console.log('✓ Showing cached', cachedTasks.length, 'tasks immediately');
            setTasks(cachedTasks);
            setLoading(false);
            hasFetchedRef.current = true;
            hasEverLoadedRef.current = true;
          } else {
            console.log('First load after sign-in - waiting for fresh data');
            // Don't load cache, keep showing loading spinner
          }
        }
      } catch (err) {
        console.warn('Failed to parse cached tasks:', err);
        sessionStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  // Fetch all tasks via Express API
  const fetchTasks = useCallback(async () => {
    // Don't fetch if no user (not authenticated)
    if (!user) {
      console.log('⏸️ Skipping fetch - no user authenticated');
      return;
    }

    // Prevent duplicate fetches
    if (fetchInProgressRef.current) {
      return;
    }

    try {
      fetchInProgressRef.current = true;
      
      // Show loading spinner ONLY on first load (not subsequent loads with cache)
      if (!hasEverLoadedRef.current) {
        setLoading(true);
      }
      setError(null);
      
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      
      if (!session || !session.access_token) {
        console.log(`⚠️ No session available`);
        fetchInProgressRef.current = false;
        setLoading(false);
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      console.log("📡 Fetching tasks...");
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        
        const res = await fetch(`${apiUrl}/tasks`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.error("API error status:", res.status);
          const errorText = await res.text();
          let errorMessage = `API Error (${res.status})`;
          
          try {
            const errorBody = JSON.parse(errorText);
            if (errorBody && errorBody.error) {
              errorMessage = errorBody.error;
            }
          } catch {
            if (errorText) {
              errorMessage += `: ${errorText}`;
            }
          }
          
          throw new Error(errorMessage);
        }
        
        const body = await res.json();
        console.log("✓ Tasks API response received:", body.tasks?.length || 0, "tasks");
        
        // Sort tasks by priority descending, then by created_at
        const sortedTasks = (body.tasks || []).sort((a, b) => {
          const priorityA = a.priority !== null && a.priority !== undefined ? a.priority : 0;
          const priorityB = b.priority !== null && b.priority !== undefined ? b.priority : 0;
          
          if (priorityB !== priorityA) {
            return priorityB - priorityA;
          }
          
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        
        // Always set state - React will handle unmounted components safely
        console.log('✓ Setting tasks state with', sortedTasks.length, 'tasks');
        setTasks(sortedTasks);
        
        // Cache the results
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          tasks: sortedTasks,
          timestamp: Date.now()
        }));
        
        // Mark that we've loaded data successfully
        sessionStorage.setItem('tasks_ever_loaded', 'true');
        hasFetchedRef.current = true;
        hasEverLoadedRef.current = true;
        console.log('✓ Tasks state updated, cache saved, flags set');
        
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          // Graceful: keep current UI, retry on next interval
          console.warn(`Tasks request timed out after ${REQUEST_TIMEOUT}ms; will retry on next interval`);
          return;
        }
        throw fetchError;
      }
    } catch (err) {
      console.error("❌ Error in fetchTasks:", err);
      setError(err.message || "Failed to fetch tasks");
    } finally {
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  }, [user]);

  // Fetch when user becomes available
  useEffect(() => {
    if (!user) {
      console.log('⏸️ useTasks: Waiting for user to authenticate...');
      return;
    }

    console.log('✓ useTasks: User authenticated, fetching tasks for user:', user.id);
    
    // Fetch immediately when user is available
    fetchTasks();

    // Set up auto-refresh timer
    autoRefreshTimerRef.current = setInterval(() => {
      if (isMountedRef.current && user) {
        fetchTasks();
      }
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, fetchTasks is stable

  // Note: Cleanup for autoRefreshTimer is handled in the main useEffect above

  // Memoized computed values to prevent unnecessary re-renders
  const activeTasks = useMemo(() => {
    const active = tasks.filter((task) => task.status !== "completed");
    console.log('📊 useTasks: Computed activeTasks:', active.length, 'from', tasks.length, 'total tasks');
    return active;
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "completed");
  }, [tasks]);

  const overdueTasks = useMemo(() => {
    const today = new Date();
    return tasks.filter(
      (task) =>
        task.due_date &&
        new Date(task.due_date) < today &&
        task.status !== "completed"
    );
  }, [tasks]);

  // Get tasks by priority (still a function since it takes a parameter)
  const getTasksByPriority = (priority) => {
    return tasks.filter((task) => task.priority === priority);
  };
  
  // Helper function to get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await supabaseRef.current.auth.getSession();
    return session?.access_token;
  };

  // Create a new task via Express API
  const createTask = async (taskData) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      if (!(taskData instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/tasks`,
        {
          method: "POST",
          headers,
          body: taskData instanceof FormData ? taskData : JSON.stringify(taskData),
        }
      );

      if (!response.ok) {
        let message = `HTTP error! status: ${response.status}`;
        try {
          const text = await response.text();
          if (text) {
            const body = JSON.parse(text);
            message = body?.error || body?.message || message;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const newTask = await response.json();
      
      if (isMountedRef.current) {
        setTasks((prev) => {
          const updatedTasks = [newTask, ...prev];
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: updatedTasks,
            timestamp: Date.now()
          }));
          return updatedTasks;
        });
      }
      
      return { success: true, task: newTask };
    } catch (err) {
      console.error("Create task error:", err);
      return { success: false, error: err.message };
    }
  };

  // Update a task
  const updateTask = async (taskId, updates) => {
    try {
      console.log("useTasks.updateTask - starting update for task:", taskId, "with updates:", updates);
      
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      // Normalize updates
      const cleanUpdates = { ...updates };
      // Allow camelCase -> snake_case for due date if needed
      if (cleanUpdates.dueDate && !cleanUpdates.due_date) {
        cleanUpdates.due_date = cleanUpdates.dueDate;
        delete cleanUpdates.dueDate;
      }
      // Convert empty string to null for due_date so backend can clear it
      if (cleanUpdates.due_date === "") {
        cleanUpdates.due_date = null;
      }
      
      let body;
      let headers = { Authorization: `Bearer ${session?.access_token || ""}` };
      
      if (updates instanceof FormData) {
        // Ensure due_date normalization for FormData as well
        if (updates.has('dueDate') && !updates.has('due_date')) {
          const val = updates.get('dueDate');
          updates.delete('dueDate');
          if (val !== undefined && val !== null && val !== '') {
            updates.append('due_date', val);
          }
        }
        body = updates;
      } else {
        body = JSON.stringify(cleanUpdates);
        headers["Content-Type"] = "application/json";
      }
      
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: "PUT",
        headers,
        body,
      });
      
      let responseData;
      try {
        responseData = await res.json();
      } catch {
        responseData = {};
      }
      
      if (!res.ok) {
        throw new Error(responseData?.error || `Request failed: ${res.status}`);
      }
      
      const updated = responseData;
      console.log("useTasks.updateTask - received response:", updated);
      
      // Update the task in local state with the server response
      if (isMountedRef.current) {
        setTasks((prev) => {
          const newTasks = prev.map((t) => {
            if (t.id === taskId) {
              console.log("useTasks.updateTask - updating local task:", t.id, "old status:", t.status, "new status:", updated.status);
              return { ...t, ...updated };
            }
            return t;
          });
          
          // Update cache with new tasks
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: newTasks,
            timestamp: Date.now()
          }));
          
          return newTasks;
        });
        
        // Force a refetch to ensure we have the latest data
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchTasks();
          }
        }, 500);
      }
      
      return { success: true, data: updated };
    } catch (err) {
      console.error("useTasks.updateTask - error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      return { success: false, error: err.message };
    }
  };

  // Delete a task
  const deleteTask = async (taskId) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      
      if (isMountedRef.current) {
        setTasks((prev) => {
          const updatedTasks = prev.filter((task) => task.id !== taskId);
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: updatedTasks,
            timestamp: Date.now()
          }));
          return updatedTasks;
        });
      }
      
      return { success: true };
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.message);
      }
      return { success: false, error: err.message };
    }
  };

  // Toggle task completion
  const toggleTaskComplete = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = task.status === "completed" ? "ongoing" : "completed";
    return await updateTask(taskId, { status: newStatus });
  };

  return {
    tasks,
    loading,
    error,
    activeTasks,
    completedTasks,
    overdueTasks,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    getTasksByPriority,
  };
};