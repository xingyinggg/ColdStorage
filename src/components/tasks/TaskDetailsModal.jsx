"use client";

import { useState, useEffect } from "react";

export default function TaskDetailsModal({ 
  open, 
  task, 
  onClose, 
  memberNames = {},
  projectNames = {} // Add this prop
}) {
  const [collaboratorNames, setCollaboratorNames] = useState([]);

  // Get collaborator names when task changes
  useEffect(() => {
    if (task?.collaborators && Array.isArray(task.collaborators)) {
      const names = task.collaborators.map(empId => 
        memberNames[empId] || `User ${empId}`
      );
      setCollaboratorNames(names);
    }
  }, [task, memberNames]);

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
    console.log('TaskDetailsModal Debug:', {
      'task.project_id': task.project_id,
      'projectNames': projectNames,
      'projectNames keys': Object.keys(projectNames),
      'lookup result': projectNames[task.project_id]
    });
    
    if (!task.project_id) return "No Project";
    return projectNames[task.project_id] || `Project ${task.project_id}`;
  };

  // Get priority styling
  const getPriorityStyle = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  console.log("TaskDetailsModal Debug:", { task, memberNames, projectNames });
  // Get status styling
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'under_review':
      case 'under review':
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Task Details</h3>

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

          {/* Status and Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityStyle(task.priority)}`}>
                  {task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Not set'}
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

        <div className="mt-6 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}