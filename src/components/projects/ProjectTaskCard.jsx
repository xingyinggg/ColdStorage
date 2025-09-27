"use client";

import { useState } from "react";
import TaskEditModal from "@/components/tasks/TaskEditModal";
import { getPriorityConfig } from "@/constants/taskConstants";

export default function ProjectTaskCard({ 
  task, 
  onTaskUpdate, 
  borderColor = "border-gray-200", 
  currentUserId, 
  memberNames = {} 
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const openEditModal = () => {
    setEditModalOpen(true);
    setEditError("");
    setEditSuccess("");
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditError("");
    setEditSuccess("");
  };

  const handleEditTask = async (taskId, formData) => {
    try {
      setEditSaving(true);
      setEditError("");
      
      // Call the parent's update function with FormData
      await onTaskUpdate(taskId, formData);
      
      setEditSuccess("Task updated successfully!");
      setTimeout(() => {
        closeEditModal();
        setEditSuccess("");
      }, 1000);
      
    } catch (error) {
      console.error("Error updating task:", error);
      setEditError(error.message || "Failed to update task");
    } finally {
      setEditSaving(false);
    }
  };

  // Check if current user is the owner of this task
  const canEdit = currentUserId && task.owner_id === currentUserId;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  // Simple function to get assigned user name
  const getAssignedUserName = () => {
    if (!task.owner_id) return "Unassigned";
    return memberNames[task.owner_id] || `User ${task.owner_id}`;
  };

  // Function to get file name from URL
  const getFileName = (fileUrl) => {
    if (!fileUrl) return null;
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];
    // Remove timestamp prefix if present (e.g., "1234567890-filename.pdf" -> "filename.pdf")
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

  const priorityConfig = getPriorityConfig(task.priority);

  return (
    <>
      <div className={`bg-white rounded-xl border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 p-4`}>
        {/* Header with Title and Edit Button */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-900 leading-5 flex-1 mr-2">
            {task.title}
          </h3>
          
          {/* Edit Button - Always Visible */}
          <div className="flex items-center space-x-2 ml-4">
            {canEdit && (
              <button
                onClick={openEditModal}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-600 leading-relaxed mb-4 line-clamp-2">
            {task.description}
          </p>
        )}

        {/* File Attachment */}
        {task.file && (
          <div className="mb-4 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center min-w-0 flex-1">
                <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="min-w-0 flex-1">
                  {/* <p className="text-xs font-medium text-gray-700 truncate">
                    {getFileName(task.file)}
                  </p> */}
                  <p className="text-xs text-gray-500">
                    PDF Attachment
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleFileDownload(task.file, getFileName(task.file))}
                className="ml-2 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 flex-shrink-0"
              >
                Download
              </button>
            </div>
          </div>
        )}

        {/* Metadata Section */}
        <div className="space-y-3">
          {/* Assigned To */}
          <div className="flex text-xs">
            <div className="flex items-center">
              <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-gray-500 font-medium">Assigned to:</span>
            </div>
            <span className={`px-1 py-1 rounded-md text-xs font-medium ${
              task.owner_id === currentUserId 
                ? "text-blue-700" 
                : "text-gray-700"
            }`}>
              {getAssignedUserName()}
            </span>
          </div>

          {/* Due Date and Priority Row */}
          <div className="flex items-center justify-between">
            {/* Due Date */}
            <div className="flex items-center">
              {task.due_date && (
                <div className="flex items-center">
                  <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className={`text-xs font-medium ${
                    isOverdue 
                      ? "text-red-600" 
                      : "text-gray-600"
                  }`}>
                    Due: {new Date(task.due_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {/* Priority Badge */}
            {task.priority && (
              <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.border}`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </div>
            )}
          </div>
        </div>
      </div>

      {canEdit && (
        <TaskEditModal
          open={editModalOpen}
          task={task}
          saving={editSaving}
          errorMessage={editError}
          successMessage={editSuccess}
          onClose={closeEditModal}
          onSave={handleEditTask}
        />
      )}
    </>
  );
}