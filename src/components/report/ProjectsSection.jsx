"use client";

import ProjectCard from "./ProjectCard";

export default function ProjectsSection({
  title,
  projects,
  loading,
  userProfile,
  onGenerateReport,
  showTeamBadge = false,
  emptyMessage = "No projects found.",
  maxHeight = null,
  showCount = true,
  children
}) {
  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {title}{" "}
        {loading ? (
          <span className="text-sm text-gray-500 font-normal">(Loading...)</span>
        ) : showCount ? (
          `(${projects.length})`
        ) : null}
      </h3>

      {projects.length === 0 ? (
        <p className="text-gray-500 text-center py-8">{emptyMessage}</p>
      ) : (
        <div className={`space-y-3 ${maxHeight ? `${maxHeight} overflow-y-auto` : ''}`}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              userEmpId={userProfile?.emp_id}
              onGenerateReport={onGenerateReport}
              showTeamBadge={showTeamBadge}
            />
          ))}
          {children}
        </div>
      )}
    </div>
  );
}