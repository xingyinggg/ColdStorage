"use client";

import { useState } from "react";

export default function SubtaskManager({ 
  subtasks = [], 
  onSubtasksChange, 
  availableCollaborators = [],
  selectedProject = null 
}) {
  const [showForm, setShowForm] = useState(false);
  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    description: "",
    priority: 5,
    status: "ongoing",
    collaborators: [],
    dueDate: ""
  });

  const addSubtask = () => {
    if (!subtaskForm.title.trim()) return;

    const newSubtask = {
      id: Date.now(), // Temporary ID
      ...subtaskForm
    };
    onSubtasksChange([...subtasks, newSubtask]);
    
    // Reset form
    setSubtaskForm({
      title: "",
      description: "",
      priority: 5,
      status: "ongoing",
      collaborators: [],
      dueDate: ""
    });
    setShowForm(false);
  };

  const removeSubtask = (id) => {
    onSubtasksChange(subtasks.filter(subtask => subtask.id !== id));
  };

  const handleCollaboratorToggle = (empId) => {
    setSubtaskForm(prev => ({
      ...prev,
      collaborators: prev.collaborators.includes(empId)
        ? prev.collaborators.filter(id => id !== empId)
        : [...prev.collaborators, empId]
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="border-t pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Subtasks</h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {subtasks.length} subtask{subtasks.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
          >
            + Add Subtask
          </button>
        </div>
      </div>

      {/* Existing Subtasks */}
      {subtasks.length > 0 && (
        <div className="space-y-3 mb-4">
          {subtasks.map((subtask, index) => (
            <div key={subtask.id} className="bg-gray-50 p-3 rounded-md border">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{subtask.title}</h4>
                  {subtask.description && (
                    <p className="text-xs text-gray-600 mt-1">{subtask.description}</p>
                  )}
                  <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                    <span className="capitalize">Priority: {subtask.priority}</span>
                    <span className="capitalize">{subtask.status}</span>
                    {subtask.dueDate && (
                      <span className="text-orange-600">Due: {formatDate(subtask.dueDate)}</span>
                    )}
                    {subtask.collaborators.length > 0 && (
                      <span>{subtask.collaborators.length} collaborator{subtask.collaborators.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSubtask(subtask.id)}
                  className="text-red-400 hover:text-red-600 text-sm ml-2"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Subtask Form - NOT a form element, just a div */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h4 className="text-md font-medium mb-4">Add New Subtask</h4>
          
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Subtask Title
              </label>
              <input
                type="text"
                value={subtaskForm.title}
                onChange={(e) => setSubtaskForm(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Subtask title"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                value={subtaskForm.description}
                onChange={(e) => setSubtaskForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Optional details"
              />
            </div>

            {/* Priority, Status, and Due Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priority Level (1-10)
                </label>
                <select
                  value={subtaskForm.priority}
                  onChange={(e) => setSubtaskForm(prev => ({ ...prev, priority: parseInt(e.target.value, 10) }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                    <option key={level} value={level}>
                      {level} {level === 1 ? '(Low)' : level === 10 ? '(High)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={subtaskForm.status}
                  onChange={(e) => setSubtaskForm(prev => ({ ...prev, status: e.target.value }))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="under review">Under Review</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Due Date
                </label>
                <input
                  type="date"
                  value={subtaskForm.dueDate}
                  onChange={(e) => setSubtaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            {/* Collaborators */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collaborators
              </label>
              <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-3">
                {availableCollaborators.length > 0 ? (
                  availableCollaborators.map((person) => (
                    <label key={person.emp_id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={subtaskForm.collaborators.includes(person.emp_id)}
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

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setSubtaskForm({
                    title: "",
                    description: "",
                    priority: 5,
                    status: "ongoing",
                    collaborators: [],
                    dueDate: ""
                  });
                }}
                className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addSubtask}
                disabled={!subtaskForm.title.trim()}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Add Subtask
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {subtasks.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <p className="text-sm">No subtasks added yet</p>
          <p className="text-xs mt-1">Break down this task into smaller, manageable pieces</p>
        </div>
      )}
    </div>
  );
}