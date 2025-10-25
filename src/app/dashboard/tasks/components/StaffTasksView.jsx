"use client";

import Link from "next/link";
import TaskCard from "@/components/tasks/TaskCard";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";
import { useAuth } from "@/utils/hooks/useAuth";

const statusOrder = ["ongoing", "under review", "completed"];
const statusLabels = {
  ongoing: "Ongoing",
  "under review": "Under Review",
  completed: "Completed",
};
const statusColors = {
  ongoing: "bg-blue-50",
  "under review": "bg-yellow-50",
  completed: "bg-green-50",
};

export default function StaffTasksView({ tasks = [], onLogout, onEditTask }) {
  const { user, userProfile } = useAuth();

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

  // Group tasks by status
  const grouped = statusOrder.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status?.toLowerCase() === status.toLowerCase());
    return acc;
  }, {});

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Tasks</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
          >
            Back to Dashboard
          </Link>
          <button
            onClick={onLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {statusOrder.map((status) => {
          return (
            <div
              key={status}
              className={`flex-1 rounded-lg shadow p-4 ${statusColors[status]}`}
            >
              <div className="flex items-center mb-2">
                <span
                  className={`w-3 h-3 rounded-full mr-2 ${
                    status === "ongoing"
                      ? "bg-blue-400"
                      : status === "under review"
                      ? "bg-yellow-400"
                      : status === "completed"
                      ? "bg-green-400"
                      : "bg-gray-400"
                  }`}
                />
                <span className="font-semibold">
                  {statusLabels[status]}{" "}
                  <span className="bg-white rounded-full px-2 py-0.5 text-xs ml-1 border">
                    {grouped[status]?.length || 0}
                  </span>
                </span>
              </div>
              <div className="space-y-3">
                {grouped[status]?.map((task) => {
                  const isOwner = task.owner_id && userProfile?.emp_id && String(userProfile.emp_id) === String(task.owner_id);

                  // More robust collaborator detection - handle both array and object formats
                  let isCollaborator = false;
                  if (task.collaborators && userProfile?.emp_id) {
                    if (Array.isArray(task.collaborators)) {
                      // Standard array format
                      isCollaborator = task.collaborators.includes(String(userProfile.emp_id));
                    } else if (typeof task.collaborators === 'object' && task.collaborators !== null) {
                      // Object format - convert to array
                      const collabArray = Object.values(task.collaborators);
                      isCollaborator = collabArray.includes(String(userProfile.emp_id));
                    }
                  }

                  const canEdit = task.owner_id && userProfile?.emp_id && (isOwner || isCollaborator);

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      canEdit={canEdit && typeof onEditTask === 'function'}
                      isOwner={isOwner}
                      isCollaborator={isCollaborator}
                      formatDate={formatDate}
                      getPriorityColor={getPriorityColor}
                      getStatusColor={getStatusColor}
                      onTaskUpdate={onEditTask}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


