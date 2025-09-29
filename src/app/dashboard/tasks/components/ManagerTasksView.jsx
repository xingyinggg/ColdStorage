"use client";

import { useState } from "react";
import TaskCard from "@/components/tasks/TaskCard";
import { useManagerTasks } from "@/utils/hooks/useManagerTasks";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";

export default function ManagerTasksView({ currentUserEmpId, tasks: expressTasks }) {
  const [managerTab, setManagerTab] = useState("tasks");
  const {
    allTasks = [],
    allProjects = [],
    staffMembers = [],
    getTasksByStaff = () => [],
    updateTaskAssignment,
  } = useManagerTasks();

  const tasksForView = Array.isArray(expressTasks) ? expressTasks : allTasks;
  
  return (
    <div>
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          {["tasks", "staff"].map((tab) => (
            <button
              key={tab}
              onClick={() => setManagerTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                managerTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab === "tasks" ? "Tasks" : "Staff"}
            </button>
          ))}
        </nav>
      </div>

      {managerTab === "tasks" && (
        <ManagerAllTasksSection
          tasks={tasksForView}
          projects={allProjects}
          currentUserEmpId={currentUserEmpId}
          onEditTask={(id, collaborators, updates) =>
            updateTaskAssignment(id, collaborators, updates)
          }
        />
      )}

      {managerTab === "staff" && (
        <ManagerStaffTab
          staffMembers={staffMembers}
          getTasksByStaff={getTasksByStaff}
        />
      )}
    </div>
  );
}

function ManagerAllTasksSection({ tasks = [], projects = [], currentUserEmpId, onEditTask }) {
  const getProjectName = (projectId) => {
    const project = projects?.find((p) => p.id === projectId);
    return project?.title || `ID: ${projectId}`;
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          All Tasks ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No tasks found</div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                formatDate={formatDate}
                getPriorityColor={getPriorityColor}
                getStatusColor={getStatusColor}
                getProjectName={getProjectName}
                canEdit={currentUserEmpId === task.owner_id}
                onEdit={(id, updates) =>
                  onEditTask(id, task.collaborators || [], updates)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerStaffTab({ staffMembers = [], getTasksByStaff = () => [] }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        Staff Members ({staffMembers.length})
      </h3>
      {staffMembers.map((staff) => {
        const staffTasks = getTasksByStaff(staff.emp_id);
        return (
          <div key={staff.emp_id} className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-gray-900">{staff.name}</h4>
                  <p className="text-sm text-gray-500">
                    {staff.department} • {staffTasks.length} tasks
                  </p>
                </div>
              </div>
              {staffTasks.length === 0 ? (
                <p className="text-gray-500 text-sm">No tasks assigned</p>
              ) : (
                <div className="space-y-2">
                  {staffTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="border-l-4 border-blue-400 pl-3">
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-gray-500">
                        Due: {formatDate(task.due_date)}
                      </p>
                    </div>
                  ))}
                  {staffTasks.length > 3 && (
                    <p className="text-xs text-gray-500">
                      +{staffTasks.length - 3} more tasks
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


