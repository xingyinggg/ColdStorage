/**
 * Report utility functions for task processing and project membership validation
 * Extracted from report components for testability
 */

/**
 * Group tasks by status (Unassigned, Ongoing, Under Review, Completed)
 * @param {Object[]} tasks - Array of tasks with status property
 * @returns {Object} Object with status groups: { completed, underReview, ongoing, unassigned }
 */
export const groupTasksByStatus = (tasks) => {
  const completed = tasks.filter(
    (t) => t.status?.toLowerCase() === "completed"
  );
  const underReview = tasks.filter(
    (t) => t.status?.toLowerCase() === "under review"
  );
  const ongoing = tasks.filter((t) => t.status?.toLowerCase() === "ongoing");
  const unassigned = tasks.filter(
    (t) => t.status?.toLowerCase() === "unassigned"
  );

  return { completed, underReview, ongoing, unassigned };
};

/**
 * Calculate project statistics from tasks
 * @param {Object[]} tasks - Array of tasks
 * @returns {Object} Statistics object with counts
 */
export const getProjectStats = (tasks) => {
  const total = tasks.length;
  const completed = tasks.filter(
    (t) => t.status?.toLowerCase() === "completed"
  ).length;
  const ongoing = tasks.filter(
    (t) => t.status?.toLowerCase() === "ongoing"
  ).length;
  const underReview = tasks.filter(
    (t) => t.status?.toLowerCase() === "under review"
  ).length;
  const overdue = tasks.filter(
    (t) =>
      t.due_date &&
      new Date(t.due_date) < new Date() &&
      t.status?.toLowerCase() !== "completed"
  ).length;

  return { total, completed, ongoing, underReview, overdue };
};

/**
 * Sort tasks by due date (tasks without due dates go to end)
 * @param {Object[]} tasks - Array of tasks with due_date property
 * @returns {Object[]} Sorted array of tasks
 */
export const sortTasksByDueDate = (tasks) => {
  return [...tasks].sort((a, b) => {
    if (!a.due_date) return 1; // Tasks without due_date go to end
    if (!b.due_date) return -1; // Tasks without due_date go to end
    return new Date(a.due_date) - new Date(b.due_date);
  });
};

/**
 * Check if a user is a member of a project
 * @param {Object} project - Project object with owner_id and members
 * @param {string|number} userEmpId - User's employee ID
 * @returns {boolean} True if user is owner or member
 */
export const isProjectMember = (project, userEmpId) => {
  if (!project || !userEmpId) return false;

  // Check if user is owner
  const isOwner =
    project.owner_id &&
    String(project.owner_id) === String(userEmpId);

  // Check if user is in members array
  const isMember =
    project.members &&
    Array.isArray(project.members) &&
    project.members.includes(String(userEmpId));

  return isOwner || isMember;
};

/**
 * Filter projects by user membership
 * @param {Object[]} projects - Array of projects
 * @param {string|number} userEmpId - User's employee ID
 * @returns {Object[]} Filtered array of projects user belongs to
 */
export const filterProjectsByMembership = (projects, userEmpId) => {
  if (!projects || !Array.isArray(projects)) return [];
  if (!userEmpId) return [];

  return projects.filter((project) => isProjectMember(project, userEmpId));
};

/**
 * Check if user has access to project based on role
 * @param {Object} project - Project object
 * @param {string|number} userEmpId - User's employee ID
 * @param {string} userRole - User's role (staff, manager, director, hr)
 * @returns {boolean} True if user has access
 */
export const hasProjectAccess = (project, userEmpId, userRole) => {
  if (!project || !userEmpId) return false;

  // Normalize role to lowercase for case-insensitive matching
  const roleLower = (userRole || "").toLowerCase();

  // Directors and HR can access all projects
  if (roleLower === "director" || roleLower === "hr") {
    return true;
  }

  // Managers can access projects they own or are members of
  if (roleLower === "manager") {
    return isProjectMember(project, userEmpId);
  }

  // Staff can only access projects they are members of
  if (roleLower === "staff") {
    return isProjectMember(project, userEmpId);
  }

  // Default: check membership
  return isProjectMember(project, userEmpId);
};

/**
 * Process tasks for report display (group by status and sort by due date)
 * @param {Object[]} tasks - Array of tasks
 * @returns {Object} Processed report data
 */
export const processTasksForReport = (tasks) => {
  if (!tasks || !Array.isArray(tasks)) {
    return {
      stats: { total: 0, completed: 0, ongoing: 0, underReview: 0, overdue: 0 },
      tasksByStatus: { completed: [], underReview: [], ongoing: [], unassigned: [] },
      sortedTasks: [],
      hasData: false,
    };
  }

  const stats = getProjectStats(tasks);
  const tasksByStatus = groupTasksByStatus(tasks);
  const sortedTasks = sortTasksByDueDate(tasks);

  return {
    stats,
    tasksByStatus,
    sortedTasks,
    hasData: tasks.length > 0,
  };
};

