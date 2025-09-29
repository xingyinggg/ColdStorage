"use client";

import { useState } from "react";
import TaskEditModal from "@/components/tasks/TaskEditModal";
import TaskDetailsModal from "@/components/tasks/TaskDetailsModal";
import { getPriorityConfig } from "@/constants/taskConstants";

export default function ProjectTaskCard({ 
  task, 
  onTaskUpdate,
  canEdit, // ← Use this prop instead of calculating internally
  borderColor = "border-gray-200", 
  currentUserId, // Keep for backwards compatibility
  memberNames = {},
  projectNames = {} // Add this prop
}) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false); // Add details modal state
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const openEditModal = (e) => {
    e.stopPropagation();
    setEditModalOpen(true);
    setEditError("");
    setEditSuccess("");
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditError("");
    setEditSuccess("");
  };

  // Add details modal functions
  const openDetailsModal = () => {
    setDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
  };

  const handleEditTask = async (taskId, formData) => {
    try {
      setEditSaving(true);
      setEditError("");
      
      // Convert FormData to regular object for useTasks updateTask function
      const updates = {};
      for (let [key, value] of formData.entries()) {
        if (key !== 'file' && key !== 'remove_file') {
          updates[key] = value;
        }
      }
      
      console.log('TaskCard: Converting FormData to JSON:', updates);
      
      await onTaskUpdate(taskId, updates);
      
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

  // Use the passed canEdit prop, or fallback to calculating it if not provided
  const userCanEdit = canEdit !== undefined ? canEdit : (currentUserId && task.owner_id && String(currentUserId) === String(task.owner_id));
  
  // Due date status calculations
  const now = new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < now;
  
  const msInDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = dueDate ? Math.ceil((dueDate - now) / msInDay) : null;
  const isApproaching = dueDate && daysUntilDue > 0 && daysUntilDue <= 3;

  const getAssignedUserName = () => {
    if (!task.owner_id) return "Unassigned";
    return memberNames[task.owner_id] || `User ${task.owner_id}`;
  };

  const priorityConfig = getPriorityConfig(task.priority);

  console.log('Debug - Edit button check:', {
    canEditProp: canEdit,
    currentUserId,
    'task.owner_id': task.owner_id,
    userCanEdit,
    'calculated': currentUserId && task.owner_id && String(currentUserId) === String(task.owner_id)
  });

  return (
    <>
      <div 
        className={`bg-white rounded-xl border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 p-4 cursor-pointer`}
        onClick={openDetailsModal} // Add click handler to open details modal
      >
        {/* Header with Title and Edit Button */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-sm text-gray-900 leading-5 flex-1 mr-2 min-w-0">
            {task.title}
          </h3>
          
          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
            {/* Priority Badge */}
            {task.priority && (
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.border}`}>
                {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </div>
            )}
            
            {/* Edit Button - Use userCanEdit */}
            {userCanEdit && (
              <button
                onClick={openEditModal}
                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 flex-shrink-0"
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

        {/* Metadata Section */}
        <div className="space-y-3">
          {/* Assigned To */}
          <div className="flex items-center text-xs">
            <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-gray-500 font-medium mr-1 flex-shrink-0">Assigned to:</span>
            <span className={`font-medium truncate ${
              userCanEdit ? "text-blue-700" : "text-gray-700"
            }`}>
              {getAssignedUserName()}
            </span>
          </div>

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-center text-xs">
              <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={`font-medium ${
                isOverdue 
                  ? "text-red-600" 
                  : isApproaching
                  ? "text-amber-600"
                  : "text-gray-600"
              }`}>
                Due: {new Date(task.due_date).toLocaleDateString()}
                {isOverdue && (
                  <span className="ml-1 text-red-500 font-semibold">
                    (Overdue)
                  </span>
                )}
                {isApproaching && (
                  <span className="ml-1 text-amber-500 font-semibold">
                    ({daysUntilDue} day{daysUntilDue === 1 ? '' : 's'} left)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task Details Modal - Add this */}
      <TaskDetailsModal
        open={detailsModalOpen}
        task={task}
        onClose={closeDetailsModal}
        memberNames={memberNames}
        projectNames={projectNames}
      />

      {userCanEdit && (
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