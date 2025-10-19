"use client";

import { useState } from "react";
import TaskCard from "@/components/tasks/TaskCard";
import { useTasks } from "@/utils/hooks/useTasks";
import { useDepartmentTeams } from "@/utils/hooks/useDepartmentTeams";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";

export default function ManagerTasksView({ currentUserEmpId, tasks: expressTasks }) {
  const [activeTab, setActiveTab] = useState("my-tasks");

  // Personal tasks (same as staff)
  const {
    tasks: myTasks = [],
    loading: tasksLoading,
    updateTask,
  } = useTasks();

  // Department workload data
  const {
    departmentTeams = [],
    teamWorkload = {},
    loading: workloadLoading,
    error: workloadError,
  } = useDepartmentTeams();

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
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {["my-tasks", "team-workload"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab === "my-tasks" ? "My Tasks" : "Team Workload"}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "my-tasks" && (
        <MyTasksTab
          tasks={myPersonalTasks}
          currentUserEmpId={currentUserEmpId}
          loading={tasksLoading}
          onEditTask={updateTask}
        />
      )}

      {activeTab === "team-workload" && (
        <TeamWorkloadTab
          departmentTeams={departmentTeams}
          teamWorkload={teamWorkload}
          loading={workloadLoading}
          error={workloadError}
        />
      )}
    </div>
  );
}

// My Tasks Tab - Simple list view (no status columns)
function MyTasksTab({ tasks = [], currentUserEmpId, loading, onEditTask }) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-gray-500">Loading your tasks...</div>
      </div>
    );
  }

  // Group tasks by status for better organization
  const activeTasks = tasks.filter(task => 
    task.status !== 'completed' && task.status !== 'done'
  );
  const completedTasks = tasks.filter(task => 
    task.status === 'completed' || task.status === 'done'
  );

  return (
    <div className="space-y-6">
      {/* Active Tasks */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Active Tasks ({activeTasks.length})
        </h3>
        
        {activeTasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No active tasks</p>
        ) : (
          <div className="space-y-3">
            {activeTasks.map((task) => {
              const isOwner = task.owner_id && String(task.owner_id) === String(currentUserEmpId);
              const isCollaborator = task.collaborators && 
                Array.isArray(task.collaborators) &&
                task.collaborators.includes(String(currentUserEmpId));

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={isOwner || isCollaborator}
                  isOwner={isOwner}
                  isCollaborator={isCollaborator}
                  formatDate={formatDate}
                  getPriorityColor={getPriorityColor}
                  getStatusColor={getStatusColor}
                  onEdit={(id, updates) => onEditTask(id, updates)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="bg-gray-50 shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-700 mb-4">
            Completed Tasks ({completedTasks.length})
          </h3>
          <div className="space-y-3">
            {completedTasks.slice(0, 5).map((task) => {
              const isOwner = task.owner_id && String(task.owner_id) === String(currentUserEmpId);
              const isCollaborator = task.collaborators && 
                Array.isArray(task.collaborators) &&
                task.collaborators.includes(String(currentUserEmpId));

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  canEdit={false} // Don't allow editing completed tasks
                  isOwner={isOwner}
                  isCollaborator={isCollaborator}
                  formatDate={formatDate}
                  getPriorityColor={getPriorityColor}
                  getStatusColor={getStatusColor}
                />
              );
            })}
            {completedTasks.length > 5 && (
              <p className="text-sm text-gray-500 text-center">
                ... and {completedTasks.length - 5} more completed tasks
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Team Workload Tab - Using department_teams.js data
function TeamWorkloadTab({ departmentTeams = [], teamWorkload = {}, loading, error }) {
  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center text-gray-500">Loading team workload...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="text-red-600">Error loading workload data: {error}</div>
      </div>
    );
  }

  const workloadEntries = Object.entries(teamWorkload);
  
  if (workloadEntries.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
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
    <div className="space-y-6">

      {/* Teams Overview */}
      {departmentTeams.length > 0 && (
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Teams Overview</h3>
        <div className="space-y-3">
          {departmentTeams.map((team) => (
            <div key={team.id} className="py-2 border-b border-gray-100 last:border-b-0">
              <p className="text-sm">
                <span className="font-medium text-gray-900">Team Name:</span> {team.team_name}
              </p>
            </div>
          ))}
        </div>
      </div>
    )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-900">Total Tasks</h4>
          <p className="text-2xl font-bold text-green-600">{totalTasks}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900">Due Soon (in 3 days)</h4>
          <p className="text-2xl font-bold text-yellow-600">{totalDueSoon}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-medium text-red-900">Overdue</h4>
          <p className="text-2xl font-bold text-red-600">{totalOverdue}</p>
        </div>
      </div>

      {/* Team Members Workload */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-6">Team Members Workload</h3>
        
        <div className="space-y-4">
          {workloadEntries.map(([empId, memberData]) => {
            const member = memberData.member_info;
            const workloadLevel = getWorkloadLevel(memberData.total_tasks);
            
            return (
              <div key={empId} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {member?.name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900">
                        {member?.name || `Employee ${empId}`}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {member?.department || 'Unknown'} • {member?.role || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      workloadLevel === 'high' ? 'bg-red-100 text-red-800' :
                      workloadLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {workloadLevel.toUpperCase()} LOAD
                    </span>
                  </div>
                </div>

                {/* Task Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total Tasks:</span>
                    <span className="ml-1 font-medium">{memberData.total_tasks}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Owned:</span>
                    <span className="ml-1 font-medium">{memberData.owned_tasks.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Collaborating:</span>
                    <span className="ml-1 font-medium">{memberData.collaboration_tasks.length}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Due Soon (in 3 days) :</span>
                    <span className="ml-1 font-medium text-yellow-600">{memberData.due_soon_count}</span>
                  </div>
                </div>

                {/* Overdue Tasks Alert */}
                {memberData.overdue_count > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <span className="text-red-600 font-medium">
                      ⚠️ {memberData.overdue_count} overdue task{memberData.overdue_count > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Task Status Breakdown */}
                <div className="mt-3 flex space-x-4 text-xs">
                  <span className="text-gray-600">
                    Under Review: <span className="font-medium">{memberData.task_status_breakdown['under review']}</span>
                  </span>
                  <span className="text-gray-600">
                    Ongoing: <span className="font-medium">{memberData.task_status_breakdown.ongoing}</span>
                  </span>
                  <span className="text-gray-600">
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