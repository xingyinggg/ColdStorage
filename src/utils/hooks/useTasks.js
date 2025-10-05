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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const res = await fetch(`${apiUrl}/tasks`, {
        headers: { Authorization: `Bearer ${session?.access_token || ""}` },
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
      setTasks(sortedTasks);
    } catch (err) {
      console.error("Error in fetchTasks:", err);
      setError(err.message);
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
