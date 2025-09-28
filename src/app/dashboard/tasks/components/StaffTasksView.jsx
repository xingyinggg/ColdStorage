"use client";

import Link from "next/link";

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
                <div key={task.id} className="bg-white border rounded-lg p-3 shadow-sm">
                  <div className="font-medium">{task.title}</div>
                  <div className="text-sm text-gray-500">{task.description}</div>
                  {task.due_date && (
                    <div className="text-xs text-gray-400">
                      Due: {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                  {task.priority && (
                    <span
                      className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs ${
                        task.priority === "High"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "Medium"
                          ? "bg-orange-100 text-orange-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


