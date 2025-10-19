"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/utils/hooks/useAuth";
import { useTasks } from "@/utils/hooks/useTasks";

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

export default function HrTasksView({ tasks = [], onLogout }) {
  const { user, userProfile } = useAuth();
  const [hrStaff, setHrStaff] = useState([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo",
    collaborators: [],
    due_date: ""
  });
  const { createTask } = useTasks();

  // Fetch HR staff members
  useEffect(() => {
    const fetchHrStaff = async () => {
      try {
        const response = await fetch("/api/hr/staff", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setHrStaff(data.hrStaff || []);
        }
      } catch (error) {
        console.error("Error fetching HR staff:", error);
      }
    };

    fetchHrStaff();
  }, []);

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

  const grouped = statusOrder.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {});

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title) return;

    try {
      await createTask({
        ...newTask,
        owner_id: userProfile.emp_id,
      });
      
      setNewTask({
        title: "",
        description: "",
        status: "todo",
        collaborators: [],
        due_date: ""
      });
      setIsAddingTask(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">HR Tasks</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingTask(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add HR Task
          </button>
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

      {isAddingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Create HR Task</h2>
            <form onSubmit={handleAddTask}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                  rows={3}
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Collaborators (HR Staff Only)
                </label>
                <select
                  multiple
                  value={newTask.collaborators}
                  onChange={(e) => setNewTask({
                    ...newTask, 
                    collaborators: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  {hrStaff.map(staff => (
                    <option key={staff.emp_id} value={staff.emp_id}>
                      {staff.name || staff.emp_id}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddingTask(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {statusOrder.map((status) => (
          <div key={status} className="flex-1">
            <div
              className={`p-3 rounded-t-lg ${statusColors[status]} border-b border-gray-300`}
            >
              <h3 className="font-medium">
                {statusLabels[status]} ({grouped[status]?.length || 0})
              </h3>
            </div>
            <div className="bg-white rounded-b-lg shadow min-h-[200px]">
              {grouped[status]?.map((task) => (
                <div
                  key={task.id}
                  className="p-3 border-b border-gray-100 hover:bg-gray-50"
                >
                  <div className="font-medium">{task.title}</div>
                  {task.description && (
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {task.description}
                    </div>
                  )}
                  {task.due_date && (
                    <div className="text-xs text-gray-500 mt-1">
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                  {task.collaborators && task.collaborators.length > 0 && (
                    <div className="flex mt-2">
                      {task.collaborators.map((collab, idx) => (
                        <div
                          key={idx}
                          className="bg-blue-100 text-blue-800 text-xs rounded-full px-2 py-1 mr-1"
                        >
                          {typeof collab === 'object' ? collab.name : 
                           hrStaff.find(s => s.emp_id === collab)?.name || collab}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(!grouped[status] || grouped[status].length === 0) && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No tasks in this status
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}