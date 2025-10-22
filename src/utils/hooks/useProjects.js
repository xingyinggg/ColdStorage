import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

const CACHE_KEY = "projects_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);

  // Helper function to get auth token
  const getAuthToken = async () => {
    const {
      data: { session },
    } = await supabaseRef.current.auth.getSession();
    return session?.access_token;
  };

  // Load from cache immediately
  useEffect(() => {
    const loadCache = async () => {
      // Check if we have a valid session first
      const token = await getAuthToken();
      if (!token) {
        console.log('No session, skipping projects cache load');
        return;
      }

      const cachedData = sessionStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const { projects: cachedProjects, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          
          if (now - timestamp < CACHE_DURATION) {
            setProjects(cachedProjects);
            setLoading(false);
            hasFetchedRef.current = true; // Mark as having valid data
          }
        } catch (err) {
          console.error("Error loading projects cache:", err);
        }
      }
    };
    
    loadCache();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      // Only show loading state if we don't have cached data
      if (!hasFetchedRef.current) {
        setLoading(true);
      }
      
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
      
      if (isMountedRef.current) {
        setProjects(data || []);
        setError(null);
        
        // Cache the results
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({
          projects: data || [],
          timestamp: Date.now()
        }));
      }
    } catch (err) {
      console.error("Fetch projects error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

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
      if (isMountedRef.current) {
        setProjects((prev) => {
          const updatedProjects = [newProject, ...prev];
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            projects: updatedProjects,
            timestamp: Date.now()
          }));
          return updatedProjects;
        });
      }
      return newProject;
    } catch (err) {
      console.error("Create project error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
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

  // NEW FUNCTION: Get project names mapping
  const getProjectNames = async () => {
    try {
      const token = await getAuthToken();

      if (!token) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/projects/names`,
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

      const projectNamesMap = await response.json();
      return projectNamesMap; // Returns { 1: "Project Name", 2: "Another Project" }
    } catch (err) {
      console.error("Get project names error:", err);
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
      if (isMountedRef.current) {
        setProjects((prev) => {
          const updatedProjects = prev.map((project) => (project.id === id ? updatedProject : project));
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            projects: updatedProjects,
            timestamp: Date.now()
          }));
          return updatedProjects;
        });
      }
      return updatedProject;
    } catch (err) {
      console.error("Update project error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
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

      if (isMountedRef.current) {
        setProjects((prev) => {
          const updatedProjects = prev.filter((project) => project.id !== id);
          // Update cache
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            projects: updatedProjects,
            timestamp: Date.now()
          }));
          return updatedProjects;
        });
      }
    } catch (err) {
      console.error("Delete project error:", err);
      if (isMountedRef.current) {
        setError(err.message);
      }
      throw err;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    // Only fetch if we don't have valid cached data
    if (!hasFetchedRef.current) {
      fetchProjects();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    refetch: fetchProjects,
    getProjectMembers,
    getProjectNames,
  };
}
