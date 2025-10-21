// app/dashboard/ManagerDashboard.js
"use client";

import { useManagerTasks } from "@/utils/hooks/useManagerTasks";
import { useManagerProjects } from "@/utils/hooks/useManagerProjects";
import TaskCard from "@/components/tasks/TaskCard";
import HeaderBar from "@/components/layout/HeaderBar";

export default function ManagerDashboard({ user, userProfile, onLogout }) {
  
  const {
    allTasks,
    allProjects,
    staffMembers,
    loading,
    updateTaskAssignment,
    getTasksByStatus,
    getOverdueTasks
  } = useManagerTasks();

  // Keep useManagerProjects for potential future use
  const {} = useManagerProjects();

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
      case "ongoing":
        return "bg-blue-100 text-blue-800";
      case "under review":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getProjectName = (projectId) => {
    const project = allProjects?.find((p) => p.id === projectId);
    return project?.title || `ID: ${projectId}`;
  };

  const buildEditHandler = (task) => (id, updates) =>
    updateTaskAssignment(id, task.collaborators || [], updates);

  const buildCompleteHandler = (task) => (id) =>
    updateTaskAssignment(id, task.collaborators || [], { status: 'completed' });

  const activeTasks = getTasksByStatus('ongoing') || [];
  const overdueTasks = getOverdueTasks() || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading manager dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        title="Manager Dashboard"
        user={user}
        userProfile={userProfile}
        roleLabel={userProfile?.role || 'Manager'}
        roleColor="blue"
        onLogout={onLogout}
      />

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div>
            {/* Stats Overview */}
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
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {staffMembers.length}
                        </span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Staff Members
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {staffMembers.length} people
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
                      <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg font-bold">+</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Quick Actions
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          <a
                            href="/dashboard/tasks/create"
                            className="text-green-600 hover:text-green-800"
                          >
                            New Task
                          </a>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Tasks */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Recent Tasks Overview
                </h3>
                {allTasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No tasks found</div>
                ) : (
                  <div className="space-y-4">
                    {allTasks.slice(0, 5).map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        formatDate={formatDate}
                        getPriorityColor={getPriorityColor}
                        getStatusColor={getStatusColor}
                        getProjectName={getProjectName}
                        canEdit={userProfile?.emp_id === task.owner_id || (task.collaborators && task.collaborators.includes(userProfile?.emp_id))}
                        isOwner={userProfile?.emp_id === task.owner_id}
                        isCollaborator={task.collaborators && task.collaborators.includes(userProfile?.emp_id)}
                        onEdit={buildEditHandler(task)}
                        onMarkComplete={buildCompleteHandler(task)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}