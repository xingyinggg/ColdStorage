import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";

const CACHE_KEY = 'tasks_cache';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
const REQUEST_TIMEOUT = 15000; // 15 seconds

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  
  // Refs for cleanup and preventing unnecessary fetches
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const autoRefreshTimerRef = useRef(null);

  // Load cached tasks immediately on mount
  useEffect(() => {
    const loadCache = async () => {
      // Check if we have a valid session first
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session?.access_token) {
        console.log('No session, skipping cache load');
        return;
      }

      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { tasks: cachedTasks, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          if (age < CACHE_DURATION && cachedTasks?.length > 0) {
            console.log('Loading tasks from cache (age:', Math.round(age / 1000), 'seconds)');
            setTasks(cachedTasks);
            setLoading(false);
            hasFetchedRef.current = true;
          }
        } catch (err) {
          console.warn('Failed to parse cached tasks:', err);
          sessionStorage.removeItem(CACHE_KEY);
        }
      }
    };
    
    loadCache();
  }, []);

  // Fetch all tasks via Express API
  const fetchTasks = useCallback(async () => {
    try {
      // Only show loading state if we don't have cached data
      if (!hasFetchedRef.current) {
        setLoading(true);
      }
      setError(null);
      
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      
      if (!session || !session.access_token) {
        console.warn("No valid session found when fetching tasks");
        setTasks([]);
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      console.log("Fetching tasks from API:", apiUrl);
      
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
        console.log("Tasks API response:", body);
        
        // Sort tasks by priority descending, then by created_at
        const sortedTasks = (body.tasks || []).sort((a, b) => {
          const priorityA = a.priority !== null && a.priority !== undefined ? a.priority : 0;
          const priorityB = b.priority !== null && b.priority !== undefined ? b.priority : 0;
          
          if (priorityB !== priorityA) {
            return priorityB - priorityA;
          }
          
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        
        console.log("Sorted tasks:", sortedTasks);
        
        if (isMountedRef.current) {
          setTasks(sortedTasks);
          
          // Cache the results
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: sortedTasks,
            timestamp: Date.now()
          }));
          
          hasFetchedRef.current = true;
        }
        
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out - server may be down');
        } else {
          throw fetchError;
        }
      }
    } catch (err) {
      console.error("Error in fetchTasks:", err);
      if (isMountedRef.current) {
        setError(err.message || "Failed to fetch tasks");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up auto-refresh
  useEffect(() => {
    // Clear any existing timer
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    // Set up new auto-refresh timer
    autoRefreshTimerRef.current = setInterval(() => {
      if (isMountedRef.current && hasFetchedRef.current) {
        console.log('Auto-refreshing tasks...');
        fetchTasks();
      }
    }, AUTO_REFRESH_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [fetchTasks]);

  // Initial fetch only if no valid cache
  useEffect(() => {
    if (!hasFetchedRef.current) {
      fetchTasks();
    }
  }, [fetchTasks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, []);

  // Memoized computed values to prevent unnecessary re-renders
  const activeTasks = useMemo(() => {
    return tasks.filter((task) => task.status !== "completed");
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
      } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
      const cleanUpdates = { ...updates };
      
      let body;
      let headers = { Authorization: `Bearer ${session?.access_token || ""}` };
      
      if (updates instanceof FormData) {
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
      } catch (err) {
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