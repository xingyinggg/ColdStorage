"use client";

import Link from "next/link";
import TaskCard from "@/components/tasks/TaskCard";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";
import { useAuth } from "@/utils/hooks/useAuth";

const statusOrder = ["unassigned", "todo", "in_progress", "done"];
const statusLabels = {
  unassigned: "Unassigned",
  todo: "To-do",
  in_progress: "In Progress",
  done: "Done",
};
const statusColors = {
  unassigned: "bg-gray-50",
  todo: "bg-yellow-50",
  in_progress: "bg-blue-50",
  done: "bg-green-50",
};

export default function StaffTasksView({ tasks = [], onLogout }) {
  const { user, userProfile } = useAuth();

  // Debug user profile
  console.log('🔍 User Profile Debug:', {
    userProfile,
    empId: userProfile?.emp_id,
    empIdType: typeof userProfile?.emp_id
  });

  const grouped = statusOrder.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {});

  // Debug tasks
  console.log('🔍 Tasks Debug:', {
    totalTasks: tasks.length,
    firstTask: tasks[0],
    firstTaskKeys: tasks[0] ? Object.keys(tasks[0]) : [],
    allTasksCollaborators: tasks.map(t => ({ id: t.id, title: t.title, collaborators: t.collaborators, owner_id: t.owner_id })),
    grouped
  });

  return (
    <div className="p-6">
      {console.log('🔍 RENDERING StaffTasksView, total tasks:', tasks.length)}
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
          console.log('🔍 RENDERING STATUS COLUMN:', status, 'Tasks count:', grouped[status]?.length);
          
          return (
            <div
              key={status}
              className={`flex-1 rounded-lg shadow p-4 ${statusColors[status]}`}
            >
              <div className="flex items-center mb-2">
                <span
                  className={`w-3 h-3 rounded-full mr-2 ${
                    status === "todo"
                      ? "bg-yellow-400"
                      : status === "in_progress"
                      ? "bg-blue-400"
                      : status === "done"
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
                  console.log('🔍 MAPPING TASK:', task.id, task.title, 'Status:', status);
                console.log('🔍 Processing task:', task.id, task.title);
                
                const isOwner = task.owner_id && userProfile?.emp_id && String(userProfile.emp_id) === String(task.owner_id);
                
                // More robust collaborator detection - handle both array and object formats
                let isCollaborator = false;
                if (task.collaborators) {
                  console.log('🔍 COLLABORATOR CHECK for task', task.id, ':', {
                    collaborators: task.collaborators,
                    collaboratorsType: typeof task.collaborators,
                    isArray: Array.isArray(task.collaborators),
                    userEmpId: userProfile?.emp_id
                  });
                  
                  if (Array.isArray(task.collaborators)) {
                    // Standard array format
                    isCollaborator = task.collaborators.includes(String(userProfile.emp_id));
                    console.log('🔍 Array check result:', isCollaborator);
                  } else if (typeof task.collaborators === 'object' && task.collaborators !== null) {
                    // Object format - convert to array
                    const collabArray = Object.values(task.collaborators);
                    isCollaborator = collabArray.includes(String(userProfile.emp_id));
                    console.log('🔍 Object check result:', isCollaborator, 'collabArray:', collabArray);
                  }
                } else {
                  console.log('🔍 No collaborators field for task', task.id);
                }
                
                const canEdit = task.owner_id && userProfile?.emp_id && (isOwner || isCollaborator);

                console.log('🔍 FINAL CALCULATION for task', task.id, ':', {
                  isOwner,
                  isCollaborator,
                  canEdit
                });

                // Debug logging for each task
                console.log('🔍 Task Calculation Debug for task', task.id, ':', {
                  taskTitle: task.title,
                  userProfileEmpId: userProfile?.emp_id,
                  userProfileEmpIdString: String(userProfile?.emp_id),
                  taskOwnerId: task.owner_id,
                  taskOwnerIdString: String(task.owner_id),
                  collaborators: task.collaborators,
                  collaboratorsType: typeof task.collaborators,
                  collaboratorsIsArray: Array.isArray(task.collaborators),
                  collaboratorsIncludes: task.collaborators?.includes?.(String(userProfile?.emp_id)),
                  isOwner,
                  isCollaborator,
                  canEdit
                });

                // Debug the exact values being passed as props
                console.log('🔍 StaffTasksView - About to pass props to TaskCard for task', task.id, ':', {
                  taskTitle: task.title,
                  userEmpId: userProfile?.emp_id,
                  taskOwnerId: task.owner_id,
                  taskCollaborators: task.collaborators,
                  calculatedIsOwner: isOwner,
                  calculatedIsCollaborator: isCollaborator,
                  calculatedCanEdit: canEdit,
                  propsBeingPassed: { isOwner, isCollaborator, canEdit },
                  expectedModalBehavior: isCollaborator && !isOwner ? 'LIMITED (status only)' : 'FULL (all fields)'
                });

                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canEdit={canEdit}
                    isOwner={isOwner}
                    isCollaborator={isCollaborator}
                    formatDate={formatDate}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
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


