"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import TaskCard from "@/components/tasks/TaskCard";
import Toast from "@/components/ui/Toast";
import StaffTasksView from "./StaffTasksView";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";

export default function DirectorTasksView({ onLogout, showHeader = true }) {
  const { user, userProfile } = useAuth();
  const {
    tasks = [],
    toggleTaskComplete,
    updateTask,
  } = useTasks(user);

  // Early return if userProfile is not loaded yet
  if (!userProfile) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <div className="text-lg">Loading user profile...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div>
          <StaffTasksView
            tasks={tasks}
            onLogout={onLogout}
            onEditTask={updateTask}
            showHeader={false}
          />
          <AllTasksSection
            tasks={tasks}
            onMarkComplete={toggleTaskComplete}
            currentUserEmpId={userProfile?.emp_id}
            onEditTask={updateTask}
          />
        </div>
      </div>
    </div>
  );
}

// AllTasksSection component moved here from page.js for consistency
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
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          All Tasks
        </h3>
        <Link
          href="/dashboard/tasks/create"
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Task</span>
        </Link>
      </div>
      {tasks.length === 0 ? (
        <div className="text-gray-500">No tasks found</div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            // Calculate ownership and collaboration status
            const isOwner =
              task.owner_id &&
              currentUserEmpId &&
              String(currentUserEmpId) === String(task.owner_id);
            const isCollaborator =
              task.collaborators &&
              Array.isArray(task.collaborators) &&
              task.collaborators.includes(String(currentUserEmpId));

            const canEdit =
              task.owner_id &&
              currentUserEmpId &&
              (isOwner || isCollaborator);

            return (
              <TaskCard
                key={task.id}
                task={task}
                formatDate={formatDate}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                onMarkComplete={onMarkComplete}
                canEdit={canEdit}
                isOwner={isOwner}
                isCollaborator={isCollaborator}
                onTaskUpdate={async (id, updates) => {
                  try {
                    console.log("Updating task:", id, updates);

                    const result = await onEditTask(id, updates);

                    if (result && result.success) {
                      setFeedback({
                        type: "success",
                        message: "Task updated successfully.",
                      });
                    } else {
                      setFeedback({
                        type: "error",
                        message:
                          (result && result.error) ||
                          "Failed to update task.",
                      });
                    }

                    console.log("Task update result:", result);
                    return result;
                  } catch (error) {
                    console.error("Error updating task:", error);
                    setFeedback({
                      type: "error",
                      message: error?.message || "Failed to update task.",
                    });
                    return {
                      success: false,
                      error: error?.message || "Failed to update task",
                    };
                  }
                }}
                // Also provide onEdit for backward compatibility
                onEdit={async (id, updates) => {
                  try {
                    console.log("Editing task:", id, updates);
                    const result = await onEditTask(id, updates);
                    setFeedback({
                      type: "success",
                      message: "Task updated successfully.",
                    });
                    return { success: true, data: result };
                  } catch (error) {
                    console.error("Error updating task:", error);
                    setFeedback({
                      type: "error",
                      message: error?.message || "Failed to update task.",
                    });
                    return {
                      success: false,
                      error: error?.message || "Failed to update task",
                    };
                  }
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
  );
}