"use client";

import { useState, useEffect } from "react";
import { useSubtasks } from "@/utils/hooks/useSubtasks";

export default function TaskEditModal({ 
  open, 
  task, 
  onClose, 
  onSave, 
  saving = false, 
  errorMessage = "", 
  successMessage = "",
  isOwner = false,
  isCollaborator = false,
  canAssignTasks = false
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: 5,
    status: "ongoing",
    due_date: "",
  });
  const [file, setFile] = useState(null);
  const [removeExistingFile, setRemoveExistingFile] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [editSuccess, setEditSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const { subtasks, loading: loadingSubtasks, error: subtasksError, fetchSubtasks, createSubtask, updateSubtask, deleteSubtask } = useSubtasks();
  const [newSubtask, setNewSubtask] = useState({
    title: "",
    description: "",
    priority: 5,
    status: "ongoing",
    due_date: ""
  });
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingValues, setEditingValues] = useState({ title: "", description: "", priority: 5, status: "ongoing", due_date: "" });
  const [savingSubtaskId, setSavingSubtaskId] = useState(null);

  const beginEditSubtask = (st) => {
    setEditingSubtaskId(st.id);
    setEditingValues({
      title: st.title || "",
      description: st.description || "",
      priority: st.priority ?? 5,
      status: st.status || "ongoing",
      due_date: st.due_date ? st.due_date.slice(0, 10) : "",
    });
  };

  const cancelEditSubtask = () => {
    setEditingSubtaskId(null);
    setSavingSubtaskId(null);
  };
  
  const closeEditModal = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleEditFieldChange = (field, value) => {
    setEditingValues((prev) => ({ ...prev, [field]: value }));
  };

  const saveEditSubtask = async (subtaskId) => {
    if (!subtaskId) return;
    try {
      setSavingSubtaskId(subtaskId);
      
      // For collaborators, only allow status updates
      let updates;
      if (isCollaborator && !isOwner) {
        updates = {
          status: editingValues.status,
        };
      } else {
        // Full edit permissions for owners
        updates = {
          title: editingValues.title,
          description: editingValues.description,
          priority: editingValues.priority,
          status: editingValues.status,
          due_date: editingValues.due_date || null,
        };
      }
      
      await updateSubtask(subtaskId, updates);
      setEditingSubtaskId(null);
    } finally {
      setSavingSubtaskId(null);
    }
  };

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || "",
        description: task.description || "",
        priority: task.priority !== null && task.priority !== undefined ? task.priority : 5,
        status: task.status || "ongoing",
        due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      });
      setFile(null);
      setRemoveExistingFile(false);
      setValidationErrors({}); // Clear validation errors when task changes
      // Load subtasks for this task
      if (task.id) {
        fetchSubtasks(task.id);
      }
    }
  }, [task]);

  const validateForm = () => {
    const errors = {};

    // Check required fields - only title and status are required
    if (!form.title || !form.title.trim()) {
      errors.title = "Title is required";
    }

    if (!form.status) {
      errors.status = "Status is required";
    }

    // Optional validation: If priority is provided, validate range
    if (form.priority !== null && form.priority !== undefined && (form.priority < 1 || form.priority > 10)) {
      errors.priority = "Priority must be between 1 and 10";
    }

    return errors;
  };

  const handleSave = async () => {
    if (!onSave) {
      console.error("TaskEditModal: No onSave function provided");
      return;
    }

    // Validate form before saving
    const errors = validateForm();
    setValidationErrors(errors);

    // If there are validation errors, don't proceed with save
    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      // For collaborators, only allow status updates
      if (isCollaborator && !isOwner) {
        console.log("Collaborator updating task status to:", form.status);
        const updates = { status: form.status };
        
        try {
          const result = await onSave(task.id, updates);
          console.log("Collaborator update result:", result);
          
          // Show success message and close modal
          setEditSuccess("Task status updated successfully!");
          setTimeout(() => {
            closeEditModal();
            setEditSuccess("");
          }, 1000);
          
          return;
        } catch (error) {
          console.error("Collaborator status update failed:", error);
          setEditError(error.message || "Failed to update task status");
          return;
        }
      }

      // Full edit permissions for owners
      // Create FormData to handle file upload
      const formData = new FormData();
      
      // Add form fields (only add non-empty values)
      if (form.title && form.title.trim()) {
        formData.append("title", form.title.trim());
      }
      if (form.description !== undefined) {
        formData.append("description", form.description);
      }
      // Always append priority if it's a valid number
      if (form.priority !== null && form.priority !== undefined) {
        formData.append("priority", form.priority.toString());
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

      // Call onSave with FormData instead of form object and await the result
      await onSave(task.id, formData);
    } catch (error) {
      console.error("Error in handleSave:", error);
    }
  };

  // Clear validation error when user starts typing
  const handleInputChange = (field, value) => {
    setForm({ ...form, [field]: value });
    
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors({ ...validationErrors, [field]: "" });
    }
  };

  const handleNewSubtaskChange = (field, value) => {
    setNewSubtask({ ...newSubtask, [field]: value });
  };

  const handleCreateSubtask = async () => {
    if (!task?.id) return;
    if (!newSubtask.title || !newSubtask.title.trim()) return;
    try {
      setCreatingSubtask(true);
      const payload = {
        parent_task_id: task.id,
        title: newSubtask.title.trim(),
        description: newSubtask.description || null,
        priority: newSubtask.priority,
        status: newSubtask.status,
        due_date: newSubtask.due_date || null,
        collaborators: [],
      };
      const res = await createSubtask(payload);
      if (res?.success) {
        setNewSubtask({ title: "", description: "", priority: 5, status: "ongoing", due_date: "" });
      }
    } finally {
      setCreatingSubtask(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-lg shadow-lg p-6 z-60 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {isCollaborator && !isOwner ? "Update Task Status" : "Edit Task"}
        </h3>

        {isCollaborator && !isOwner && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded text-sm">
            <strong>Collaborator Mode:</strong> You can only update the task status.
          </div>
        )}

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
        {editSuccess && (
          <div className="mb-3 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
            {editSuccess}
          </div>
        )}
        {editError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {editError}
          </div>
        )}

        {/* Show validation errors summary */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            <p className="font-medium">Please fix the following errors:</p>
            <ul className="mt-1 list-disc list-inside">
              {Object.values(validationErrors).filter(error => error).map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4">
          {/* Show all fields but disable editing for collaborators (except status) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              disabled={isCollaborator && !isOwner}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isCollaborator && !isOwner ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
              } ${
                validationErrors.title ? "border-red-300 bg-red-50" : "border-gray-300"
              }`}
            />
            {validationErrors.title && (
              <p className="mt-1 text-xs text-red-600">{validationErrors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              disabled={isCollaborator && !isOwner}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isCollaborator && !isOwner ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
              }`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority Level
              </label>
              <select
                value={form.priority}
                onChange={(e) => handleInputChange("priority", parseInt(e.target.value, 10))}
                disabled={isCollaborator && !isOwner}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isCollaborator && !isOwner ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
                } ${
                  validationErrors.priority ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                  <option key={level} value={level}>
                    {level} {level === 1 ? '(Low)' : level === 10 ? '(High)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">1 = Low, 10 = High (Optional)</p>
              {validationErrors.priority && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.priority}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                value={form.status}
                onChange={(e) => handleInputChange("status", e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validationErrors.status ? "border-red-300 bg-red-50" : "border-gray-300"
                }`}
              >
                <option value="">Select status...</option>
                {canAssignTasks && <option value="unassigned">Unassigned</option>}
                <option value="ongoing">Ongoing</option>
                <option value="under review">Under Review</option>
                <option value="completed">Completed</option>
              </select>
              {validationErrors.status && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.status}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                disabled={isCollaborator && !isOwner}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isCollaborator && !isOwner ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''
                }`}
              />
            </div>
          </div>

          {/* File Upload Section - Only editable for owners */}
          {!(isCollaborator && !isOwner) && (
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
          )}

          {/* Show file info for collaborators (read-only) */}
          {(isCollaborator && !isOwner) && task?.file && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachment
              </label>
              <div className="mb-2 p-2 bg-gray-50 rounded border">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-gray-700">File attached (view only)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Subtasks Management */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">Subtasks</label>
            {isCollaborator && !isOwner && (
              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                You can only edit subtask status
              </span>
            )}
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              {loadingSubtasks ? (
                <p className="text-sm text-gray-500">Loading subtasks...</p>
              ) : subtasksError ? (
                <p className="text-sm text-red-600">{subtasksError}</p>
              ) : subtasks.length === 0 ? (
                <p className="text-sm text-gray-500">No subtasks yet</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {subtasks.map((st) => (
                    <li key={st.id} className="py-2 flex items-start justify-between">
                      <div className="min-w-0 pr-3 w-full">
                        {editingSubtaskId === st.id ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {/* Subtask Title - disabled for collaborators */}
                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Title</label>
                              <input
                                type="text"
                                value={editingValues.title}
                                onChange={(e) => handleEditFieldChange("title", e.target.value)}
                                disabled={isCollaborator && !isOwner}
                                className={`w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                                  isCollaborator && !isOwner 
                                    ? 'bg-gray-100 cursor-not-allowed text-gray-600' 
                                    : ''
                                }`}
                              />
                            </div>
                            {/* Subtask Priority - disabled for collaborators */}
                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Priority</label>
                              <select
                                value={editingValues.priority}
                                onChange={(e) => handleEditFieldChange("priority", parseInt(e.target.value, 10))}
                                disabled={isCollaborator && !isOwner}
                                className={`w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                                  isCollaborator && !isOwner 
                                    ? 'bg-gray-100 cursor-not-allowed text-gray-600' 
                                    : ''
                                }`}
                              >
                                {[1,2,3,4,5,6,7,8,9,10].map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                            {/* Subtask Description - disabled for collaborators */}
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Description</label>
                              <textarea
                                rows={2}
                                value={editingValues.description}
                                onChange={(e) => handleEditFieldChange("description", e.target.value)}
                                disabled={isCollaborator && !isOwner}
                                className={`w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                                  isCollaborator && !isOwner 
                                    ? 'bg-gray-100 cursor-not-allowed text-gray-600' 
                                    : ''
                                }`}
                              />
                            </div>
                            {/* Subtask Status - always enabled for collaborators */}
                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Status</label>
                              <select
                                value={editingValues.status}
                                onChange={(e) => handleEditFieldChange("status", e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                              >
                                <option value="ongoing">Ongoing</option>
                                <option value="under review">Under Review</option>
                                <option value="completed">Completed</option>
                              </select>
                            </div>
                            {/* Subtask Due Date - disabled for collaborators */}
                            <div>
                              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Due Date</label>
                              <input
                                type="date"
                                value={editingValues.due_date}
                                onChange={(e) => handleEditFieldChange("due_date", e.target.value)}
                                disabled={isCollaborator && !isOwner}
                                className={`w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                                  isCollaborator && !isOwner 
                                    ? 'bg-gray-100 cursor-not-allowed text-gray-600' 
                                    : ''
                                }`}
                              />
                            </div>
                            <div className="md:col-span-2 flex gap-2 mt-1">
                              <button
                                type="button"
                                onClick={() => saveEditSubtask(st.id)}
                                disabled={savingSubtaskId === st.id || (!isOwner && !editingValues.title.trim())}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-xs"
                              >
                                {savingSubtaskId === st.id ? "Saving..." : (isCollaborator && !isOwner ? "Update Status" : "Save")}
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditSubtask}
                                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-900 truncate">{st.title}</p>
                            {st.description && (
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{st.description}</p>
                            )}
                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                              {st.priority !== null && st.priority !== undefined && (
                                <span>Priority: {st.priority}</span>
                              )}
                              {st.status && (
                                <span>Status: {st.status}</span>
                              )}
                              {st.due_date && (
                                <span>Due: {st.due_date?.slice(0,10)}</span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-1 items-end">
                        {editingSubtaskId !== st.id && (isOwner || isCollaborator) && (
                          <button
                            type="button"
                            onClick={() => beginEditSubtask(st)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                            title={isCollaborator && !isOwner ? "Edit subtask status" : "Edit subtask"}
                          >
                            Edit
                          </button>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => deleteSubtask(st.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                            title="Delete subtask"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Add new subtask - owners only */}
            {isOwner && (
              <div className="bg-white border border-gray-200 rounded-md p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={newSubtask.title}
                    onChange={(e) => handleNewSubtaskChange("title", e.target.value)}
                    data-testid="new-subtask-title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Subtask title"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newSubtask.priority}
                    onChange={(e) => handleNewSubtaskChange("priority", parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[1,2,3,4,5,6,7,8,9,10].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={newSubtask.description}
                    onChange={(e) => handleNewSubtaskChange("description", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newSubtask.due_date}
                    onChange={(e) => handleNewSubtaskChange("due_date", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleCreateSubtask}
                    disabled={creatingSubtask || !newSubtask.title.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
                  >
                    {creatingSubtask ? "Adding..." : "Add Subtask"}
                  </button>
                </div>
              </div>
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
            {saving ? "Saving..." : (isCollaborator && !isOwner ? "Update Status" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}