import { useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export const useSubtasks = () => {
  const [subtasks, setSubtasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Fetch subtasks for a task
  const fetchSubtasks = useCallback(async (taskId) => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subtasks/task/${taskId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch subtasks");
      }

      const data = await response.json();
      setSubtasks(data.subtasks || []);
      return { success: true, subtasks: data.subtasks || [] };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Create subtask
  const createSubtask = async (subtaskData) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subtasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(subtaskData),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create subtask");
      }

      const data = await response.json();
      setSubtasks(prev => [...prev, data.subtask]);
      return { success: true, subtask: data.subtask };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Update subtask
  const updateSubtask = async (subtaskId, updates) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subtasks/${subtaskId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update subtask");
      }

      const data = await response.json();
      setSubtasks(prev => 
        prev.map(subtask => 
          subtask.id === subtaskId ? data.subtask : subtask
        )
      );
      return { success: true, subtask: data.subtask };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  // Delete subtask
  const deleteSubtask = async (subtaskId) => {
    try {
      const token = await getAuthToken();
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/subtasks/${subtaskId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete subtask");
      }

      setSubtasks(prev => prev.filter(subtask => subtask.id !== subtaskId));
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  return {
    subtasks,
    loading,
    error,
    fetchSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  };
};