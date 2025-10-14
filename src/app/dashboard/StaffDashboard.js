"use client";

import Link from "next/link";
import TaskCard from "@/components/tasks/TaskCard";

export default function StaffDashboard({
  userProfile,
  activeTasks = [],
  overdueTasks = [],
  projects = [],
  projectsLoading = false,
  projectsError = "",
  formatDate,
  getPriorityColor,
  getStatusColor,
  getProjectName,
  toggleTaskComplete,
  handleLogout,
  currentUserEmpId,
  onEditTask,
  memberNames = {},
  projectNames = {},
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">Task Management Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, {userProfile?.name}
              </span>
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

              {activeTasks.length === 0 ? (
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
                    <TaskCard
                      key={task.id}
                      task={task}
                      onTaskUpdate={onEditTask}
                      formatDate={formatDate}
                      getPriorityColor={getPriorityColor}
                      getStatusColor={getStatusColor}
                      getProjectName={getProjectName}
                      onMarkComplete={toggleTaskComplete}
                      canEdit={currentUserEmpId === task.owner_id || (task.collaborators && task.collaborators.includes(currentUserEmpId))}
                      isOwner={currentUserEmpId === task.owner_id}
                      isCollaborator={task.collaborators && task.collaborators.includes(currentUserEmpId)}
                      memberNames={memberNames}
                      projectNames={projectNames}
                    />
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
