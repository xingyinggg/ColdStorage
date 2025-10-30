"use client";

export default function ProjectCard({
  project,
  userEmpId,
  onGenerateReport,
  showTeamBadge = false,
  myProjects = [],
  teamProjects = []
}) {
  const isOwner =
    project.owner_id && String(project.owner_id) === String(userEmpId);
  const isMyProject = myProjects.some((p) => p.id === project.id);
  const isTeamProject = teamProjects.some((p) => p.id === project.id);

  return (
    <div className="w-full border border-gray-300 rounded-lg p-4 sm:p-5 bg-white hover:bg-gray-50 transition-colors break-words">
      {/* Project info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Title and badges */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
              {project.title}
            </h4>

            {isOwner ? (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                Owner
              </span>
            ) : isMyProject ? (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">
                Member
              </span>
            ) : null}

            {showTeamBadge && isTeamProject && !isMyProject && (
              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                Team Project
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-600 leading-snug break-words">
            {project.description || "No description"}
          </p>

          {/* Metadata */}
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
            <span>Status: {project.status || "—"}</span>
            <span>Members: {project.members?.length || 0}</span>
            <span>
              Created:{" "}
              {project.created_at
                ? new Date(project.created_at).toLocaleDateString()
                : "N/A"}
            </span>
          </div>
        </div>

        {/* Generate Report button — now contained inside the div */}
        <div className="w-full sm:w-auto">
          <button
            onClick={() => onGenerateReport("project-report", project)}
            className="w-full sm:w-auto bg-blue-600 text-white px-4 py-2 mt-2 sm:mt-0 rounded-lg hover:bg-blue-700 transition-colors text-sm text-center"
          >
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}
