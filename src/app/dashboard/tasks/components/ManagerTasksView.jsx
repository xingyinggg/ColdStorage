"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTasks } from "@/utils/hooks/useTasks";
import { useDepartmentTeams } from "@/utils/hooks/useDepartmentTeams";
import ManagerTasks from "./ManagerTasks";
import { useAuth } from "@/utils/hooks/useAuth";

export default function ManagerTasksView({ currentUserEmpId, onLogout, showHeader = true, projectNames = {} }) {
  const [activeTab, setActiveTab] = useState("my-tasks");
  const router = useRouter();
  const { user, signOut } = useAuth();

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
            {/* Tab Navigation - Mobile first design */}
            <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-hide">
              {["my-tasks", "team-workload"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-3 sm:px-1 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 transition-colors ${
                    activeTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab === "my-tasks" ? "My Tasks" : "Team Workload"}
                </button>
              ))}
            </nav>

            {/*  Create Task Button */}
            <div className="flex-shrink-0 w-full sm:w-auto">
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
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "my-tasks" && (
            <MyTasksTab
              tasks={myPersonalTasks}
              currentUserEmpId={currentUserEmpId}
              loading={tasksLoading}
              onEditTask={updateTask}
              projectNames={projectNames}
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
    </div>
  );
}

//  Tasks Tab
function MyTasksTab({ tasks = [], currentUserEmpId, loading, onEditTask, projectNames = {}, onLogout }) {
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Loading your tasks...</span>
        </div>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
          <p className="text-gray-500 mb-4">You don't have any tasks assigned yet.</p>
          <Link
            href="/dashboard/tasks/create"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Task
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ManagerTasks
      tasks={tasks}
      onEditTask={onEditTask}
      currentUserEmpId={currentUserEmpId}
      projectNames={projectNames}
    />
  );
}

// ✅ FIX: Team Workload Tab - Fully responsive
function TeamWorkloadTab({ departmentTeams = [], teamWorkload = {}, loading, error }) {
  if (loading) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-500">Loading team workload...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-600 font-medium">Error loading workload data:</span>
        </div>
        <p className="text-red-600 mt-1 text-sm">{error}</p>
      </div>
    );
  }

  const workloadEntries = Object.entries(teamWorkload);
  
  if (workloadEntries.length === 0) {
    return (
      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 11a3 3 0 110-6 3 3 0 010 6zM6 11a3 3 0 110-6 3 3 0 010 6z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
          <p className="text-gray-500">Your team workload data will appear here once available.</p>
        </div>
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
        <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Teams Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {departmentTeams.map((team) => (
              <div key={team.id} className="p-3 bg-gray-50 rounded-lg border">
                <p className="text-sm">
                  <span className="font-medium text-gray-900">Team:</span>
                  <span className="ml-2 text-gray-700">{team.team_name}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🎯 RESPONSIVE: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 11a3 3 0 110-6 3 3 0 010 6zM6 11a3 3 0 110-6 3 3 0 010 6z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">Team Members</p>
              <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-900">Total Tasks</p>
              <p className="text-2xl font-bold text-green-600">{totalTasks}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-900">Due Soon</p>
              <p className="text-2xl font-bold text-yellow-600">{totalDueSoon}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-900">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{totalOverdue}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 RESPONSIVE: Team Members Workload */}
      <div className="bg-white shadow-sm rounded-lg p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 sm:mb-6">Team Members Workload</h3>
        
        <div className="space-y-3 sm:space-y-4">
          {workloadEntries.map(([empId, memberData]) => {
            const member = memberData.member_info;
            const workloadLevel = getWorkloadLevel(memberData.total_tasks);
            
            return (
              <div key={empId} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {member?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {member?.name || `Employee ${empId}`}
                      </h4>
                      <p className="text-xs text-gray-500 truncate">
                        {member?.department || 'Unknown'} • {member?.role || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                      workloadLevel === 'high' ? 'bg-red-100 text-red-800' :
                      workloadLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {workloadLevel.toUpperCase()} LOAD
                    </span>
                  </div>
                </div>

                {/* 🎯 RESPONSIVE: Task Statistics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-xs">Total Tasks</div>
                    <div className="font-semibold text-gray-900">{memberData.total_tasks}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-xs">Owned</div>
                    <div className="font-semibold text-gray-900">{memberData.owned_tasks.length}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-xs">Collaborating</div>
                    <div className="font-semibold text-gray-900">{memberData.collaboration_tasks.length}</div>
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="text-gray-500 text-xs">Due Soon</div>
                    <div className="font-semibold text-yellow-600">{memberData.due_soon_count}</div>
                  </div>
                </div>

                {/* Overdue Tasks Alert */}
                {memberData.overdue_count > 0 && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <svg className="w-4 h-4 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-red-700 font-medium text-sm">
                        {memberData.overdue_count} overdue task{memberData.overdue_count > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* 🎯 RESPONSIVE: Task Status Breakdown */}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
                  <span className="whitespace-nowrap">
                    Under Review: <span className="font-medium text-gray-900">{memberData.task_status_breakdown['under review'] || 0}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    Ongoing: <span className="font-medium text-gray-900">{memberData.task_status_breakdown.ongoing || 0}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    Completed: <span className="font-medium text-gray-900">{memberData.task_status_breakdown.completed || 0}</span>
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