"use client";

import ProjectTaskCard from "./ProjectTaskCard";

export default function TaskColumn({ 
  title, 
  status, 
  tasks, 
  count, 
  bgColor, 
  dotColor, 
  countBadgeColor, 
  borderColor,
  onTaskUpdate,
  currentUserId,
  memberNames,
  projectNames
}) {
  const filteredTasks = tasks.filter(task => task.status === status);

  return (
    <div className={`${bgColor} rounded-lg p-3 sm:p-4`}>
      {/* Column Header */}
      <div className="flex items-center mb-3">
        <div className={`w-3 h-3 ${dotColor} rounded-full mr-2`}></div>
        <h6 className="font-medium text-gray-900 text-sm sm:text-base">
          {title}
        </h6>
        <span className={`ml-2 ${countBadgeColor} text-xs px-2 py-1 rounded-full`}>
          {count}
        </span>
      </div>

      {/* Task Cards */}
      <div className="space-y-2">
        {filteredTasks.map((task) => (
          <ProjectTaskCard
            key={task.id}
            task={task}
            borderColor={borderColor}
            onTaskUpdate={onTaskUpdate}
            currentUserId={currentUserId}
            memberNames={memberNames}
            projectNames={projectNames}
          />
        ))}
      </div>
    </div>
  );
}