"use client";

import { useState } from "react";
import TaskEditModal from "@/components/tasks/TaskEditModal";

export default function TaskCard({ task, formatDate, getPriorityColor, getStatusColor, onMarkComplete, canEdit = false, onEdit }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h4 className="text-base font-medium text-gray-900">
              {task.title || "Untitled Task"}
            </h4>
            {task.priority && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(
                  task.priority
                )}`}
              >
                {task.priority}
              </span>
            )}
            {task.status && (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                  task.status
                )}`}
              >
                {task.status.replace("_", " ")}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-gray-600 mb-2">{task.description}</p>
          )}
          <div className="flex items-center text-xs text-gray-500 space-x-4">
            <span>Due: {formatDate(task.due_date)}</span>
            {task.manager && (
              <span className="text-blue-600">
                • Assigned by: {task.manager.name} (ID: {task.manager.emp_id})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2 ml-4">
          {canEdit && (
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200"
            >
              Edit
            </button>
          )}
        {onMarkComplete && (
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => onMarkComplete(task.id)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200"
            >
              Mark Complete
            </button>
          </div>
        )}
        </div>
      </div>
      <TaskEditModal
        open={open}
        task={task}
        saving={saving}
        onClose={() => setOpen(false)}
        onSave={async (id, updates) => {
          if (!onEdit) return;
          setSaving(true);
          const result = await onEdit(id, updates);
          setSaving(false);
          if (result && result.success) {
            setOpen(false);
          }
        }}
      />
    </div>
  );
}


