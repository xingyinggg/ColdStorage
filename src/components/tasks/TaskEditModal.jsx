"use client";

import { useState, useEffect } from "react";

export default function TaskEditModal({ open, task, onClose, onSave, saving = false, errorMessage = "", successMessage = "" }) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "unassigned",
    due_date: "",
  });
  const [file, setFile] = useState(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        priority: (task.priority || "medium").toLowerCase(),
        status: task.status || "pending",
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      });
      setFile(null);
      setRemoveExistingFile(false);
    }
  }, [task]);

  const handleSave = () => {
    if (!onSave) return;
    console.log("Editing task ID:", task.id);

    // Create FormData to handle file upload
    const formData = new FormData();
    
    // Add form fields (only add non-empty values)
    if (form.title && form.title.trim()) {
      formData.append("title", form.title.trim());
    }
    if (form.description) {
      formData.append("description", form.description);
    }
    if (form.priority) {
      formData.append("priority", form.priority);
    }
    if (form.status) {
      formData.append("status", form.status);
    }
    if (form.due_date) {
      formData.append("due_date", form.due_date);
    }

    // Handle file operations
    if (file && file instanceof File) {
      formData.append("file", file);
    }

    if (removeExistingFile) {
      formData.append("remove_file", "true");
    }

    // Debug: log what we're sending
    console.log("Sending form data:");
    for (let [key, value] of formData.entries()) {
      console.log(key, value);
    }

    // Call onSave with FormData instead of form object
    onSave(task.id, formData);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Task</h3>

        {errorMessage && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
            {successMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="unassigned">Unassigned</option>
                <option value="ongoing">Ongoing</option>
                <option value="under_review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachment (PDF)
            </label>
            
            {/* Show existing file if present */}
            {task?.file && !removeExistingFile && (
              <div className="mb-2 p-2 bg-gray-50 rounded border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-700">Current file attached</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRemoveExistingFile(true)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
            
            {/* File input */}
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setRemoveExistingFile(false); // Reset remove flag when new file is selected
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              PDF files only, max 10MB
            </p>
            
            {/* Show selected file name */}
            {file && (
              <div className="mt-2 text-sm text-green-600">
                New file selected: {file.name}
              </div>
            )}
            
            {removeExistingFile && (
              <div className="mt-2 text-sm text-red-600">
                Current file will be removed
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}