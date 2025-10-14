"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import Link from "next/link";
import HrDashboard from "../HrDashboard";
import SidebarLayout from "@/components/layout/SidebarLayout";
import TaskCard from "@/components/tasks/TaskCard";
import Toast from "@/components/ui/Toast";
import { useManagerTasks } from "@/utils/hooks/useManagerTasks";
import StaffTasksView from "./components/StaffTasksView";
import ManagerTasksView from "./components/ManagerTasksView";

// moved status constants into StaffTasksView component

// Staff inline view removed; using StaffTasksView component instead

// ✅ Single default export (the page)
export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    loading: authLoading,
    isManager,
    isStaff,
    isDirector,
    isHR,
    signOut,
  } = useAuth();
  const {
    tasks = [],
    activeTasks = [],
    overdueTasks = [],
    toggleTaskComplete,
    updateTask,
  } = useTasks(); // adapt to your hook
  useProjects(); // keep hook initialised if needed elsewhere (no local use)
  useManagerTasks();

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }
  if (!user) return null;

  if (isManager || isDirector) {
    return (
      <SidebarLayout>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-xl font-semibold">Tasks</h1>
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
                >
                  Back to Dashboard
                </Link>
                <Link
                  href="/dashboard/tasks/create"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Create Task
                </Link>
              </div>
            </div>

            <ManagerTasksView currentUserEmpId={userProfile?.emp_id} />
          </div>
        </div>
      </SidebarLayout>
    );
  }

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

  if (isStaff || isDirector) {
    // Pass all tasks to StaffTasksView so it can handle all statuses
    return (
      <SidebarLayout>
        <div>
          <StaffTasksView tasks={tasks} onLogout={handleLogout} />
          <AllTasksSection
            tasks={tasks}
            onMarkComplete={toggleTaskComplete}
            currentUserEmpId={userProfile?.emp_id}
            onEditTask={updateTask}
          />
        </div>
      </SidebarLayout>
    );
  }

  // Fallback for unknown role
  return (
    <SidebarLayout>
      <div className="min-h-screen flex items-center justify-center">
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

// --- Helpers for TaskCard styling
function formatDate(dateString) {
  if (!dateString) return "No due date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPriorityColor(priority) {
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
}

function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function AllTasksSection({
  tasks = [],
  onMarkComplete,
  currentUserEmpId,
  onEditTask,
}) {
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  useEffect(() => {
    if (!feedback.message) return;
    const id = setTimeout(() => setFeedback({ type: "", message: "" }), 2500);
    return () => clearTimeout(id);
  }, [feedback]);
  return (
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
                const canEdit =
                  task.owner_id &&
                  currentUserEmpId && 
                  (String(currentUserEmpId) === String(task.owner_id) ||
                   (task.collaborators && Array.isArray(task.collaborators) && 
                    task.collaborators.includes(String(currentUserEmpId)))
                  );

                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    formatDate={formatDate}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    onMarkComplete={onMarkComplete}
                    canEdit={canEdit}
                    onEdit={async (id, updates) => {
                      const result = await onEditTask(id, updates);
                      if (result && result.success) {
                        setFeedback({
                          type: "success",
                          message: "Task updated successfully.",
                        });
                      } else {
                        setFeedback({
                          type: "error",
                          message: result?.error || "Failed to update task.",
                        });
                      }
                      return result;
                    }}
                  />
                );
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
    </div>
  );
}

// manager/staff subviews moved to ./components
