"use client";

import { useState } from "react";
import SubtaskManager from "./SubtaskManager";

export default function TaskForm({ 
  initialData = {}, 
  onSubmit, 
  onCancel, 
  isSubtask = false,
  availableCollaborators = [],
  canAssignTasks = false,
  availableStaff = [],
  loading = false,
  error = null,
  selectedProject = null,
  projects = [],
  loadingProjects = false,
  loadingMembers = false,
  onProjectChange = () => {},
  file = null,
  onFileChange = () => {}
}) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: isSubtask ? "ongoing" : (canAssignTasks ? "unassigned" : "ongoing"),
    collaborators: [],
    assignTo: "",
    dueDate: "",
    ...initialData
  });

  // Subtasks state - only for main tasks
  const [subtasks, setSubtasks] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Include subtasks in the submission data for main tasks
    const submissionData = {
      ...formData,
      ...(isSubtask ? {} : { subtasks })
    };
    onSubmit(submissionData);
  };

  const handleCollaboratorToggle = (empId) => {
    setFormData(prev => ({
      ...prev,
      collaborators: prev.collaborators.includes(empId)
        ? prev.collaborators.filter(id => id !== empId)
        : [...prev.collaborators, empId]
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          {isSubtask ? "Subtask Title" : "Title"}
        </label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          required
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder={isSubtask ? "Subtask title" : "e.g. Prepare weekly report"}
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={isSubtask ? 2 : 4}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder={isSubtask ? "Optional details" : "Optional details about the task"}
        />
      </div>

      {/* Assignment (only for main tasks and if user can assign) */}
      {!isSubtask && canAssignTasks && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assign Task To
          </label>
          <select
            value={formData.assignTo}
            onChange={(e) => setFormData(prev => ({ ...prev, assignTo: e.target.value }))}
            className="w-full border border-gray-300 rounded-md px-3 py-2"
            disabled={loading}
          >
            <option value="">Assign to myself</option>
            {availableStaff.map((staff) => (
              <option key={staff.emp_id} value={staff.emp_id}>
                {staff.name} ({staff.role}) - {staff.department || 'No department'}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Leave empty to assign to yourself
          </p>
        </div>
      )}

      {/* Priority and Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            <option value="ongoing">Ongoing</option>
            <option value="under review">Under Review</option>
            <option value="completed">Completed</option>
            {!isSubtask && canAssignTasks && <option value="unassigned">Unassigned</option>}
          </select>
        </div>
      </div>

      {/* Due Date and File Upload (only for main tasks) */}
      {!isSubtask && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Due date
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              min={new Date().toISOString().split("T")[0]}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Attachment (PDF)
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => onFileChange(e.target.files[0] || null)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              PDF files only, max 10MB
            </p>
          </div>
        </div>
      )}

      {/* Project and Collaborators (only for main tasks) */}
      {!isSubtask && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              value={selectedProject}
              onChange={(e) => onProjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={loading || loadingProjects}
            >
              {loadingProjects ? (
                <option value="">Loading projects...</option>
              ) : projects.length === 0 ? (
                <option value="">No projects available</option>
              ) : (
                <>
                  <option value="">Select a project (optional)</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </>
              )}
            </select>
            {projects.length === 0 && !loadingProjects && (
              <p className="mt-1 text-xs text-gray-500">
                You are not part of any projects yet.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collaborators</label>
            {selectedProject ? (
              loadingMembers ? (
                <div className="text-gray-500">Loading project members...</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {availableCollaborators.length > 0 ? (
                    availableCollaborators.map((member) => (
                      <label key={member.emp_id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.collaborators.includes(member.emp_id)}
                          onChange={() => handleCollaboratorToggle(member.emp_id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{member.name} ({member.email})</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No other project members</p>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                {availableCollaborators.length > 0 ? (
                  availableCollaborators.map((staff) => (
                    <label key={staff.emp_id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={formData.collaborators.includes(staff.emp_id)}
                        onChange={() => handleCollaboratorToggle(staff.emp_id)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{staff.name} ({staff.role}) - {staff.email}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No users available</p>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {selectedProject ? "Select from project team members" : "Select from all staff members"}
            </p>
          </div>
        </div>
      )}

      {/* Collaborators only (for subtasks) */}
      {isSubtask && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collaborators
          </label>
          <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
            {availableCollaborators.length > 0 ? (
              availableCollaborators.map((person) => (
                <label key={person.emp_id} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.collaborators.includes(person.emp_id)}
                    onChange={() => handleCollaboratorToggle(person.emp_id)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">
                    {person.name} ({person.email})
                  </span>
                </label>
              ))
            ) : (
              <p className="text-sm text-gray-500">No collaborators available</p>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {selectedProject ? "From project team" : "From all staff"}
          </p>
        </div>
      )}

      {/* Subtasks Manager (only for main tasks) */}
      {!isSubtask && (
        <SubtaskManager
          subtasks={subtasks}
          onSubtasksChange={setSubtasks}
          availableCollaborators={availableCollaborators}
          selectedProject={selectedProject}
        />
      )}

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : (isSubtask ? "Add Subtask" : "Create Task")}
        </button>
      </div>
    </form>
  );
}