"use client";

import { useState, useEffect, useMemo } from "react";
import TaskEditModal from "@/components/tasks/TaskEditModal";
import TaskDetailsModal from "@/components/tasks/TaskDetailsModal";
import { useSubtasks } from "@/utils/hooks/useSubtasks";
import { useProjects } from "@/utils/hooks/useProjects";
import SubtaskEditModal from "@/components/tasks/SubtaskEditModal";
import Toast from "@/components/ui/Toast";
import RecurrenceStatus from "@/components/tasks/RecurrenceStatus";

// Helper function to get priority color based on numeric value (1-10)
const getPriorityColor = (priority) => {
  if (priority === null || priority === undefined) {
    return {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    };
  }

  // 1-3: Low (green)
  if (priority >= 1 && priority <= 3) {
    return {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    };
  }
  // 4-6: Medium (orange/yellow)
  if (priority >= 4 && priority <= 6) {
    return {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
    };
  }
  // 7-10: High (red)
  if (priority >= 7 && priority <= 10) {
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    };
  }

  // Default
  return {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
  };
};

const getStatusColor = (status) => {
  if (!status) {
    return {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    };
  }

  const statusLower = String(status).toLowerCase();
  
  // Unassigned - Gray
  if (statusLower === 'unassigned') {
    return {
      bg: "bg-gray-50",
      text: "text-gray-700",
      border: "border-gray-200",
    };
  }
  
  // Ongoing/In Progress - Yellow
  if (statusLower === 'ongoing' || statusLower === 'in progress' || statusLower === 'in_progress') {
    return {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-200",
    };
  }
  
  // Under Review - Blue
  if (statusLower === 'under review' || statusLower === 'under_review' || statusLower === 'pending') {
    return {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    };
  }
  
  // Completed/Done - Green
  if (statusLower === 'completed' || statusLower === 'done') {
    return {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-200",
    };
  }

  // Default - Gray
  return {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
  };
};

