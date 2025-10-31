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

// Updated color scheme to match your project columns
const statusColors = {
  ongoing: "bg-yellow-50",        // Changed from bg-blue-50 to bg-yellow-50
  "under review": "bg-blue-50",   // Changed from bg-yellow-50 to bg-blue-50
  completed: "bg-green-50",       // Stays the same
};

// Updated dot colors to match
const dotColors = {
  ongoing: "bg-yellow-400",       // Changed from bg-blue-400 to bg-yellow-400
  "under review": "bg-blue-400",  // Changed from bg-yellow-400 to bg-blue-400
  completed: "bg-green-400",      // Stays the same
};

const handleLogout = async () => {
  await signOut();
  router.push("/login");
};


export default function StaffTasksView({ tasks = [], onLogout, onEditTask, showHeader = true }) {
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
<div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
  {/* Responsive grid layout */}
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {statusOrder.map((status) => (
      <div
        key={status}
        className={`rounded-lg shadow p-4 ${statusColors[status]} overflow-x-auto`}
      >
        <div className="flex items-center mb-2">
          <span className={`w-3 h-3 rounded-full mr-2 ${dotColors[status]}`} />
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
            let isCollaborator = false;
            if (task.collaborators && userProfile?.emp_id) {
              if (Array.isArray(task.collaborators)) {
                isCollaborator = task.collaborators.includes(String(userProfile.emp_id));
              } else if (typeof task.collaborators === "object" && task.collaborators !== null) {
                const collabArray = Object.values(task.collaborators);
                isCollaborator = collabArray.includes(String(userProfile.emp_id));
              }
            }
            const canEdit = task.owner_id && userProfile?.emp_id && (isOwner || isCollaborator);
            return (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={canEdit && typeof onEditTask === "function"}
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
    ))}
  </div>
</div>

  );
}