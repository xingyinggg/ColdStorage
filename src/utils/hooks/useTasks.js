// utils/hooks/useTasks.js
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

const CACHE_KEY = "tasks_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 30 * 1000; // 30 seconds
const REQUEST_TIMEOUT = 15000; // 15 seconds

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  const refreshIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Load from cache immediately
  useEffect(() => {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const { tasks: cachedTasks, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        // Use cache if it's less than CACHE_DURATION old
        if (now - timestamp < CACHE_DURATION) {
          setTasks(cachedTasks);
          setLoading(false);
          hasFetchedRef.current = true; // Mark as having valid data
        }
      } catch (err) {
        console.error("Error loading cache:", err);
      }
    }
  }, []);

  // Fetch all tasks via Express API
  const fetchTasks = useCallback(async (skipLoadingState = false) => {
    try {
      // Only show loading state if we don't have cached data and not skipping
      if (!skipLoadingState && !hasFetchedRef.current) {
        setLoading(true);
      }
      setError(null);
      
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      
      if (!session || !session.access_token) {
        console.warn("No valid session found when fetching tasks");
        if (isMountedRef.current) {
          setTasks([]);
          setLoading(false);
        }
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      
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
        
        // Sort tasks by priority in descending order (10 to 1), then by created_at
        const sortedTasks = (body.tasks || []).sort((a, b) => {
          const priorityA = a.priority !== null && a.priority !== undefined ? a.priority : 0;
          const priorityB = b.priority !== null && b.priority !== undefined ? b.priority : 0;
          
          if (priorityB !== priorityA) {
            return priorityB - priorityA;
          }
          
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        
        if (isMountedRef.current) {
          setTasks(sortedTasks);
          
          // Cache the results
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: sortedTasks,
            timestamp: Date.now()
          }));
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
      if (isMountedRef.current && !skipLoadingState) {
        setLoading(false);
      }
    }
  }, []);

  // Get active tasks (not completed)
  const getActiveTasks = () => {
    return tasks.filter((task) => task.status !== "completed");
  };

  // Get completed tasks
  const getCompletedTasks = () => {
    return tasks.filter((task) => task.status === "completed");
  };

  // Get tasks by priority
  const getTasksByPriority = (priority) => {
    return tasks.filter((task) => task.priority === priority);
  };

  // Get overdue tasks
  const getOverdueTasks = () => {
    const today = new Date();
    return tasks.filter(
      (task) =>
        task.due_date &&
        new Date(task.due_date) < today &&
        task.status !== "completed"
    );
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

      // FormData automatically sets Content-Type with boundary
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
      const {
        data: { session },
      } = await supabaseRef.current.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const updated = await res.json();
      if (isMountedRef.current) {
        setTasks((prev) => {
          const updatedTasks = prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t));
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            tasks: updatedTasks,
            timestamp: Date.now()
          }));
          return updatedTasks;
        });
      }
      return { success: true, data: updated };
    } catch (err) {
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
      } = await supabaseRef.current.auth.getSession();
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

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch if we don't have valid cached data
    if (!hasFetchedRef.current) {
      fetchTasks();
    }

    // Set up auto-refresh every 30 seconds
    refreshIntervalRef.current = setInterval(() => {
      fetchTasks(true); // Skip loading state for background refreshes
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
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
    getTasksByPriority,
  };
};
