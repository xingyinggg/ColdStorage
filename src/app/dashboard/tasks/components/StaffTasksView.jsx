"use client";

import Link from "next/link";
import TaskCard from "@/components/tasks/TaskCard";
import { formatDate, getPriorityColor, getStatusColor } from "./taskUtils";

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
  const grouped = statusOrder.reduce((acc, status) => {
    acc[status] = tasks.filter((t) => t.status === status);
    return acc;
  }, {});

  return (
    <div className="p-6">
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
        {statusOrder.map((status) => (
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
              {grouped[status]?.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  formatDate={formatDate}
                  getPriorityColor={getPriorityColor}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


