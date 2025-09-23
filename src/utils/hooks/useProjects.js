import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const supabase = createClient();

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("User not authenticated");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("owner_id", user.id) // Changed from user_id to owner_id
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setProjects(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (projectData) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            title: projectData.name,
            description: projectData.description,
            owner_id: user.id,
            status: "active",
            members: projectData.members || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) {
        throw error;
      }

      setProjects((prev) => [data[0], ...prev]);
      return data[0];
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProject = async (id, updates) => {
    try {
      const mappedUpdates = {
        ...updates,
        ...(updates.name && { title: updates.name }),
      };
      delete mappedUpdates.name;

      const { data, error } = await supabase
        .from("projects")
        .update(mappedUpdates)
        .eq("id", id)
        .select();

      if (error) {
        throw error;
      }

      setProjects((prev) =>
        prev.map((project) => (project.id === id ? data[0] : project))
      );
      return data[0];
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const deleteProject = async (id) => {
    try {
      const { error } = await supabase.from("projects").delete().eq("id", id);

      if (error) {
        throw error;
      }

      setProjects((prev) => prev.filter((project) => project.id !== id));
    } catch (err) {
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
  };
}
