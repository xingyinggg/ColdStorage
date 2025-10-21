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
    priority: 5,
    status: "ongoing",
    collaborators: [],
    assignTo: "",
    dueDate: "",
    ...initialData
  });

  // Subtasks state - only for main tasks
  const [subtasks, setSubtasks] = useState([]);

  // Recurrence state - only for main tasks
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceData, setRecurrenceData] = useState({
    pattern: "weekly",
    interval: 1,
    endType: "date", // "date" or "count"
    endDate: "",
    count: "",
    weekday: new Date().getDay() // 0 = Sunday, 1 = Monday, etc.
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Prepare submission data
    const submissionData = {
      ...formData,
      ...(isSubtask ? {} : { subtasks })
    };

    // Add recurrence data if recurring is enabled (only for main tasks)
    if (!isSubtask && isRecurring) {
      submissionData.is_recurring = true;
      submissionData.recurrence_pattern = recurrenceData.pattern;
      submissionData.recurrence_interval = parseInt(recurrenceData.interval);
      
      // Add weekday for weekly tasks
      if (recurrenceData.pattern === "weekly" || recurrenceData.pattern === "biweekly") {
        submissionData.recurrence_weekday = parseInt(recurrenceData.weekday);
      }
      
      if (recurrenceData.endType === "date" && recurrenceData.endDate) {
        submissionData.recurrence_end_date = recurrenceData.endDate;
      } else if (recurrenceData.endType === "count" && recurrenceData.count) {
        submissionData.recurrence_count = parseInt(recurrenceData.count);
      }
    }

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
            Priority Level (1-10)
          </label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value, 10) }))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
              <option key={level} value={level}>
                {level} {level === 1 ? '(Least Important)' : level === 10 ? '(Most Important)' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            1 = Least important, 10 = Most important
          </p>
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

      {/* Recurring Task Settings (only for main tasks) */}
      {!isSubtask && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          {/* Recurring Toggle */}
          <div className="flex items-center space-x-3 mb-4">
            <input
              type="checkbox"
              id="recurring-toggle"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="recurring-toggle" className="text-sm font-medium text-gray-700 flex items-center">
              <span className="mr-2">🔄</span>
              Make this a recurring task
            </label>
          </div>

          {/* Recurrence Options (shown when enabled) */}
          {isRecurring && (
            <div className="space-y-4 pl-7 border-l-2 border-blue-200">
              {/* Pattern and Interval */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Repeat Pattern
                  </label>
                  <select
                    value={recurrenceData.pattern}
                    onChange={(e) => setRecurrenceData(prev => ({ ...prev, pattern: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Interval
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Every</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={recurrenceData.interval}
                      onChange={(e) => setRecurrenceData(prev => ({ ...prev, interval: e.target.value }))}
                      className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">
                      {recurrenceData.pattern === "daily" ? "day(s)" :
                       recurrenceData.pattern === "weekly" ? "week(s)" :
                       recurrenceData.pattern === "biweekly" ? "period(s)" :
                       recurrenceData.pattern === "monthly" ? "month(s)" :
                       recurrenceData.pattern === "quarterly" ? "quarter(s)" : "year(s)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekday Selector (only for weekly/biweekly) */}
              {(recurrenceData.pattern === "weekly" || recurrenceData.pattern === "biweekly") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day of Week
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {[
                      { value: 0, label: 'Sun', full: 'Sunday' },
                      { value: 1, label: 'Mon', full: 'Monday' },
                      { value: 2, label: 'Tue', full: 'Tuesday' },
                      { value: 3, label: 'Wed', full: 'Wednesday' },
                      { value: 4, label: 'Thu', full: 'Thursday' },
                      { value: 5, label: 'Fri', full: 'Friday' },
                      { value: 6, label: 'Sat', full: 'Saturday' }
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => setRecurrenceData(prev => ({ ...prev, weekday: day.value }))}
                        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          recurrenceData.weekday === day.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                        title={day.full}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Task will repeat every {recurrenceData.pattern === "weekly" ? "week" : "two weeks"} on{' '}
                    <strong>
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceData.weekday]}
                    </strong>
                  </p>
                </div>
              )}

              {/* End Condition Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Condition
                </label>
                <div className="space-y-3">
                  {/* End by Date */}
                  <label className="flex items-start space-x-3">
                    <input
                      type="radio"
                      name="endType"
                      value="date"
                      checked={recurrenceData.endType === "date"}
                      onChange={(e) => setRecurrenceData(prev => ({ ...prev, endType: e.target.value }))}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-gray-700 mb-1">End by date</div>
                      <input
                        type="date"
                        value={recurrenceData.endDate}
                        onChange={(e) => setRecurrenceData(prev => ({ ...prev, endDate: e.target.value, endType: "date" }))}
                        min={formData.dueDate || new Date().toISOString().split("T")[0]}
                        disabled={recurrenceData.endType !== "date"}
                        className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>

                  {/* End after Count */}
                  <label className="flex items-start space-x-3">
                    <input
                      type="radio"
                      name="endType"
                      value="count"
                      checked={recurrenceData.endType === "count"}
                      onChange={(e) => setRecurrenceData(prev => ({ ...prev, endType: e.target.value }))}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-gray-700 mb-1">End after number of occurrences</div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={recurrenceData.count}
                          onChange={(e) => setRecurrenceData(prev => ({ ...prev, count: e.target.value, endType: "count" }))}
                          disabled={recurrenceData.endType !== "count"}
                          placeholder="e.g., 10"
                          className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <span className="text-sm text-gray-600">occurrences</span>
                      </div>
                    </div>
                  </label>

                  {/* Never End */}
                  <label className="flex items-start space-x-3">
                    <input
                      type="radio"
                      name="endType"
                      value="never"
                      checked={recurrenceData.endType === "never"}
                      onChange={(e) => setRecurrenceData(prev => ({ ...prev, endType: e.target.value, endDate: "", count: "" }))}
                      className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">Never end</div>
                      <div className="text-xs text-gray-500 mt-1">Task will repeat indefinitely</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Recurrence Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mt-4">
                <div className="text-xs font-medium text-blue-800 mb-1">📅 Recurrence Summary</div>
                <div className="text-sm text-blue-700">
                  This task will repeat <strong>every {recurrenceData.interval} {
                    recurrenceData.pattern === "daily" ? `day${recurrenceData.interval > 1 ? 's' : ''}` :
                    recurrenceData.pattern === "weekly" ? `week${recurrenceData.interval > 1 ? 's' : ''}` :
                    recurrenceData.pattern === "biweekly" ? `biweekly period${recurrenceData.interval > 1 ? 's' : ''}` :
                    recurrenceData.pattern === "monthly" ? `month${recurrenceData.interval > 1 ? 's' : ''}` :
                    recurrenceData.pattern === "quarterly" ? `quarter${recurrenceData.interval > 1 ? 's' : ''}` :
                    `year${recurrenceData.interval > 1 ? 's' : ''}`
                  }</strong>
                  {(recurrenceData.pattern === "weekly" || recurrenceData.pattern === "biweekly") && (
                    <> on <strong>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][recurrenceData.weekday]}</strong></>
                  )}
                  {recurrenceData.endType === "date" && recurrenceData.endDate && (
                    <> until <strong>{new Date(recurrenceData.endDate).toLocaleDateString()}</strong></>
                  )}
                  {recurrenceData.endType === "count" && recurrenceData.count && (
                    <> for <strong>{recurrenceData.count} occurrences</strong></>
                  )}
                  {recurrenceData.endType === "never" && (
                    <> <strong>indefinitely</strong></>
                  )}
                  .
                </div>
                {formData.dueDate && (
                  <div className="text-xs text-blue-600 mt-2">
                    First occurrence: <strong>{new Date(formData.dueDate).toLocaleDateString()}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
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