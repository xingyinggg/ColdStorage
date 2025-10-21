"use client";

export default function ProjectCard({
  project,
  userEmpId,
  onGenerateReport,
  showTeamBadge = false,
  myProjects = [],
  teamProjects = []
}) {
    
  const isOwner = project.owner_id && String(project.owner_id) === String(userEmpId);
  const isMyProject = myProjects.some(p => p.id === project.id);
  const isTeamProject = teamProjects.some(p => p.id === project.id);

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 border-gray-300">
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-gray-900">{project.title}</h4>
          {isOwner ? (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                Owner
            </span>
            ) : isMyProject ? (
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                Member
            </span>
            ) : null}
          {showTeamBadge && isTeamProject && !isMyProject && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
              Team Project
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600">{project.description || 'No description'}</p>
        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
          <span>Status: {project.status}</span>
          <span>Members: {project.members?.length || 0}</span>
          <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      <button
        onClick={() => onGenerateReport('project-report', project)}
        className="ml-4 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        Generate Report
      </button>
    </div>
  );
}