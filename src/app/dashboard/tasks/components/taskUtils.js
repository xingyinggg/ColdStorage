export function formatDate(dateString) {
  if (!dateString) return "No due date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getPriorityColor(priority) {
  if (priority === null || priority === undefined) {
    return "bg-gray-100 text-gray-800 border-gray-200";
  }
  
  const numPriority = Number(priority);
  
  // 1-3: Low (green)
  if (numPriority >= 1 && numPriority <= 3) {
    return "bg-green-100 text-green-800 border-green-200";
  }
  // 4-6: Medium (yellow)
  if (numPriority >= 4 && numPriority <= 6) {
    return "bg-yellow-100 text-yellow-800 border-yellow-200";
  }
  // 7-10: High (red)
  if (numPriority >= 7 && numPriority <= 10) {
    return "bg-red-100 text-red-800 border-red-200";
  }
  
  return "bg-gray-100 text-gray-800 border-gray-200";
}

export function getStatusColor(status) {
  switch (status?.toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}


