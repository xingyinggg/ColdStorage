// tests/e2e/mocks/tasks.js
export const mockTasks = [
  {
    id: "t1",
    title: "Overdue task example",
    dueDate: "2025-10-27T09:00:00+08:00", // before 2025-10-28 SGT -> overdue
    status: "open",
  },
  {
    id: "t2",
    title: "Due today",
    dueDate: "2025-10-28T23:59:00+08:00",
    status: "open",
  },
  {
    id: "t3",
    title: "Future task",
    dueDate: "2025-10-30T10:00:00+08:00",
    status: "open",
  },
];
