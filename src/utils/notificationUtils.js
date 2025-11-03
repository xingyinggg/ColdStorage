/**
 * Notification utility functions for collaborator notifications
 * Extracted for testability
 */

/**
 * Generate notification title for collaborator addition
 * @param {string} taskTitle - Title of the task
 * @returns {string} Notification title
 */
export const generateCollaboratorNotificationTitle = (taskTitle) => {
  if (!taskTitle) return 'Added as collaborator';
  return `Added as collaborator for "${taskTitle}"`;
};

/**
 * Generate notification description for collaborator addition
 * @param {string} assignerName - Name of the person adding the collaborator
 * @param {string} taskTitle - Title of the task
 * @returns {string} Notification description
 */
export const generateCollaboratorNotificationDescription = (assignerName, taskTitle) => {
  const name = assignerName || 'Someone';
  const title = taskTitle || 'a task';
  return `${name} has added you as a collaborator for the shared task: "${title}".`;
};

/**
 * Create collaborator notification data object
 * @param {Object} params - Parameters object
 * @param {string|number} params.collaboratorEmpId - Employee ID of the collaborator
 * @param {number|null} params.taskId - Task ID (can be null)
 * @param {string} params.taskTitle - Title of the task
 * @param {string} params.assignerName - Name of the person adding the collaborator
 * @returns {Object} Notification data object
 */
export const createCollaboratorNotificationData = ({
  collaboratorEmpId,
  taskId,
  taskTitle,
  assignerName,
}) => {
  return {
    emp_id: collaboratorEmpId,
    task_id: taskId || null,
    title: generateCollaboratorNotificationTitle(taskTitle),
    description: generateCollaboratorNotificationDescription(assignerName, taskTitle),
    type: 'Shared Task',
    created_at: new Date().toISOString(),
  };
};

/**
 * Check if notification should be clickable (has task_id)
 * @param {Object} notification - Notification object
 * @returns {boolean} True if notification has task_id
 */
export const isNotificationClickable = (notification) => {
  return !!(notification?.task_id);
};

/**
 * Extract task ID from notification for navigation
 * @param {Object} notification - Notification object
 * @returns {number|null} Task ID or null
 */
export const getTaskIdFromNotification = (notification) => {
  if (!notification) return null;
  return notification.task_id || null;
};

