// app/dashboard/page.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useProjects } from "@/utils/hooks/useProjects";
import { useAuth } from "@/utils/hooks/useAuth";
import Link from "next/link";

// Import manager/HR dashboard component
import ManagerDashboard from "./ManagerDashboard";
import HrDashboard from "./HrDashboard";

export default function DashboardPage() {
  const router = useRouter();
  
  // Use auth hook to get user role
  const { user, userProfile, loading: authLoading, isManager, isStaff, isHR, signOut } = useAuth();

  // Use the tasks hook for staff
  const {
    activeTasks,
    overdueTasks,
    loading: tasksLoading,
    error: tasksError,
    toggleTaskComplete,
  } = useTasks();

  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

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
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Redirect if not authenticated
  if (!user) {
    return null;
  }

  // Render manager dashboard if user is manager
  if (isManager) {
    return <ManagerDashboard user={user} userProfile={userProfile} onLogout={handleLogout} />;
  }

  // Render HR dashboard if user is HR
  if (isHR) {
    return <HrDashboard user={user} userProfile={userProfile} onLogout={handleLogout} />;
}

  // Render staff dashboard (existing functionality)
  if (isStaff) {
    return <StaffDashboard />;
  }

  // Default fallback
  return (
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
  );

  // Staff Dashboard Component (existing functionality)
  function StaffDashboard() {
    return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">Task Management Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {userProfile?.name || user?.email}</span>
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Dashboard Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {activeTasks.length}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Tasks
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {activeTasks.length} tasks
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {overdueTasks.length}
                      </span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Overdue Tasks
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {overdueTasks.length} tasks
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Link
                      href="/projects"
                      className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
                    >
                      <span className="text-white text-sm font-medium">
                        {projectsLoading ? "..." : projects.length}
                      </span>
                    </Link>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Projects
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        <Link
                          href="/projects"
                          className="text-purple-600 hover:text-purple-800"
                        >
                          {projectsLoading
                            ? "Loading..."
                            : projectsError
                            ? "Error loading"
                            : `${projects.length} projects`}
                        </Link>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Link
                      href="/dashboard/tasks/create"
                      className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                    >
                      <span className="text-white text-lg font-bold">+</span>
                    </Link>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Quick Actions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        <Link
                          href="/dashboard/tasks/create"
                          className="text-green-600 hover:text-green-800"
                        >
                          New Task
                        </Link>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Tasks Section */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Active Tasks
                </h3>
                <Link
                  href="/dashboard/tasks"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View all tasks →
                </Link>
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Loading tasks...</div>
                </div>
              ) : tasksError ? (
                <div className="text-center py-8">
                  <div className="text-red-600 mb-2">Error loading tasks</div>
                  <div className="text-sm text-gray-500">{tasksError}</div>
                </div>
              ) : activeTasks.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">No active tasks</div>
                  <Link
                    href="/dashboard/tasks/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create your first task
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeTasks.slice(0, 5).map((task) => (
                    <div
                      key={task.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h4 className="text-base font-medium text-gray-900">
                              {task.title || "Untitled Task"}
                            </h4>
                            {task.priority && (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                                  task.priority
                                )}`}
                              >
                                {task.priority}
                              </span>
                            )}
                            {task.status && (
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                  task.status
                                )}`}
                              >
                                {task.status.replace("_", " ")}
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 mb-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center text-xs text-gray-500 space-x-4">
                            <span>Due: {formatDate(task.due_date)}</span>
                            {task.manager && (
                              <span className="text-blue-600">
                                • Assigned by: {task.manager.name} (ID: {task.manager.emp_id})
                              </span>
                            )}
                            {task.project_id && (
                              <span>Project: {task.project_id}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          <button
                            onClick={() => toggleTaskComplete(task.id)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            Mark Complete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {activeTasks.length > 5 && (
                    <div className="text-center pt-4">
                      <Link
                        href="/dashboard/tasks"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View {activeTasks.length - 5} more tasks →
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
    );
  }
}
