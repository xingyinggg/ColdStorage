import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

const CACHE_KEY = "projects_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useProjects(user = null) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabaseRef = useRef(createClient());
  const isMountedRef = useRef(true);
  const hasFetchedRef = useRef(false);
  const fetchInProgressRef = useRef(false);
  const hasEverLoadedRef = useRef(false);

  // Helper function to get auth token
  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseRef.current.auth.getSession();
    return session?.access_token;
  }, []);

  // Load cache on mount ONLY if we've loaded data before (subsequent visits)
  useEffect(() => {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    if (cachedData) {
      try {
        const { projects: cachedProjects, timestamp } = JSON.parse(cachedData);
        const now = Date.now();
        
        if (now - timestamp < CACHE_DURATION && cachedProjects?.length > 0) {
          // Check if this is a subsequent load (after initial sign-in)
          const hasLoadedBefore = sessionStorage.getItem('projects_ever_loaded') === 'true';
          
          if (hasLoadedBefore) {
            console.log('✓ Showing cached', cachedProjects.length, 'projects immediately');
            setProjects(cachedProjects);
            setLoading(false);
            hasFetchedRef.current = true;
            hasEverLoadedRef.current = true;
          } else {
            console.log('First load after sign-in - waiting for fresh data (projects)');
            // Don't load cache, keep showing loading spinner
          }
        }
      } catch (err) {
        console.error("Error loading projects cache:", err);
        sessionStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    // Don't fetch if no user (not authenticated)
    if (!user) {
      console.log('⏸️ Skipping projects fetch - no user authenticated');
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
      
      const token = await getAuthToken();

      if (!token) {
        console.log(`⚠️ No session for projects`);
        fetchInProgressRef.current = false;
        setLoading(false);
        return;
      }

      console.log("📡 Fetching projects...");

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
      hasFetchedRef.current = true;
      
      // Cache the results
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        projects: data || [],
        timestamp: Date.now()
      }));
      
      // Mark that we've loaded data successfully
      sessionStorage.setItem('projects_ever_loaded', 'true');
      hasEverLoadedRef.current = true;
    } catch (err) {
      console.error("❌ Fetch projects error:", err);
      setError(err.message);
    } finally {
      fetchInProgressRef.current = false;
      setLoading(false);
    }
  }, [user, getAuthToken]);

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

  // Fetch when user becomes available
  useEffect(() => {
    isMountedRef.current = true;
    
    if (!user) {
      console.log('⏸️ useProjects: Waiting for user to authenticate...');
      return;
    }

    console.log('✓ useProjects: User authenticated, fetching projects for user:', user.id);
    fetchProjects();
    
    return () => {
      isMountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only depend on user, fetchProjects is stable

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
