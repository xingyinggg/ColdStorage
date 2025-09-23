// app/dashboard/ManagerDashboard.js
"use client";

import { useState } from "react";
import { useManagerTasks } from "@/utils/hooks/useManagerTasks";
import Link from "next/link";

export default function ManagerDashboard({ user, userProfile, onLogout }) {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  const {
    allTasks,
    allProjects,
    staffMembers,
    loading,
    error,
    assignTask,
    updateTaskAssignment,
    getTasksByStatus,
    getOverdueTasks,
    getTasksByStaff
  } = useManagerTasks();

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
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const activeTasks = getTasksByStatus('in_progress') || [];
  const completedTasks = getTasksByStatus('completed') || [];
  const overdueTasks = getOverdueTasks() || [];
  const pendingTasks = getTasksByStatus('pending') || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading manager dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">Manager Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {userProfile?.name || user?.email}</span>
              <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {userProfile?.role || 'Manager'}
              </span>
              <button
                onClick={onLogout}
                className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {['overview', 'all-tasks', 'staff', 'assign-task'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {selectedTab === 'overview' && (
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
                        <button
                          onClick={() => setSelectedTab('assign-task')}
                          className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center hover:bg-purple-600 transition-colors"
                        >
                          <span className="text-white text-lg font-bold">+</span>
                        </button>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">
                            Quick Actions
                          </dt>
                          <dd className="text-lg font-medium text-gray-900">
                            <button
                              onClick={() => setSelectedTab('assign-task')}
                              className="text-purple-600 hover:text-purple-800"
                            >
                              Assign Task
                            </button>
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
                    <div className="text-center py-8 text-gray-500">
                      No tasks found
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {allTasks.slice(0, 5).map((task) => (
                        <div
                          key={task.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <h4 className="text-base font-medium text-gray-900">
                                  {task.title || 'Untitled Task'}
                                </h4>
                                {task.priority && (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                  </span>
                                )}
                                {task.status && (
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                                    {task.status.replace('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-xs text-gray-500 space-x-4">
                                <span>Due: {formatDate(task.due_date)}</span>
                                <span>Created by: {task.task_owner?.name || `Manager (ID: ${task.owner_id})`}</span>
                                {task.collaborators && task.collaborators.length > 0 && (
                                  <span>Assigned to: {task.collaborators.length} staff member(s)</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'all-tasks' && (
            <AllTasksTab 
              tasks={allTasks} 
              formatDate={formatDate}
              getPriorityColor={getPriorityColor}
              getStatusColor={getStatusColor}
            />
          )}

          {selectedTab === 'staff' && (
            <StaffTab 
              staffMembers={staffMembers}
              getTasksByStaff={getTasksByStaff}
              formatDate={formatDate}
            />
          )}

          {selectedTab === 'assign-task' && (
            <AssignTaskTab 
              staffMembers={staffMembers}
              assignTask={assignTask}
              onSuccess={() => setSelectedTab('all-tasks')}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// All Tasks Tab Component
function AllTasksTab({ tasks, formatDate, getPriorityColor, getStatusColor }) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          All Tasks ({tasks.length})
        </h3>
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No tasks found
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-base font-medium text-gray-900">
                        {task.title || 'Untitled Task'}
                      </h4>
                      {task.priority && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                      {task.status && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center text-xs text-gray-500 space-x-4">
                      <span>Due: {formatDate(task.due_date)}</span>
                      <span>Created by: {task.task_owner?.name || `Manager (ID: ${task.owner_id})`}</span>
                      {task.collaborators && task.collaborators.length > 0 && (
                        <span>Assigned to: {task.collaborators.length} staff member(s)</span>
                      )}
                      <span>Created: {formatDate(task.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Staff Tab Component
function StaffTab({ staffMembers, getTasksByStaff, formatDate }) {
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
                      <p className="text-xs text-gray-500">Due: {formatDate(task.due_date)}</p>
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

// Assign Task Tab Component
function AssignTaskTab({ staffMembers, assignTask, onSuccess }) {
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    due_date: ''
  });
  const [selectedStaff, setSelectedStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedStaff.length === 0) {
      setError('Please select at least one staff member');
      return;
    }

    setLoading(true);
    setError('');

    const result = await assignTask(taskData, selectedStaff);
    
    if (result.success) {
      // Reset form
      setTaskData({
        title: '',
        description: '',
        priority: 'medium',
        status: 'pending',
        due_date: ''
      });
      setSelectedStaff([]);
      onSuccess();
    } else {
      setError(result.error || 'Failed to assign task');
    }
    
    setLoading(false);
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Assign New Task
        </h3>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              value={taskData.title}
              onChange={(e) => setTaskData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter task title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={taskData.description}
              onChange={(e) => setTaskData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={taskData.priority}
                onChange={(e) => setTaskData(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={taskData.status}
                onChange={(e) => setTaskData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={taskData.due_date}
                onChange={(e) => setTaskData(prev => ({ ...prev, due_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty for no due date"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign to Staff Members *
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {staffMembers.map((staff) => (
                <label key={staff.emp_id} className="flex items-center space-x-2 hover:bg-gray-50 p-1 rounded">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={selectedStaff.includes(staff.emp_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStaff([...selectedStaff, staff.emp_id]);
                      } else {
                        setSelectedStaff(selectedStaff.filter(id => id !== staff.emp_id));
                      }
                    }}
                  />
                  <span className="text-sm text-gray-700">
                    {staff.name} (ID: {staff.emp_id}, {staff.department})
                  </span>
                </label>
              ))}
            </div>
            {selectedStaff.length > 0 && (
              <div className="mt-2 text-sm text-gray-600">
                Selected: {selectedStaff.length} staff member{selectedStaff.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Task'}
            </button>
            <button
              type="button"
              onClick={() => {
                setTaskData({
                  title: '',
                  description: '',
                  priority: 'medium',
                  status: 'pending',
                  due_date: ''
                });
                setSelectedStaff('');
                setError('');
              }}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}