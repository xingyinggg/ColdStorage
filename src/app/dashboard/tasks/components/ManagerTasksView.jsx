"use client";

import { useState } from "react";
import Link from "next/link";
import TaskCard from "@/components/tasks/TaskCard";
import { useTasks } from "@/utils/hooks/useTasks";
import { useAuth } from "@/utils/hooks/useAuth";
import { useDepartmentTeams } from "@/utils/hooks/useDepartmentTeams";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";
import ManagerTasks from "./ManagerTasks";

export default function ManagerTasksView({ currentUserEmpId, onLogout, showHeader = true }) {
  const [activeTab, setActiveTab] = useState("my-tasks");
  const { user } = useAuth();

  // Personal tasks (same as staff)
  const {
    tasks: myTasks = [],
    loading: tasksLoading,
    updateTask,
  } = useTasks(user);

  // Department workload data
  const {
    departmentTeams = [],
    teamWorkload = {},
    loading: workloadLoading,
    error: workloadError,
  } = useDepartmentTeams();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  // Filter personal tasks (owned or collaborating)
  const myPersonalTasks = myTasks.filter(task => {
    const isOwner = task.owner_id && String(task.owner_id) === String(currentUserEmpId);
    
    let isCollaborator = false;
    if (task.collaborators && currentUserEmpId) {
      if (Array.isArray(task.collaborators)) {
        isCollaborator = task.collaborators.includes(String(currentUserEmpId));
      }
    }
    
    return isOwner || isCollaborator;
  });

  return (
    <div className="max-w-7xl mx-auto py-2 sm:py-6 px-2 sm:px-6 lg:px-8">
      <div className="px-2 py-3 sm:px-4">
        {/* 🎯 RESPONSIVE: Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            {/* Tab Navigation - Scrollable on mobile */}
            <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              {["my-tasks", "team-workload"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab === "my-tasks" ? "My Tasks" : "Team Workload"}
                </button>
              ))}
            </nav>

            {/* 🎯 RESPONSIVE: Create Task Button */}
            <div className="flex items-center justify-center sm:justify-end">
              <Link
                href="/dashboard/tasks/create"
                className="w-full sm:w-auto bg-green-600 text-white px-4 py-2.5 sm:px-4 sm:py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="whitespace-nowrap">Create Task</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "my-tasks" && (
          <MyTasksTab
            tasks={myPersonalTasks}
            currentUserEmpId={currentUserEmpId}
            loading={tasksLoading}
            onEditTask={updateTask}
            onLogout={handleLogout}
          />
        )}

        {activeTab === "team-workload" && (
          <TeamWorkloadTab
            departmentTeams={departmentTeams}
            teamWorkload={teamWorkload}
            loading={workloadLoading}
            error={workloadError}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

// My Tasks Tab - Simple list view (no status columns)
function MyTasksTab({ tasks = [], currentUserEmpId, loading, onEditTask }) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="text-center text-gray-500">Loading your tasks...</div>
      </div>
    );
  }

  return (
    <ManagerTasks
      tasks={tasks}
      onEditTask={onEditTask}
      currentUserEmpId={currentUserEmpId}
    />
  );
}

// Team Workload Tab - Using department_teams.js data
function TeamWorkloadTab({ departmentTeams = [], teamWorkload = {}, loading, error }) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <div className="text-center text-gray-500">Loading team workload...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6">
        <div className="text-red-600">Error loading workload data: {error}</div>
      </div>
    );
  }

  const workloadEntries = Object.entries(teamWorkload);
  
  if (workloadEntries.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Team Workload</h3>
        <p className="text-gray-500 text-center py-8">No team members found</p>
      </div>
    );
  }

  // Calculate summary stats
  const totalMembers = workloadEntries.length;
  const totalTasks = workloadEntries.reduce((sum, [_, member]) => sum + member.total_tasks, 0);
  const totalOverdue = workloadEntries.reduce((sum, [_, member]) => sum + member.overdue_count, 0);
  const totalDueSoon = workloadEntries.reduce((sum, [_, member]) => sum + member.due_soon_count, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 🎯 RESPONSIVE: Teams Overview */}
      {departmentTeams.length > 0 && (
        <div className="bg-white shadow rounded-lg p-4 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Teams Overview</h3>
          <div className="space-y-3">
            {departmentTeams.map((team) => (
              <div key={team.id} className="py-2 border-b border-gray-100 last:border-b-0">
                <p className="text-sm break-words">
                  <span className="font-medium text-gray-900">Team Name:</span> {team.team_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🎯 RESPONSIVE: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
          <h4 className="font-medium text-green-900 text-sm sm:text-base">Total Tasks</h4>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{totalTasks}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
          <h4 className="font-medium text-yellow-900 text-sm sm:text-base">Due Soon (in 3 days)</h4>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{totalDueSoon}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
          <h4 className="font-medium text-red-900 text-sm sm:text-base">Overdue</h4>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{totalOverdue}</p>
        </div>
      </div>

      {/* 🎯 RESPONSIVE: Team Members Workload */}
      <div className="bg-white shadow rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4 sm:mb-6">Team Members Workload</h3>
        
        <div className="space-y-3 sm:space-y-4">
          {workloadEntries.map(([empId, memberData]) => {
            const member = memberData.member_info;
            const workloadLevel = getWorkloadLevel(memberData.total_tasks);
            
            return (
              <div key={empId} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm sm:text-base">
                          {member?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {member?.name || `Employee ${empId}`}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {member?.department || 'Unknown'} • {member?.role || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center sm:justify-end">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      workloadLevel === 'high' ? 'bg-red-100 text-red-800' :
                      workloadLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {workloadLevel.toUpperCase()} LOAD
                    </span>
                  </div>
                </div>

                {/* 🎯 RESPONSIVE: Task Statistics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500">Total Tasks</div>
                    <div className="font-medium">{memberData.total_tasks}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500">Owned</div>
                    <div className="font-medium">{memberData.owned_tasks.length}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500">Collaborating</div>
                    <div className="font-medium">{memberData.collaboration_tasks.length}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500">Due Soon</div>
                    <div className="font-medium text-yellow-600">{memberData.due_soon_count}</div>
                  </div>
                </div>

                {/* Overdue Tasks Alert */}
                {memberData.overdue_count > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs sm:text-sm">
                    <span className="text-red-600 font-medium">
                      ⚠️ {memberData.overdue_count} overdue task{memberData.overdue_count > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* 🎯 RESPONSIVE: Task Status Breakdown */}
                <div className="mt-3 flex flex-wrap gap-2 sm:gap-4 text-xs justify-center sm:justify-start">
                  <span className="text-gray-600 whitespace-nowrap">
                    Under Review: <span className="font-medium">{memberData.task_status_breakdown['under review']}</span>
                  </span>
                  <span className="text-gray-600 whitespace-nowrap">
                    Ongoing: <span className="font-medium">{memberData.task_status_breakdown.ongoing}</span>
                  </span>
                  <span className="text-gray-600 whitespace-nowrap">
                    Completed: <span className="font-medium">{memberData.task_status_breakdown.completed}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Helper function to determine workload level
function getWorkloadLevel(taskCount) {
  if (taskCount >= 15) return 'high';
  if (taskCount >= 8) return 'medium';
  return 'low';
}