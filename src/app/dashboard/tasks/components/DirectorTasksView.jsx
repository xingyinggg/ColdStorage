"use client";

import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import ManagerTasks from "./ManagerTasks";

export default function DirectorTasksView({ onLogout, showHeader = true, projectNames = {} }) {
  const { user, userProfile, signOut } = useAuth();
  const { tasks = [], toggleTaskComplete, updateTask } = useTasks(user);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const handleEditTask = async (taskId, updates) => {
    try {
      const result = await updateTask(taskId, updates);
      return result;
    } catch (error) {
      console.error("Error updating task:", error);
      return { success: false, error: error.message || "Update failed" };
    }
  };

  // Early return if profile not ready
  if (!userProfile) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 text-center text-gray-600">
          Loading user profile...
        </div>
      </div>
    );
  }

  const currentUserEmpId = userProfile?.emp_id;

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className=" sm:px-0">
        {/*  Create Task button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Task Across Teams</h2>

          <Link
            href="/dashboard/tasks/create"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="whitespace-nowrap">Create Task</span>
          </Link>
        </div>

        {/* Manager view of tasks */}
        <ManagerTasks
          tasks={tasks}
          onEditTask={handleEditTask}
          currentUserEmpId={currentUserEmpId}
          onLogout={handleLogout}
          projectNames={projectNames}
        />
      </div>
    </div>
  );
}
