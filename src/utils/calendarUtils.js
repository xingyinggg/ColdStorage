
/**
 * Normalize a date to start of day (00:00:00)
 * @param {Date} date - Date to normalize
 * @returns {Date} Date set to start of day
 */
export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Add days to a date
 * @param {Date} date - Base date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date with days added
 */
export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/**
 * Check if two dates are the same day
 * @param {Date} a - First date
 * @param {Date} b - Second date
 * @returns {boolean} True if same day
 */
export const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

/**
 * Generate month grid (42 cells covering 6 weeks)
 * @param {Date} cursor - Reference date (any day in the month)
 * @returns {Date[]} Array of 42 dates representing the month grid
 */
export const getMonthGrid = (cursor) => {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startWeekDay = firstOfMonth.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const gridStart = addDays(firstOfMonth, -startWeekDay);
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  return cells;
};

/**
 * Generate week grid (7 days starting from Sunday)
 * @param {Date} cursor - Reference date (any day in the week)
 * @returns {Date[]} Array of 7 dates representing the week
 */
export const getWeekGrid = (cursor) => {
  const start = addDays(cursor, -cursor.getDay());
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
};

/**
 * Group tasks by their due date
 * @param {Object[]} tasks - Array of tasks with due_date property
 * @param {Date[]} daysGrid - Array of dates representing the calendar grid
 * @returns {Map<number, Object[]>} Map where key is timestamp (start of day) and value is array of tasks
 */
export const groupTasksByDate = (tasks, daysGrid) => {
  const map = new Map();
  
  // Initialize map with all days in grid
  daysGrid.forEach((d) => {
    map.set(startOfDay(d).getTime(), []);
  });
  
  // Group tasks by their due date
  tasks.forEach((t) => {
    if (t.due_date) {
      const taskDueDate = startOfDay(new Date(t.due_date));
      const key = taskDueDate.getTime();
      if (map.has(key)) {
        map.get(key).push(t);
      }
    }
  });
  
  return map;
};

/**
 * Filter tasks by project
 * @param {Object[]} tasks - Array of tasks
 * @param {string|number} projectId - Project ID to filter by (empty string = no filter)
 * @returns {Object[]} Filtered tasks
 */
export const filterByProject = (tasks, projectId) => {
  if (!projectId) return tasks;
  return tasks.filter((t) => String(t.project_id || "") === String(projectId));
};

/**
 * Filter tasks by status
 * @param {Object[]} tasks - Array of tasks
 * @param {string} status - Status to filter by (empty string = no filter)
 * @returns {Object[]} Filtered tasks
 */
export const filterByStatus = (tasks, status) => {
  if (!status) return tasks;
  return tasks.filter((t) => String(t.status || "") === String(status));
};

/**
 * Filter tasks by assignee (owner, collaborators, or assignees)
 * @param {Object[]} tasks - Array of tasks
 * @param {string|number} assigneeId - Assignee ID to filter by (empty string = no filter)
 * @returns {Object[]} Filtered tasks
 */
export const filterByAssignee = (tasks, assigneeId) => {
  if (!assigneeId) return tasks;
  
  return tasks.filter((t) => {
    // Check owner
    if (String(t.owner_id || "") === String(assigneeId)) return true;
    
    // Check collaborators
    if (Array.isArray(t.collaborators)) {
      const collaboratorIds = t.collaborators.map(String);
      if (collaboratorIds.includes(String(assigneeId))) return true;
    }
    
    // Check assignees
    if (Array.isArray(t.assignees)) {
      const assigneeIds = t.assignees
        .map((u) => String(u?.emp_id || u?.id || ""))
        .filter(Boolean);
      if (assigneeIds.includes(String(assigneeId))) return true;
    }
    
    return false;
  });
};

/**
 * Filter tasks that have a due date (exclude tasks without due dates)
 * @param {Object[]} tasks - Array of tasks
 * @returns {Object[]} Tasks with due_date property
 */
export const filterTasksWithDueDate = (tasks) => {
  return tasks.filter((t) => !!t.due_date);
};

/**
 * Apply all filters to tasks
 * @param {Object[]} tasks - Array of tasks
 * @param {Object} filters - Filter options
 * @param {string|number} filters.projectId - Project ID filter
 * @param {string} filters.status - Status filter
 * @param {string|number} filters.assigneeId - Assignee ID filter
 * @param {boolean} filters.requireDueDate - Whether to require due_date (default: true)
 * @returns {Object[]} Filtered and normalized tasks
 */
export const applyFilters = (tasks, filters = {}) => {
  const {
    projectId = "",
    status = "",
    assigneeId = "",
    requireDueDate = true,
  } = filters;
  
  let filtered = [...tasks];
  
  // Filter by due date first (most restrictive)
  if (requireDueDate) {
    filtered = filterTasksWithDueDate(filtered);
  }
  
  // Apply other filters
  filtered = filterByProject(filtered, projectId);
  filtered = filterByStatus(filtered, status);
  filtered = filterByAssignee(filtered, assigneeId);
  
  // Normalize tasks (add 'due' property)
  return filtered.map((t) => ({
    ...t,
    due: startOfDay(new Date(t.due_date)),
  }));
};

