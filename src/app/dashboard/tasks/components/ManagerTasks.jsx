"use client";

import TaskCard from "@/components/tasks/TaskCard";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";
import { useAuth } from "@/utils/hooks/useAuth";

const statusOrder = ["unassigned", "ongoing", "under review", "completed"];
const statusLabels = {
  unassigned: "Unassigned",
  ongoing: "Ongoing",
  "under review": "Under Review",
  completed: "Completed",
};

const statusColors = {
  unassigned: "bg-gray-50",
  ongoing: "bg-yellow-50",
  "under review": "bg-blue-50",
  completed: "bg-green-50",
};

const dotColors = {
  unassigned: "bg-gray-500",
  ongoing: "bg-yellow-400",
  "under review": "bg-blue-400",
  completed: "bg-green-400",
};

export default function StaffTasksView({
  tasks = [],
  onLogout,
  onEditTask,
  showHeader = true,
}) {
  const { user, userProfile } = useAuth();

  if (!userProfile) {
    return (
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="text-center text-gray-500">Loading user profile...</div>
      </div>
    );
  }

  const grouped = statusOrder.reduce((acc, status) => {
    acc[status] = tasks.filter(
      (t) => t.status?.toLowerCase() === status.toLowerCase()
    );
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto">

      {/* 📱 Responsive Task Columns */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statusOrder.map((status) => (
          <div
            key={status}
            className={`rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 ${statusColors[status]} flex flex-col h-full`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center">
                <span className={`w-3 h-3 rounded-full mr-2 ${dotColors[status]}`} />
                <span className="font-semibold text-gray-800 text-sm sm:text-base">
                  {statusLabels[status]}
                </span>
              </div>
              <span className="bg-white rounded-full px-2 py-0.5 text-xs border text-gray-600">
                {grouped[status]?.length || 0}
              </span>
            </div>

            {/* Scrollable Task List (for smaller screens) */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[60vh] sm:max-h-[70vh] pr-1">
              {grouped[status]?.length === 0 ? (
                <p className="text-xs text-gray-500 italic text-center py-2">
                  {/* No tasks */}
                </p>
              ) : (
                grouped[status].map((task) => {
                  const isOwner =
                    task.owner_id &&
                    userProfile?.emp_id &&
                    String(userProfile.emp_id) === String(task.owner_id);

                  let isCollaborator = false;
                  if (task.collaborators && userProfile?.emp_id) {
                    if (Array.isArray(task.collaborators)) {
                      isCollaborator = task.collaborators.includes(
                        String(userProfile.emp_id)
                      );
                    } else if (
                      typeof task.collaborators === "object" &&
                      task.collaborators !== null
                    ) {
                      const collabArray = Object.values(task.collaborators);
                      isCollaborator = collabArray.includes(
                        String(userProfile.emp_id)
                      );
                    }
                  }

                  const canEdit =
                    task.owner_id &&
                    userProfile?.emp_id &&
                    (isOwner || isCollaborator);
                  console.log('asfsaf', task);
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
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
