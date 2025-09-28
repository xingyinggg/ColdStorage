import { useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async (options = {}) => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No authentication token");
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (options.roles?.length) {
        params.append("roles", options.roles.join(","));
      }
      if (options.excludeSelf) {
        params.append("exclude_self", "true");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
      const response = await fetch(`${apiUrl}/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setUsers(result.users || []);
      return { success: true, users: result.users || [] };

    } catch (error) {
      console.error("Error fetching users:", error);
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // Helper functions for specific use cases
  const getAllStaff = useCallback((excludeSelf = true) => {
    return fetchUsers({ roles: ["staff"], excludeSelf });
  }, [fetchUsers]);

  const getAssignableUsers = useCallback((currentUserRole, excludeSelf = true) => {
    let roles = [];
    
    if (currentUserRole === "director") {
      roles = ["manager", "staff"];
    } else if (currentUserRole === "manager") {
      roles = ["staff"];
    }

    if (roles.length === 0) return Promise.resolve({ success: true, users: [] });
    
    return fetchUsers({ roles, excludeSelf });
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    getAllStaff,
    getAssignableUsers,
  };
}