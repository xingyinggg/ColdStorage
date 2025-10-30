// tests/e2e/fixtures/test-data.js

/**
 * Sample task data for E2E tests
 */
export const sampleTasks = {
  ongoing: {
    id: "task-ongoing-1",
    title: "Ongoing Task Example",
    description: "This is an ongoing task",
    priority: 5,
    status: "ongoing",
    due_date: "2025-12-31T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
  },
  overdue: {
    id: "task-overdue-1",
    title: "Overdue Task Example",
    description: "This task is overdue",
    priority: 8,
    status: "ongoing",
    due_date: "2000-01-01T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
  },
  completed: {
    id: "task-completed-1",
    title: "Completed Task Example",
    description: "This task is completed",
    priority: 3,
    status: "completed",
    due_date: "2025-06-15T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
    completed_at: "2025-06-01T00:00:00Z",
  },
  highPriority: {
    id: "task-high-priority-1",
    title: "High Priority Task",
    description: "This is a high priority task",
    priority: 10,
    status: "ongoing",
    due_date: "2025-11-30T00:00:00Z",
    owner_id: "E2E001",
    collaborators: [],
    created_at: "2025-01-01T00:00:00Z",
  },
  withCollaborators: {
    id: "task-collab-1",
    title: "Collaborative Task",
    description: "Task with multiple collaborators",
    priority: 6,
    status: "ongoing",
    due_date: "2025-12-01T00:00:00Z",
    owner_id: "E2E001",
    collaborators: ["STF001", "STF002"],
    created_at: "2025-01-01T00:00:00Z",
  },
};

/**
 * Sample user data for E2E tests
 */
export const sampleUsers = {
  staff1: {
    id: "user-staff-1",
    emp_id: "STF001",
    name: "Test Staff One",
    email: "staff1@example.com",
    role: "staff",
    department: "Engineering",
  },
  staff2: {
    id: "user-staff-2",
    emp_id: "STF002",
    name: "Test Staff Two",
    email: "staff2@example.com",
    role: "staff",
    department: "Engineering",
  },
  manager1: {
    id: "user-manager-1",
    emp_id: "MGR001",
    name: "Test Manager",
    email: "manager@example.com",
    role: "manager",
    department: "Engineering",
  },
  hr1: {
    id: "user-hr-1",
    emp_id: "HR001",
    name: "Test HR",
    email: "hr@example.com",
    role: "hr",
    department: "Human Resources",
  },
  director1: {
    id: "user-director-1",
    emp_id: "DIR001",
    name: "Test Director",
    email: "director@example.com",
    role: "director",
    department: "Executive",
  },
  e2eUser: {
    id: "mock-user-123",
    emp_id: "E2E001",
    name: "E2E Tester",
    email: "mock@example.com",
    role: "staff",
    department: "QA",
  },
};

/**
 * Sample project data for E2E tests
 */
export const sampleProjects = {
  project1: {
    id: "proj-1",
    title: "E2E Test Project Alpha",
    description: "First test project",
    status: "active",
    manager_id: "MGR001",
    members: ["E2E001", "STF001"],
    created_at: "2025-01-01T00:00:00Z",
  },
  project2: {
    id: "proj-2",
    title: "E2E Test Project Beta",
    description: "Second test project",
    status: "active",
    manager_id: "MGR001",
    members: ["STF001", "STF002"],
    created_at: "2025-01-15T00:00:00Z",
  },
  completedProject: {
    id: "proj-completed",
    title: "Completed Project",
    description: "This project is finished",
    status: "completed",
    manager_id: "MGR001",
    members: ["E2E001"],
    created_at: "2024-01-01T00:00:00Z",
    completed_at: "2024-12-31T00:00:00Z",
  },
};

/**
 * Sample subtask data
 */
export const sampleSubtasks = {
  subtask1: {
    id: "subtask-1",
    parent_task_id: "task-ongoing-1",
    title: "Subtask 1",
    description: "First subtask",
    priority: 4,
    status: "ongoing",
    created_at: "2025-01-02T00:00:00Z",
  },
  subtask2: {
    id: "subtask-2",
    parent_task_id: "task-ongoing-1",
    title: "Subtask 2",
    description: "Second subtask",
    priority: 5,
    status: "completed",
    created_at: "2025-01-02T00:00:00Z",
    completed_at: "2025-01-10T00:00:00Z",
  },
};

/**
 * Helper to create a task with custom overrides
 */
export function createTask(overrides = {}) {
  return {
    id: `task-${Date.now()}`,
    title: "Test Task",
    description: "Test description",
    priority: 5,
    status: "ongoing",
    due_date: null,
    owner_id: "E2E001",
    collaborators: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Helper to create a user with custom overrides
 */
export function createUser(overrides = {}) {
  const timestamp = Date.now();
  return {
    id: `user-${timestamp}`,
    emp_id: `EMP${timestamp}`,
    name: "Test User",
    email: `testuser${timestamp}@example.com`,
    role: "staff",
    department: "Engineering",
    ...overrides,
  };
}

/**
 * Helper to create a project with custom overrides
 */
export function createProject(overrides = {}) {
  return {
    id: `proj-${Date.now()}`,
    title: "Test Project",
    description: "Test project description",
    status: "active",
    manager_id: "MGR001",
    members: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Get a future date (for due dates)
 */
export function getFutureDate(daysFromNow = 7) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Get a past date (for overdue tasks)
 */
export function getPastDate(daysAgo = 7) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Get today's date at midnight
 */
export function getTodayDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

