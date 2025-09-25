import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  // Helper function to get auth token
  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();

      if (!token) {
        setError("User not authenticated");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data || []);
      setError(null);
    } catch (err) {
      console.error("Fetch projects error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: projectData.name,
            description: projectData.description,
            status: "active",
            members: projectData.members || [],
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const newProject = await response.json();
      setProjects((prev) => [newProject, ...prev]);
      return newProject;
    } catch (err) {
      console.error("Create project error:", err);
      setError(err.message);
      throw err;
    }
  };

  // NEW FUNCTION: Get project members
  const getProjectMembers = async (projectId) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      if (!projectId) {
        return { members: [] };
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${projectId}/members`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data; // Returns { members: [...] }
    } catch (err) {
      console.error("Get project members error:", err);
      throw err;
    }
  };

  const updateProject = async (id, updates) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      // Map the updates to match backend expectations
      const mappedUpdates = {
        ...updates,
        ...(updates.name && { title: updates.name }),
      };
      delete mappedUpdates.name;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mappedUpdates),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      const updatedProject = await response.json();
      setProjects((prev) =>
        prev.map((project) => (project.id === id ? updatedProject : project))
      );
      return updatedProject;
    } catch (err) {
      console.error("Update project error:", err);
      setError(err.message);
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      setProjects((prev) => prev.filter((project) => project.id !== id));
    } catch (err) {
      console.error("Delete project error:", err);
      setError(err.message);
      throw err;
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
    getProjectMembers,
  };
}
