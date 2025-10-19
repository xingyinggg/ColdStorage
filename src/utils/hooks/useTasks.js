// utils/hooks/useTasks.js
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Fetch all tasks via Express API
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session || !session.access_token) {
        console.warn("No valid session found when fetching tasks");
        setTasks([]); // Empty tasks when no session
        return;
      }
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      console.log("Fetching tasks from API:", apiUrl);
      
      try {
        // Using more robust fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
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
            // Try to parse as JSON
            const errorBody = JSON.parse(errorText);
            if (errorBody && errorBody.error) {
              errorMessage = errorBody.error;
            }
          } catch {
            // If parsing fails, use the raw text
            if (errorText) {
              errorMessage += `: ${errorText}`;
            }
          }
          
          throw new Error(errorMessage);
        }
        
        const body = await res.json();
        console.log("Tasks API response:", body);
        
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
        
        console.log("Sorted tasks:", sortedTasks);
        setTasks(sortedTasks);
        
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out - server may be down');
        } else {
          throw fetchError;
        }
      }
    } catch (err) {
      console.error("Error in fetchTasks:", err);
      setError(err.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

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
    const { data: { session } } = await supabase.auth.getSession();
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
        // Surface server error message if available
        let message = `HTTP error! status: ${response.status}`;
        try {
          const text = await response.text();
          if (text) {
            const body = JSON.parse(text);
            message = body?.error || body?.message || message;
          }
        } catch {
          // ignore JSON parse errors; keep default message
        }
        throw new Error(message);
      }

      const newTask = await response.json();
      setTasks((prev) => [newTask, ...prev]);
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
      } = await supabase.auth.getSession();
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
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      );
      return { success: true, data: updated };
    } catch (err) {
      setError(err.message);
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
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      return { success: true };
    } catch (err) {
      setError(err.message);
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
    getTasksByPriority,
  };
};
