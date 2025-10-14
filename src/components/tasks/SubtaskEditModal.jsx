"use client";

import { useEffect, useState } from "react";

export default function SubtaskEditModal({ 
  open, 
  subtask, 
  onClose, 
  onSave, 
  saving = false,
  isOwner = false,
  isCollaborator = false 
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: 5,
    status: "ongoing",
    due_date: "",
  });

  useEffect(() => {
    if (subtask) {
      setForm({
        title: subtask.title || "",
        description: subtask.description || "",
        priority: subtask.priority ?? 5,
        status: subtask.status || "ongoing",
        due_date: subtask.due_date ? subtask.due_date.slice(0, 10) : "",
      });
    }
  }, [subtask]);

  if (!open || !subtask) return null;

  // Determine what the user can edit
  // Collaborators can only edit status
  // Owners can edit everything
  const canEditAllFields = isOwner;
  const canEditStatus = isOwner || isCollaborator;

  const handleChange = (field, value) => {
    // Prevent changes to fields that shouldn't be editable
    if (field !== 'status' && !canEditAllFields) {
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    
    // For collaborators, only send status updates
    let updates;
    if (isCollaborator && !isOwner) {
      updates = {
        status: form.status,
      };
    } else {
      // For owners, send all updates
      updates = {
        title: form.title.trim(),
        description: form.description,
        priority: form.priority,
        status: form.status,
        due_date: form.due_date || null,
      };
    }
    onSave?.(subtask.id, updates);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Subtask</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
              disabled={!canEditAllFields}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !canEditAllFields ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              placeholder="Subtask title"
            />
            {!canEditAllFields && (
              <p className="text-xs text-gray-500 mt-1">Only task owners can edit the title</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              disabled={!canEditAllFields}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                !canEditAllFields ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
            {!canEditAllFields && (
              <p className="text-xs text-gray-500 mt-1">Only task owners can edit the description</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => handleChange("priority", parseInt(e.target.value, 10))}
                disabled={!canEditAllFields}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !canEditAllFields ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              >
                {[1,2,3,4,5,6,7,8,9,10].map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              {!canEditAllFields && (
                <p className="text-xs text-gray-500 mt-1">Owner only</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                disabled={!canEditStatus}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !canEditStatus ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              >
                <option value="ongoing">Ongoing</option>
                <option value="under review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
              {isCollaborator && !isOwner && (
                <p className="text-xs text-green-600 mt-1">You can edit this field</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => handleChange("due_date", e.target.value)}
                disabled={!canEditAllFields}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  !canEditAllFields ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              />
              {!canEditAllFields && (
                <p className="text-xs text-gray-500 mt-1">Owner only</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}


