"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useSubtasks } from "@/utils/hooks/useSubtasks";
import RecurrenceHistoryModal from "./RecurrenceHistoryModal";

export default function TaskDetailsModal({ 
  open, 
  task, 
  onClose, 
  memberNames = {},
  projectNames = {} // Add this prop
}) {
  const [collaboratorNames, setCollaboratorNames] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [showRecurrenceHistory, setShowRecurrenceHistory] = useState(false);
  const { subtasks, loading: loadingSubtasks, error: subtasksError, fetchSubtasks } = useSubtasks();

  // Get collaborator names when task changes
  useEffect(() => {
    if (task?.collaborators && Array.isArray(task.collaborators)) {
      const names = task.collaborators.map(empId => 
        memberNames[empId] || `User ${empId}`
      );
      setCollaboratorNames(names);
    }
  }, [task, memberNames]);

  // Fetch subtasks when modal opens for a given task
  useEffect(() => {
    if (open && task?.id) {
      fetchSubtasks(task.id);
    }
  }, [open, task?.id, fetchSubtasks]);

  if (!open || !task) return null;

  // Function to get file name from URL
  const getFileName = (fileUrl) => {
    if (!fileUrl) return null;
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const cleanName = fileName.replace(/^\d+-/, '');
    return cleanName || fileName;
  };

  // Function to handle file download
  const handleFileDownload = (fileUrl, fileName) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName || 'attachment.pdf';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format date for display - Updated to show format: 29 September 2025
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    
    // Check if it's just time format (HH:MM:SS.milliseconds)
    const timeOnlyRegex = /^\d{2}:\d{2}:\d{2}(\.\d+)?$/;
    if (timeOnlyRegex.test(dateString)) {
      // If it's just time, show today's date only
      return new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    
    // Handle normal date format - show only date in DD Month YYYY format
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long', 
        year: 'numeric'
      });
    } catch (error) {
      return dateString; // Return original string if parsing fails
    }
  };

  // Get project name
  const getProjectName = () => {
    if (!task.project_id) return "No Project";
    return projectNames[task.project_id] || `Project ${task.project_id}`;
  };

  // Get priority styling - Updated for numeric 1-10 scale
  const getPriorityStyle = (priority) => {
    if (priority === null || priority === undefined) {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
    
    const numPriority = Number(priority);
    
    // 1-3: Low (green)
    if (numPriority >= 1 && numPriority <= 3) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    // 4-6: Medium (yellow)
    if (numPriority >= 4 && numPriority <= 6) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    // 7-10: High (red)
    if (numPriority >= 7 && numPriority <= 10) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Get status styling
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'under_review':
      case 'under review': // Updated to ensure consistent display
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'unassigned':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Format status display
  const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Task Details</h3>
          <div className="flex items-center space-x-2">
            {/* Recurrence History Button - Only show if task is part of recurring series */}
            {task.parent_recurrence_id && (
              <button
                title="View recurrence history"
                onClick={() => setShowRecurrenceHistory(true)}
                className="inline-flex items-center px-2 py-1 text-xs rounded border border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                🔄 Recurrence
              </button>
            )}
            
            {/* Edit History Button */}
            <button
              title="View edit log"
              onClick={async () => {
                if (!task?.id) return;
                try {
                  setShowHistory(true);
                  setLoadingHistory(true);
                  setHistoryError("");
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                  const supabase = createClient();
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token || "";
                  const res = await fetch(`${apiUrl}/tasks/${task.id}/history`, {
                    headers: {
                      'Authorization': `Bearer ${token}`
                    }
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || `Request failed: ${res.status}`);
                  }
                  const body = await res.json();
                  setHistory(body.history || []);
                } catch (e) {
                  setHistoryError(e.message);
                } finally {
                  setLoadingHistory(false);
                }
              }}
              className="inline-flex items-center px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Edit Log
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Project Name - Add this section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m1 0h1M9 11h1m1 0h1m-3 4h1m1 0h1m-3 4h1m1 0h1" />
                </svg>
                <span className="text-gray-900 font-medium">
                  {getProjectName()}
                </span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
              {task.title}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md min-h-[80px]">
              <p className="text-gray-900 whitespace-pre-wrap">
                {task.description || 'No description provided'}
              </p>
            </div>
          </div>

          {/* Recurrence Information - Show if task is part of recurring series */}
          {task.parent_recurrence_id && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-purple-900 mb-1">🔄 Recurring Task</h4>
                  <p className="text-sm text-purple-700">
                    This is an instance of a recurring task series.
                    {task.recurrence_pattern && ` Repeats: ${task.recurrence_pattern}`}
                  </p>
                  <button
                    onClick={() => setShowRecurrenceHistory(true)}
                    className="mt-2 text-xs text-purple-600 hover:text-purple-800 underline font-medium"
                  >
                    View all occurrences →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status and Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityStyle(task.priority)}`}>
                  {task.priority !== null && task.priority !== undefined ? `Priority: ${task.priority}` : 'Not set'}
                </span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyle(task.status)}`}>
                  {formatStatus(task.status)}
                </span>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                {task.due_date ? formatDate(task.due_date) : 'Not set'}
              </p>
            </div>
          </div>

          {/* Assigned To */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
                  {(memberNames[task.owner_id] || `User ${task.owner_id}` || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="text-gray-900">
                  {memberNames[task.owner_id] || `User ${task.owner_id}` || 'Unassigned'}
                </span>
              </div>
            </div>
          </div>

          {/* File Attachment */}
          {task.file && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachment (PDF)</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-gray-700">
                      {getFileName(task.file) || 'Attachment.pdf'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleFileDownload(task.file, getFileName(task.file))}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Collaborators */}
          {task.collaborators && task.collaborators.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collaborators ({task.collaborators.length})
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <div className="space-y-2">
                  {collaboratorNames.map((name, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center text-xs text-gray-600">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-gray-900 text-sm">{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subtasks {Array.isArray(subtasks) ? `(${subtasks.length})` : ''}
            </label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              {loadingSubtasks ? (
                <p className="text-sm text-gray-500">Loading subtasks...</p>
              ) : subtasksError ? (
                <p className="text-sm text-red-600">{subtasksError}</p>
              ) : !subtasks || subtasks.length === 0 ? (
                <p className="text-sm text-gray-500">No subtasks</p>
              ) : (
                <div className="space-y-3">
                  {subtasks.map((st) => (
                    <div key={st.id} className="bg-white border border-gray-200 rounded p-3">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-medium text-gray-900 truncate">{st.title}</p>
                          {st.description && (
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">{st.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {/* Priority */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityStyle(st.priority)}`}>
                            {st.priority !== null && st.priority !== undefined ? `P${st.priority}` : 'No P'}
                          </span>
                          {/* Status */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(st.status)}`}>
                            {formatStatus(st.status)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-xs text-gray-600 gap-4 flex-wrap">
                        {st.due_date && (
                          <div className="flex items-center">
                            <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Due: {formatDate(st.due_date)}
                          </div>
                        )}
                        {Array.isArray(st.collaborators) && st.collaborators.length > 0 && (
                          <div className="flex items-center">
                            <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 11a3 3 0 110-6 3 3 0 010 6zM6 11a3 3 0 110-6 3 3 0 010 6z" />
                            </svg>
                            {st.collaborators
                              .map((id) => memberNames[id] || `User ${id}`)
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Created At */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
            <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
              {formatDate(task.created_at)}
            </p>
          </div>

          {/* Updated At */}
          {task.updated_at && task.updated_at !== task.created_at && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
              <p className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-900">
                {formatDate(task.updated_at)}
              </p>
            </div>
          )}
        </div>

        {showHistory && (
          <div className="mt-6">
            <h4 className="text-md font-medium mb-2">Edit Log</h4>
            <div className="border rounded-md divide-y">
              {loadingHistory ? (
                <div className="p-3 text-sm text-gray-500">Loading history...</div>
              ) : historyError ? (
                <div className="p-3 text-sm text-red-600">{historyError}</div>
              ) : history.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">No history yet</div>
              ) : (
                history.map((h) => (
                  <div key={h.id} className="p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{h.action}</span>
                        <span className="text-gray-500 ml-2">by {h.editor_emp_id || h.editor_user_id}</span>
                      </div>
                      <span className="text-gray-400">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    {h.details && (
                      <pre className="mt-2 bg-gray-50 p-2 rounded text-xs text-gray-700 overflow-x-auto">{JSON.stringify(h.details, null, 2)}</pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            Close
          </button>
        </div>
      </div>

      {/* Recurrence History Modal */}
      <RecurrenceHistoryModal
        isOpen={showRecurrenceHistory}
        onClose={() => setShowRecurrenceHistory(false)}
        taskId={task.parent_recurrence_id || task.id}
        taskTitle={task.title}
      />
    </div>
  );
}