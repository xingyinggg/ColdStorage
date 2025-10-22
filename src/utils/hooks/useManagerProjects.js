// utils/hooks/useManagerProjects.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

export const useManagerProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());

  // Fetch all projects via Express API (for managers)
  const fetchAllProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("http://localhost:4000/manager-projects/all", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch projects");
      }

      const data = await response.json();
      setProjects(data);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError(err.message);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new project
  const createProject = useCallback(async (projectData) => {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token");
      }

      const response = await fetch("http://localhost:4000/manager-projects", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create project");
      }

      const newProject = await response.json();
      
      // Refresh the projects list
      await fetchAllProjects();
      
      return { success: true, project: newProject };
    } catch (err) {
      console.error("Error creating project:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [fetchAllProjects]);  // Delete a project
    const deleteProject = useCallback(async (projectId) => {
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No authentication token");
      }

      const response = await fetch(`http://localhost:4000/manager-projects/${projectId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete project");
      }

      // Refresh the projects list
      await fetchAllProjects();
      
      return { success: true };
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [fetchAllProjects]);

  // Get projects by status
  const getProjectsByStatus = (status) => {
    return projects.filter(project => project.status === status);
  };

  // Get active projects
  const getActiveProjects = () => {
    return projects.filter(project => 
      project.status !== 'completed' && project.status !== 'cancelled'
    );
  };

  // Get completed projects
  const getCompletedProjects = () => {
    return projects.filter(project => project.status === 'completed');
  };

  useEffect(() => {
    fetchAllProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    projects,
    loading,
    error,
    fetchAllProjects,
    createProject,
    deleteProject,
    getProjectsByStatus,
    getActiveProjects,
    getCompletedProjects,
    // Stats
    activeProjects: getActiveProjects(),
    completedProjects: getCompletedProjects(),
  };
};