import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function useDepartmentTeams() {
  const [departmentTeams, setDepartmentTeams] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const supabase = createClient();

  const fetchTeamWorkload = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No access token");
      }

      const response = await fetch("http://localhost:4000/department-teams/workload", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      setTeamWorkload(data.workload || {});
      setDepartmentTeams(data.teams || []);
      
    } catch (err) {
      console.error("Error fetching team workload:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyTeam = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No access token");
      }

      const response = await fetch("http://localhost:4000/department-teams/my-team", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.teams || [];
      
    } catch (err) {
      console.error("Error fetching my team:", err);
      return [];
    }
  };

  useEffect(() => {
    fetchTeamWorkload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    departmentTeams,
    teamWorkload,
    loading,
    error,
    refreshData: fetchTeamWorkload,
    fetchMyTeam,
  };
}