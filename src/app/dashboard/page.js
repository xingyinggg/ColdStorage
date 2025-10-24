// app/dashboard/page.js
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import { createClient } from "@/utils/supabase/client";

// Import manager/HR dashboard component
import ManagerDashboard from "./ManagerDashboard";
import HrDashboard from "./HrDashboard";
import DirectorDashboard from "./DirectorDashboard";
import SidebarLayout from "@/components/layout/SidebarLayout";
import StaffDashboardComponent from "./StaffDashboard";

const MEMBER_NAMES_CACHE_KEY = "member_names_cache";
const PROJECT_NAMES_CACHE_KEY = "project_names_cache";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default function DashboardPage() {
  const router = useRouter();
  const supabaseRef = useRef(createClient());
  const [memberNames, setMemberNames] = useState({});
  const [projectNames, setProjectNames] = useState({});
  // Ensure the first client render matches the server output to avoid hydration mismatches
  const [hasHydrated, setHasHydrated] = useState(false);
  const isMountedRef = useRef(true);
  const hasFetchedMemberNamesRef = useRef(false);
  const hasFetchedProjectNamesRef = useRef(false);

  // Use auth hook to get user role
  const {
    user,
    userProfile,
    loading: authLoading,
    isManager,
    isStaff,
    isHR,
    isDirector,
    signOut,
  } = useAuth();

  // Use the tasks hook for staff
  const {
    activeTasks,
    overdueTasks,
    loading: tasksLoading,
    error: tasksError,
    toggleTaskComplete,
    updateTask,
  } = useTasks(user);

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    getProjectNames,
  } = useProjects(user);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push("/login");
    }
    
    // Reset fetch refs when user changes (e.g., new login)
    if (user) {
      hasFetchedMemberNamesRef.current = false;
      hasFetchedProjectNamesRef.current = false;
    }
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user, authLoading, router]);

  // Ensure first client paint matches SSR to avoid hydration mismatch
  useEffect(() => {
    setHasHydrated(true);
  }, []);

  // Helper function to get auth token
  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabaseRef.current.auth.getSession();
    return session?.access_token;
  }, []);

  // Fetch member names with caching
  useEffect(() => {
    // Skip if already fetched or no tasks
    if (hasFetchedMemberNamesRef.current) return;
    if (!activeTasks.length && !overdueTasks.length) return;

    const fetchMemberNames = async () => {
      // Check cache first
      const cachedData = sessionStorage.getItem(MEMBER_NAMES_CACHE_KEY);
      if (cachedData) {
        try {
          const { names, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          
          if (now - timestamp < CACHE_DURATION) {
            setMemberNames(names);
            hasFetchedMemberNamesRef.current = true;
            return; // Use cache, don't fetch
          }
        } catch (err) {
          console.error("Error loading member names cache:", err);
        }
      }

      const allEmpIds = new Set();

      // Collect task owner IDs
      [...activeTasks, ...overdueTasks].forEach((task) => {
        if (task.owner_id) {
          allEmpIds.add(task.owner_id);
        }
      });

      if (allEmpIds.size === 0) {
        hasFetchedMemberNamesRef.current = true;
        return;
      }

      try {
        const token = await getAuthToken();
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/bulk`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ emp_ids: Array.from(allEmpIds) }),
          }
        );

        if (!response.ok) throw new Error("Failed to fetch users");
        const usersData = await response.json();

        const namesMap = {};
        usersData.forEach((user) => {
          namesMap[user.emp_id] = user.name;
        });
        
        if (isMountedRef.current) {
          setMemberNames(namesMap);
          hasFetchedMemberNamesRef.current = true;
          
          // Cache the results
          sessionStorage.setItem(MEMBER_NAMES_CACHE_KEY, JSON.stringify({
            names: namesMap,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error("Error fetching member names:", error);
        hasFetchedMemberNamesRef.current = true; // Mark as attempted
      }
    };

    fetchMemberNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTasks, overdueTasks]);  // Fetch project names using hook - with caching
  useEffect(() => {
    // Skip if already fetched
    if (hasFetchedProjectNamesRef.current) return;

    const fetchProjectNames = async () => {
      // Check cache first
      const cachedData = sessionStorage.getItem(PROJECT_NAMES_CACHE_KEY);
      if (cachedData) {
        try {
          const { names, timestamp } = JSON.parse(cachedData);
          const now = Date.now();
          
          if (now - timestamp < CACHE_DURATION) {
            setProjectNames(names);
            hasFetchedProjectNamesRef.current = true;
            return; // Use cache, don't fetch
          }
        } catch (err) {
          console.error("Error loading project names cache:", err);
        }
      }

      try {
        const projectNamesMap = await getProjectNames();
        if (isMountedRef.current) {
          setProjectNames(projectNamesMap);
          hasFetchedProjectNamesRef.current = true;
          
          // Cache the results
          sessionStorage.setItem(PROJECT_NAMES_CACHE_KEY, JSON.stringify({
            names: projectNamesMap,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error("Error fetching project names:", error);
        hasFetchedProjectNamesRef.current = true; // Mark as attempted
      }
    };

    fetchProjectNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Utility functions
  const formatDate = (dateString) => {
    if (!dateString) return "No due date";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPriorityColor = (priority) => {
    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "ongoing":
        return "bg-blue-100 text-blue-800";
      case "under review":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProjectName = (projectId) => {
    const project = projects.find((p) => p.id === projectId);
    return project ? project.title : projectId; // fallback to ID if not found
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // While hydrating, render the same lightweight loader structure the server rendered
  if (!hasHydrated) {
    return (
      <SidebarLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  // Show blocking loader ONLY when we don't yet know if there's a user
  // Keep UI visible on background refreshes (no flicker on tab focus)
  if (!user && authLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  // Avoid "Access Denied" flicker while the user profile/role is still loading
  if (user && authLoading && !userProfile) {
    return (
      <SidebarLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // Render manager dashboard if user is manager
  if (isManager) {
    return (
      <SidebarLayout>
        <ManagerDashboard
          user={user}
          userProfile={userProfile}
          onLogout={handleLogout}
        />
      </SidebarLayout>
    );
  }

  // Render HR dashboard if user is HR
  if (isHR) {
    return (
      <SidebarLayout>
        <HrDashboard
          user={user}
          userProfile={userProfile}
          onLogout={handleLogout}
        />
      </SidebarLayout>
    );
  }

  if (isDirector) {
    return (
      <SidebarLayout>
        <DirectorDashboard
          user={user}
          userProfile={userProfile}
          onLogout={handleLogout}
        />
      </SidebarLayout>
    );
  }

  // Render staff dashboard (using extracted component)
  if (isStaff) {
    return (
      <SidebarLayout>
        <StaffDashboardComponent
          userProfile={userProfile}
          activeTasks={activeTasks}
          overdueTasks={overdueTasks}
          projects={projects}
          projectsLoading={projectsLoading}
          projectsError={projectsError}
          formatDate={formatDate}
          getPriorityColor={getPriorityColor}
          getStatusColor={getStatusColor}
          getProjectName={getProjectName}
          toggleTaskComplete={toggleTaskComplete}
          handleLogout={handleLogout}
          currentUserEmpId={userProfile?.emp_id}
          onEditTask={updateTask}
          memberNames={memberNames}
          projectNames={projectNames}
        />
      </SidebarLayout>
    );
  }

  // Default fallback
  // Only show Access Denied once we definitively have a profile/role that isn't recognized
  if (userProfile?.role) {
    return (
      <SidebarLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">Your role is not recognized.</p>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Profile not ready yet: keep a lightweight loader inside the layout
  return (
    <SidebarLayout>
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    </SidebarLayout>
  );
}
