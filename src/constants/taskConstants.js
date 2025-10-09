// Task Priority and Status Constants

export const TASK_PRIORITIES = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const PRIORITY_LEVELS = ["low", "medium", "high"];

export const PRIORITY_COLORS = {
  high: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    dot: "bg-red-500",
  },
  medium: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    dot: "bg-orange-500",
  },
  low: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    dot: "bg-green-500",
  },
  default: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-500",
  },
};

export const TASK_STATUSES = {
  UNASSIGNED: "unassigned",
  ONGOING: "on going",
  UNDER_REVIEW: "under_review",
  COMPLETED: "completed",
};

export const STATUS_LEVELS = [
  "unassigned",
  "on going",
  "under_review",
  "completed",
];

// Helper function to get priority configuration
export const getPriorityConfig = (priority) => {
  const priorityKey = priority ? String(priority).toLowerCase() : null;
  return PRIORITY_COLORS[priorityKey] || PRIORITY_COLORS.default;
};