export default function TaskCard({
  task,
  onTaskUpdate,
  onEdit,
  canEdit = false,
  isOwner = false,
  isCollaborator = false,
  borderColor = "border-gray-200",
  currentUserId,
  memberNames = {},
  projectNames = {}
}) {

  const { projects, loading: projectsLoading } = useProjects();

  const hookProjectNames = useMemo(() => {
    const namesMap = {};
    if (projects && Array.isArray(projects)) {
      projects.forEach(project => {
        namesMap[project.id] = project.title;
      });
    }
    return namesMap;
  }, [projects]);

  const combinedProjectNames = useMemo(() => {
    return { ...projectNames, ...hookProjectNames };
  }, [projectNames, hookProjectNames]);

  // Disable edit functionality if no update handlers are provided
  const actualCanEdit = canEdit && (typeof onTaskUpdate === 'function' || typeof onEdit === 'function');
  
  // Log the update functions to help debug
  useEffect(() => {
    if (canEdit && !actualCanEdit) {
      console.warn("TaskCard has canEdit=true but no update handlers - disabling edit functionality");
    }
  }, [onTaskUpdate, onEdit, canEdit, actualCanEdit]);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [showSubtasks, setShowSubtasks] = useState(false);
  const { subtasks, loading: loadingSubtasks, error: subtasksError, fetchSubtasks, updateSubtask } = useSubtasks();
  const [subtaskEditOpen, setSubtaskEditOpen] = useState(false);
  const [subtaskBeingEdited, setSubtaskBeingEdited] = useState(null);
  const [subtaskSaving, setSubtaskSaving] = useState(false);
  const [toast, setToast] = useState({ type: "", message: "" });
  
  // NEW: State for managing subtask count and loading
  const [subtaskCount, setSubtaskCount] = useState(null);
  const [loadingSubtaskCount, setLoadingSubtaskCount] = useState(false);
  const [hasFetchedSubtasks, setHasFetchedSubtasks] = useState(false);

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
    // Fetch subtasks if not already fetched
    if (task?.id && !hasFetchedSubtasks) {
      setLoadingSubtaskCount(true);
      fetchSubtasks(task.id)
        .then(() => {
          setSubtaskCount(subtasks.length);
          setHasFetchedSubtasks(true);
        })
        .finally(() => setLoadingSubtaskCount(false));
    }
  };

  const closeDetailsModal = () => {
    setDetailsModalOpen(false);
  };

  // NEW: Fetch subtask count on component mount
  useEffect(() => {
    if (task?.id && !hasFetchedSubtasks && !loadingSubtaskCount) {
      setLoadingSubtaskCount(true);
      fetchSubtasks(task.id)
        .then(() => {
          setSubtaskCount(subtasks.length);
          setHasFetchedSubtasks(true);
        })
        .catch((error) => {
          console.error("Error fetching subtasks:", error);
          setSubtaskCount(0);
        })
        .finally(() => {
          setLoadingSubtaskCount(false);
        });
    }
  }, [task?.id, hasFetchedSubtasks, loadingSubtaskCount, fetchSubtasks]);

  // NEW: Update subtask count when subtasks change
  useEffect(() => {
    if (hasFetchedSubtasks && Array.isArray(subtasks)) {
      setSubtaskCount(subtasks.length);
    }
  }, [subtasks, hasFetchedSubtasks]);

  const handleEditTask = async (taskId, formOrFormData) => {
    try {
      setEditSaving(true);
      setEditError("");

      // Convert FormData to plain object when needed
      let updates = {};
      if (formOrFormData && typeof formOrFormData.entries === 'function') {
        for (let [key, value] of formOrFormData.entries()) {
          if (key !== 'file' && key !== 'remove_file') {
            // Convert priority to integer
            if (key === 'priority') {
              const parsed = parseInt(value, 10);
              if (!isNaN(parsed)) {
                updates[key] = parsed;
              }
            } else {
              updates[key] = value;
            }
          }
        }
      } else if (formOrFormData && typeof formOrFormData === 'object') {
        updates = { ...formOrFormData };
        // Ensure priority is a number if present
        if (updates.priority !== undefined && updates.priority !== null) {
          const parsed = parseInt(updates.priority, 10);
          if (!isNaN(parsed)) {
            updates.priority = parsed;
          }
        }
      }

      console.log("[handleEditTask] Processing task update:", { taskId, updates });

      // Choose the update function
      let updateFn = onTaskUpdate || onEdit;
      
      if (!updateFn) {
        console.error("[handleEditTask] No update function available");
        throw new Error("No update handler available");
      }

      // Call the update function
      const result = await updateFn(taskId, updates);
      console.log("[handleEditTask] Update result:", result);
      
      setEditSuccess("Task updated successfully!");
      setTimeout(() => {
        closeEditModal();
        setEditSuccess("");
      }, 1000);
      
      return result;
    } catch (error) {
      console.error("[handleEditTask] Error:", error);
      setEditError(error.message || "Failed to update task");
      return { success: false, error: error.message || "Failed to update task" };
    } finally {
      setEditSaving(false);
    }
  };

  // Use the actualCanEdit variable that considers both canEdit prop and availability of update handlers
  const userCanEdit = actualCanEdit;

  // Due date status calculations
  const now = new Date();
  const dueDate = task.due_date ? new Date(task.due_date) : null;
  
  // Only mark as overdue if not done/completed
  const isOverdue = dueDate && dueDate < now && task.status !== 'done' && task.status !== 'completed';

  const msInDay = 24 * 60 * 60 * 1000;
  const daysUntilDue = dueDate ? Math.ceil((dueDate - now) / msInDay) : null;
  
  // Only show approaching warning if not done/completed
  const isApproaching = dueDate && daysUntilDue > 0 && daysUntilDue <= 3 && task.status !== 'done' && task.status !== 'completed';

  const getAssignedToDisplay = () => {
    // Assigned to = task owner
    const ownerName = task.owner_name || task.manager?.name || task.task_owner?.name;
    if (ownerName) return ownerName;
    if (task.owner_id) return `User ${task.owner_id}`;
    return 'Unassigned';
  };

  const getCollaboratorsDisplay = () => {
    if (Array.isArray(task.assignees) && task.assignees.length > 0) {
      const names = task.assignees.map((u) => u?.name).filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    if (Array.isArray(task.collaborators) && task.collaborators.length > 0) {
      const names = task.collaborators.map((id) => memberNames?.[id]).filter(Boolean);
      if (names.length > 0) return names.join(', ');
      return task.collaborators.map((id) => `User ${id}`).join(', ');
    }
    return '';
  };

  const getProjectNameDisplay = () => {
    // If task has a project_name property, use it directly
    if (task.project_name) {
      return task.project_name;
    }
    
    // If task has project_id, try to resolve it using projectNames prop
    if (task.project_id && combinedProjectNames && combinedProjectNames[task.project_id]) {
      return combinedProjectNames[task.project_id];
    }
    
    // Fallback to showing project ID if name resolution fails
    if (task.project_id) {
      return `Project ${task.project_id}`;
    }
    
    // No project assigned
    return 'No project assigned';
  };

  const getAllMemberNames = useMemo(() => {
    const allMembers = { ...memberNames };
    
    // Add data from the current task only (not tasks array)
    if (task.owner_id && task.owner_name) {
      allMembers[task.owner_id] = task.owner_name;
    }
    if (task.manager?.id && task.manager?.name) {
      allMembers[task.manager.id] = task.manager.name;
    }
    if (task.task_owner?.id && task.task_owner?.name) {
      allMembers[task.task_owner.id] = task.task_owner.name;
    }
    
    // Add assignees
    if (task.assignees && Array.isArray(task.assignees)) {
      task.assignees.forEach(assignee => {
        if (assignee.id && assignee.name) {
          allMembers[assignee.id] = assignee.name;
        }
        if (assignee.emp_id && assignee.name) {
          allMembers[assignee.emp_id] = assignee.name;
        }
      });
    }
    
    // Add collaborators if they have name data embedded
    if (task.collaborators && Array.isArray(task.collaborators)) {
      task.collaborators.forEach(collab => {
        if (typeof collab === 'object' && collab.id && collab.name) {
          allMembers[collab.id] = collab.name;
        }
        if (typeof collab === 'object' && collab.emp_id && collab.name) {
          allMembers[collab.emp_id] = collab.name;
        }
      });
    }
    
    return allMembers;
  }, [memberNames, task]);

  // Create a similar useMemo for project names
  const getAllProjectNames = useMemo(() => {
    const allProjects = { ...combinedProjectNames };
    
    // Add project name from current task if available
    if (task.project_id && task.project_name) {
      allProjects[task.project_id] = task.project_name;
    }
    
    return allProjects;
  }, [combinedProjectNames, task]);

  const priorityConfig = getPriorityColor(task.priority);

  return (
    <>
      <div
        className={`bg-white rounded-xl border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 p-3 sm:p-4 cursor-pointer`}
        onClick={openDetailsModal}
      >
        {/* 🎯 MOBILE-FIRST: Header with Title only */}
        <div className="mb-3">
          <h3 className="font-semibold text-sm sm:text-base text-gray-900 leading-5 break-words">
            {task.title}
          </h3>
        </div>

        {/* 🎯 MOBILE-FIRST: Badges Row - Priority, Recurring, Edit Button */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {/* Priority Badge - Compact for mobile */}
          {task.priority !== null && task.priority !== undefined && (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${priorityConfig.bg} ${priorityConfig.text} ${priorityConfig.border} flex-shrink-0`}>
              <span className="hidden sm:inline">Priority: </span>
              <span className="sm:hidden">P</span>
              {task.priority}
            </div>
          )}

          {/* Recurring Badge */}
          {task.is_recurring && (
            <RecurrenceStatus task={task} variant="compact" />
          )}

          {/* Edit Button */}
          {userCanEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); openEditModal(e); }}
              className="inline-flex items-center px-2 sm:px-3 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 flex-shrink-0 ml-auto"
            >
              <span className="hidden sm:inline">Edit</span>
              <span className="sm:hidden">✏️</span>
            </button>
          )}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed mb-3 line-clamp-2 break-words">
            {task.description}
          </p>
        )}

        {/* 🎯 MOBILE-OPTIMIZED: Metadata Section */}
        <div className="space-y-2 sm:space-y-3">
          {/* Assigned To */}
          <div className="flex items-start sm:items-center text-xs sm:text-sm">
            <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <div className="min-w-0 flex-1">
              <span className="text-gray-500 font-medium">Assigned to:</span>
              <span className={`block sm:inline sm:ml-1 font-medium break-words ${userCanEdit ? "text-blue-700" : "text-gray-700"}`}>
                {getAssignedToDisplay()}
              </span>
            </div>
          </div>

          {/* Collaborators */}
          {getCollaboratorsDisplay() && (
            <div className="flex items-start sm:items-center text-xs sm:text-sm">
              <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M9 20H4v-2a3 3 0 015.356-1.857M15 11a3 3 0 110-6 3 3 0 010 6zM6 11a3 3 0 110-6 3 3 0 010 6z" />
              </svg>
              <div className="min-w-0 flex-1">
                <span className="text-gray-500 font-medium">Collaborators:</span>
                <span className="block sm:inline sm:ml-1 font-medium text-gray-700 break-words">
                  {getCollaboratorsDisplay()}
                </span>
              </div>
            </div>
          )}

          {/* Project */}
          {(task.project_id || task.project_name) && (
            <div className="flex items-start sm:items-center text-xs sm:text-sm">
              <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <div className="min-w-0 flex-1">
                <span className="text-gray-500 font-medium">Project:</span>
                <span className="block sm:inline sm:ml-1 font-medium text-gray-700 break-words">
                  {getProjectNameDisplay()}
                </span>
              </div>
            </div>
          )}

          {/* Due Date */}
          {task.due_date && (
            <div className="flex items-start sm:items-center text-xs sm:text-sm">
              <svg className="w-3.5 h-3.5 text-gray-400 mr-1.5 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-600">Due:</span>
                <span className={`block sm:inline sm:ml-1 font-medium ${
                  isOverdue
                    ? "text-red-600"
                    : isApproaching
                      ? "text-amber-600"
                      : "text-gray-600"
                }`}>
                  {new Date(task.due_date).toLocaleDateString()}
                  {isOverdue && (
                    <span className="block sm:inline sm:ml-1 text-red-500 font-semibold">
                      (Overdue)
                    </span>
                  )}
                  {isApproaching && (
                    <span className="block sm:inline sm:ml-1 text-amber-500 font-semibold">
                      ({daysUntilDue} day{daysUntilDue === 1 ? '' : 's'} left)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Subtasks Section */}
        {(subtaskCount > 0 || loadingSubtaskCount) && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); 
                setShowSubtasks((v) => !v);
              }}
              className="flex items-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 w-full"
              title="Toggle subtasks"
            >
              <svg className={`w-3.5 h-3.5 mr-1.5 transition-transform ${showSubtasks ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {loadingSubtaskCount ? (
                "Loading subtasks..."
              ) : showSubtasks ? (
                "Hide subtasks"
              ) : (
                `View subtasks (${subtaskCount})`
              )}
            </button>

            {showSubtasks && (
              <div className="mt-2 border border-gray-200 rounded-md p-2 sm:p-3 bg-gray-50">
                {loadingSubtasks ? (
                  <p className="text-xs text-gray-500">Loading subtasks...</p>
                ) : subtasksError ? (
                  <p className="text-xs text-red-600">{subtasksError}</p>
                ) : subtasks.length === 0 ? (
                  <p className="text-xs text-gray-500">No subtasks found</p>
                ) : (
                  <ul className="space-y-2">
                    {subtasks.map((st) => (
                      <li key={st.id} className="bg-white border border-gray-200 rounded p-2">
                        <div className="space-y-2">
                          {/* Subtask Title and Description */}
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{st.title}</p>
                            {st.description && (
                              <p className="text-xs text-gray-600 mt-1 break-words line-clamp-2">{st.description}</p>
                            )}
                          </div>
                          
                          {/* Subtask Badges and Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            {st.priority !== null && st.priority !== undefined && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(st.priority).bg} ${getPriorityColor(st.priority).text} ${getPriorityColor(st.priority).border}`}>
                                P{st.priority}
                              </span>
                            )}
                            {st.status && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${getStatusColor(st.status).bg} ${getStatusColor(st.status).text} ${getStatusColor(st.status).border}`}>
                                {String(st.status).replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            )}
                            {userCanEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSubtaskBeingEdited(st); 
                                  setSubtaskEditOpen(true);
                                }}
                                className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 ml-auto"
                                title="Edit subtask"
                              >
                                <span className="hidden sm:inline">Edit</span>
                                <span className="sm:hidden">✏️</span>
                              </button>
                            )}
                          </div>
                          
                          {/* Subtask Due Date */}
                          {st.due_date && (
                            <div className="flex items-center text-xs text-gray-600">
                              <svg className="w-3 h-3 text-gray-400 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Due: {new Date(st.due_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={openDetailsModal}
                    className="text-xs sm:text-sm text-blue-600 hover:text-blue-800"
                  >
                    Open full details
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Details Modal */}
      <TaskDetailsModal
        open={detailsModalOpen}
        task={task}
        onClose={closeDetailsModal}
        memberNames={getAllMemberNames}
        projectNames={getAllProjectNames}
        subtasks={subtasks} 
        loadingSubtasks={loadingSubtasks}
        subtasksError={subtasksError}
      />

      {userCanEdit && (
        <TaskEditModal
          open={editModalOpen}
          task={task}
          isOwner={isOwner}
          isCollaborator={isCollaborator}
          saving={editSaving}
          errorMessage={editError}
          successMessage={editSuccess}
          onClose={closeEditModal}
          onSave={(id, updates) => {
            console.log("TaskEditModal onSave called with:", id, updates);
            return handleEditTask(id, updates);
          }}
        />
      )}

      {userCanEdit && (
        <SubtaskEditModal
          open={subtaskEditOpen}
          subtask={subtaskBeingEdited}
          saving={subtaskSaving}
          isOwner={isOwner}
          isCollaborator={isCollaborator}
          onClose={() => { setSubtaskEditOpen(false); setSubtaskBeingEdited(null); }}
          onSave={async (subtaskId, updates) => {
            try {
              setSubtaskSaving(true);
              await updateSubtask(subtaskId, updates);
              setSubtaskEditOpen(false);
              setSubtaskBeingEdited(null);
              setToast({ type: "success", message: "Subtask updated successfully" });
              setTimeout(() => setToast({ type: "", message: "" }), 2000);
            } finally {
              setSubtaskSaving(false);
            }
          }}
        />
      )}

      <Toast
        type={toast.type}
        message={toast.message}
        onClose={() => setToast({ type: "", message: "" })}
      />
    </>
  );
}