"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import SidebarLayout from "@/components/layout/SidebarLayout";
import HeaderBar from "@/components/layout/HeaderBar";
import HrTasksView from "../components/HrTasksView";
import Toast from "@/components/ui/Toast";
import { formatDate, getPriorityColor, getStatusColor } from "../components/taskUtils";
import TaskCard from "@/components/tasks/TaskCard";

export default function HrTasksPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    loading: authLoading,
    isHR,
    signOut,
  } = useAuth();
  
  const {
    tasks = [],
    loading: tasksLoading,
    error: tasksError,
    fetchTasks,
    toggleTaskComplete,
    updateTask,
  } = useTasks(user);
  
  // Force a refetch when the page loads
  const [hrTasks, setHrTasks] = useState([]);

  useEffect(() => {
    if (user && userProfile && isHR) {
      // Refetch tasks to ensure we have the latest data
      fetchTasks();
    }
  }, [user, userProfile, isHR, fetchTasks]);

  // Log tasks data for debugging
  useEffect(() => {
    console.log("All tasks from API:", tasks);
    console.log("Current user profile:", userProfile);
  }, [tasks, userProfile]);
  
  // Process HR tasks - handle different backend status values
  useEffect(() => {
    if (userProfile?.role === "hr") {
      // For HR users, include all tasks they own or collaborate on
      // No need to filter by role since we're in the HR-specific view
      console.log("Setting HR tasks without additional filtering");
      
      // Make sure tasks is an array before setting
      if (Array.isArray(tasks)) {
        // Filter out any invalid tasks to prevent rendering errors
        const validTasks = tasks.filter(task => task && task.id);
        setHrTasks(validTasks);
        
        // Log the tasks that were set
        console.log("Tasks being shown:", validTasks);
        
        // Log warning if some tasks were filtered out
        if (validTasks.length !== tasks.length) {
          console.warn(`Filtered out ${tasks.length - validTasks.length} invalid tasks`);
        }
      } else {
        console.error("Tasks is not an array:", tasks);
        setHrTasks([]);
      }
    } else {
      setHrTasks([]);
    }
  }, [tasks, userProfile]);

  useEffect(() => {
    // Redirect non-HR users
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && !isHR) {
      router.push("/dashboard");
    }
  }, [user, authLoading, isHR, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Avoid full-screen loader on background refresh; show content and update inline
  if (!user && authLoading) {
    return (
      <SidebarLayout>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="text-lg">Loading...</div>
        </div>
      </SidebarLayout>
    );
  }

  if (!user || !isHR) return null;

  return (
    <SidebarLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tasksError ? (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded">
              <h3 className="font-semibold mb-2">Error loading tasks</h3>
              <p className="mb-2">{tasksError}</p>
              <div className="text-sm">
                <p>Possible solutions:</p>
                <ul className="list-disc list-inside mt-1">
                  <li>Make sure your backend server is running: <code>npm run dev:server</code></li>
                  <li>Check that you&apos;re using <code>npm run dev:all</code> to start both frontend and backend</li>
                  <li>Verify your authentication token is valid (try logging out and back in)</li>
                </ul>
              </div>
            </div>
            
            <button 
              onClick={() => fetchTasks()} 
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
            >
              Retry loading tasks
            </button>
            
            {/* Continue showing the HR tasks view with empty tasks */}
            <div className="mt-6">
              <HrTasksView tasks={[]} onLogout={handleLogout} />
            </div>
          </div>
        ) : (
          <>
            <HrTasksView tasks={hrTasks} onLogout={handleLogout} />
            {/* Add the AllTasksSection similar to the staff page */}
            <AllTasksSection
              tasks={hrTasks}
              onMarkComplete={toggleTaskComplete}
              currentUserEmpId={userProfile?.emp_id}
              onEditTask={updateTask}
              isHR={true}
              userProfile={userProfile}
            />
          </>
        )}
      </div>
    </SidebarLayout>
  );
}

// All Tasks Section component specifically for HR tasks
// Additional useEffect import not needed since we already import it at the top
function AllTasksSection({
  tasks = [],
  onMarkComplete,
  currentUserEmpId,
  onEditTask,
  isHR = false,
  userProfile
}) {
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [hrStaff, setHrStaff] = useState([]);
  
  // Fetch HR staff members for collaborator display
  useEffect(() => {
    if (isHR) {
      const fetchHrStaff = async () => {
        try {
          const response = await fetch("/api/hr/staff", {
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            setHrStaff(data.hrStaff || []);
          }
        } catch (error) {
          console.error("Error fetching HR staff:", error);
        }
      };
  
      fetchHrStaff();
    }
  }, [isHR]);

  useEffect(() => {
    if (!feedback.message) return;
    const id = setTimeout(() => setFeedback({ type: "", message: "" }), 2500);
    return () => clearTimeout(id);
  }, [feedback]);
  
  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };
  
  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar
          title={
            <div className="flex items-center space-x-3">
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
              >
                ← Dashboard
              </Link>
              <span>HR Tasks</span>
            </div>
          }
          user={user}
          userProfile={userProfile}
          roleLabel="HR"
          roleColor="purple"
          onLogout={handleLogout}
        />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-white shadow rounded-lg p-6 mt-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            All Tasks
          </h3>
          {tasks.length === 0 ? (
            <div className="text-gray-500">No tasks found</div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const isOwner = task.owner_id && currentUserEmpId && String(currentUserEmpId) === String(task.owner_id);
                
                // More robust collaborator detection - handle both array and object formats
                let isCollaborator = false;
                if (task.collaborators && currentUserEmpId) {
                  if (Array.isArray(task.collaborators)) {
                    isCollaborator = task.collaborators.includes(String(currentUserEmpId));
                  } else if (typeof task.collaborators === 'object' && task.collaborators !== null) {
                    const collabArray = Object.values(task.collaborators);
                    isCollaborator = collabArray.includes(String(currentUserEmpId));
                  }
                }
                
                const canEdit = task.owner_id && currentUserEmpId && (isOwner || isCollaborator);
                
                // Convert HR staff to a memberNames object for TaskCard
                const memberNames = hrStaff.reduce((acc, staff) => {
                  acc[staff.emp_id] = staff.name;
                  return acc;
                }, {});

                // Safely check that task is valid before rendering
                if (!task || !task.id) {
                  console.error("Invalid task object:", task);
                  return null;
                }
                
                try {
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      isOwner={isOwner}
                      isCollaborator={isCollaborator}
                      onTaskUpdate={onEditTask}
                      currentUserId={currentUserEmpId}
                      memberNames={memberNames}
                    />
                  );
                } catch (error) {
                  console.error(`Error rendering task ${task.id}:`, error);
                  return (
                    <div key={task.id} className="border border-red-200 rounded-md p-4 bg-red-50">
                      <p className="text-red-600">Error displaying task: {task.title}</p>
                    </div>
                  );
                }
              })}
            </div>
          )}
          <Toast
            type={
              feedback.type === "error"
                ? "error"
                : feedback.type
                ? feedback.type
                : "info"
            }
            message={feedback.message}
            onClose={() => setFeedback({ type: "", message: "" })}
          />
        </div>
      </div>
    </SidebarLayout>
  );
}