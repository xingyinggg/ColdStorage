"use client";

import { useState} from "react";
import Link from "next/link";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { useAuth } from "@/utils/hooks/useAuth";
import { useTasks } from "@/utils/hooks/useTasks";
import { useDepartmentTeams } from "@/utils/hooks/useDepartmentTeams";
import { useProjects } from "@/utils/hooks/useProjects";
import { useDirectorInsights } from "@/utils/hooks/useDirectorInsights";
import ProjectCard from "@/components/report/ProjectCard"
import ReportPreviewModal from "@/components/report/ReportPreviewModal"

export default function ReportPage() {
  const { user, userProfile, isManager, isDirector, loading } = useAuth();
  console.log("test", isManager, "isDirector", isDirector);
  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex justify-center items-center h-screen">
          <p className="text-gray-500">Loading your data...</p>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-6">
              {/* Header with back button */}
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 mb-2">Reports</h1>
                </div>
                <Link
                  href="/dashboard"
                  className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
                >
                  Back to Dashboard
                </Link>
              </div>
              
              {isDirector ? <DirectorReports /> : isManager ? <ManagerReports /> : <StaffReports />}
            </div>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}


function StaffReports() {
  const [showPreview, setShowPreview] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const { user, userProfile } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects(user);

  const handleGenerateReport = (type, project = null) => {
    setReportType(type);
    setSelectedProject(project);
    setShowPreview(true);
  };

  // Only filter when data is loaded
  const myProjects = projectsLoading ? [] : projects.filter(project => {
    const isOwner = project.owner_id && String(project.owner_id) === String(userProfile?.emp_id);
    const isMember = project.members && Array.isArray(project.members) && 
                     project.members.includes(String(userProfile?.emp_id));
    return isOwner || isMember;
  });

  return (
    <div className="space-y-6">
      {/* My Projects Overview */}
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          My Projects {projectsLoading ? (
            <span className="text-sm text-gray-500 font-normal">(Loading...)</span>
          ) : (
            `(${myProjects.length})`
          )}
        </h3>
        
        {myProjects.length === 0 ? (
          <p className="text-gray-500 text-center py-8">You are not assigned to any projects yet.</p>
        ) : (
          <div className="space-y-3">
            {myProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                userEmpId={userProfile?.emp_id}
                onGenerateReport={handleGenerateReport}
                showTeamBadge={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      {showPreview && (
        <ReportPreviewModal
          reportType={reportType}
          data={selectedProject}
          onClose={() => setShowPreview(false)}
          userRole="staff"
        />
      )}
    </div>
  );
}

function DirectorReports() {
  const [showPreview, setShowPreview] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [selectedData, setSelectedData] = useState(null);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const { user, userProfile } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects(user);
  const { departmentPerformance, collaborationMetrics, loading: insightsLoading } = useDirectorInsights();

  const handleGenerateReport = (type, data = null) => {
    setReportType(type);
    setSelectedData(data);
    setShowPreview(true);
  };

  // Get unique departments for filter
  const departments = departmentPerformance?.map(dept => dept.name) || [];
  const uniqueDepartments = ['all', ...new Set(departments)];

  // Filter projects based on department selection
  const filteredProjects = departmentFilter === 'all' 
    ? projects 
    : projects.filter(project => {
        // This would need to be enhanced based on how projects are associated with departments
        return true; // For now, show all projects
      });

  // Generate organizational report data
  const getOrganizationalReportData = () => {
    const filteredDepartments = departmentFilter === 'all' 
      ? departmentPerformance 
      : departmentPerformance.filter(dept => dept.name === departmentFilter);

    return {
      departments: filteredDepartments,
      collaborationMetrics,
      filter: departmentFilter,
      summary: {
        totalDepartments: filteredDepartments.length,
        totalEmployees: filteredDepartments.reduce((sum, dept) => sum + dept.employeeCount, 0),
        totalTasks: filteredDepartments.reduce((sum, dept) => sum + dept.totalTasks, 0),
        totalProjects: filteredDepartments.reduce((sum, dept) => sum + dept.totalProjects, 0),
        avgTaskCompletion: filteredDepartments.length > 0 
          ? Math.round(filteredDepartments.reduce((sum, dept) => sum + dept.taskCompletionRate, 0) / filteredDepartments.length)
          : 0,
        avgProjectCompletion: filteredDepartments.length > 0
          ? Math.round(filteredDepartments.reduce((sum, dept) => sum + dept.projectCompletionRate, 0) / filteredDepartments.length)
          : 0
      }
    };
  };

  const loading = projectsLoading || insightsLoading;

  return (
    <div className="space-y-6">
      {/* Department Filter */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Organization Reports</h3>
          <div className="flex items-center space-x-2">
            <label htmlFor="department-filter" className="text-sm text-gray-600">
              Filter by Department:
            </label>
            <select
              id="department-filter"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={loading}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Organizational Report Card */}
      <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-grow">
            <h3 className="text-lg font-medium text-gray-900">
              {departmentFilter === 'all' ? 'Organization-wide Report' : `${departmentFilter} Department Report`}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {departmentFilter === 'all' 
                ? 'Generate comprehensive report for entire organization and all departments'
                : `Generate detailed report for ${departmentFilter} department performance and metrics`
              }
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Includes: Department performance, task distribution, project status, collaboration metrics, and productivity analysis
            </div>
          </div>
          
          <button
            onClick={() => handleGenerateReport('organizational-report', getOrganizationalReportData())}
            className={`px-4 py-2 rounded-lg transition-colors ml-4 ${
              !loading
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Task-based Reports */}
      <div className="border rounded-lg p-6 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-grow">
            <h3 className="text-lg font-medium text-gray-900">Task-based Analysis Report</h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate reports based on task status, priorities, and completion rates across the organization
            </p>
            <div className="mt-2 text-xs text-gray-500">
              Includes: Task status breakdown, priority analysis, overdue tracking, and completion trends
            </div>
          </div>
          
          <button
            onClick={() => handleGenerateReport('task-analysis', { 
              departments: departmentPerformance,
              filter: departmentFilter,
              type: 'task-analysis'
            })}
            className={`px-4 py-2 rounded-lg transition-colors ml-4 ${
              !loading
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Report'}
          </button>
        </div>
      </div>

      {/* Projects Overview (if showing all departments) */}
      {departmentFilter === 'all' && (
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            All Projects Overview {loading ? (
              <span className="text-sm text-gray-500 font-normal">(Loading...)</span>
            ) : (
              `(${projects.length})`
            )}
          </h3>
          
          {projects.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No projects found in the organization.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {projects.slice(0, 10).map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  userEmpId={userProfile?.emp_id}
                  onGenerateReport={(type, projectData) => handleGenerateReport('project-report', projectData)}
                  showTeamBadge={false}
                />
              ))}
              {projects.length > 10 && (
                <div className="text-center py-2 text-sm text-gray-500">
                  Showing 10 of {projects.length} projects. Use organizational report for complete view.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Report Preview Modal */}
      {showPreview && (
        <ReportPreviewModal
          reportType={reportType}
          data={selectedData}
          onClose={() => setShowPreview(false)}
          userRole="director"
        />
      )}
    </div>
  );
}

function ManagerReports() {
  const [showPreview, setShowPreview] = useState(false);
  const [reportType, setReportType] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectFilter, setProjectFilter] = useState('my'); // Start with 'my' instead of 'all'
  const { user, userProfile } = useAuth();
  const { projects = [], loading: projectsLoading } = useProjects(user);
  const { departmentTeams = [], teamWorkload = {}, loading: workloadLoading, error: workloadError } = useDepartmentTeams();

  const handleGenerateReport = (type, project = null) => {
    setReportType(type);
    setSelectedProject(project);
    setShowPreview(true);
  };

  // Check if user has a team (only when not loading)
  const hasTeam = !workloadLoading && departmentTeams.length > 0;
  const teamName = hasTeam ? departmentTeams[0].team_name : null;

  // Get COMPLETE team member list (manager + members)
  const allTeamMemberIds = hasTeam ? [
    ...departmentTeams[0].member_ids || [],
    ...departmentTeams[0].manager_ids || []
  ] : [];

  // Sort for comparison
  const sortedTeamMemberIds = allTeamMemberIds.map(id => String(id)).sort();

  // Only filter when data is loaded
  const myProjects = projectsLoading ? [] : projects.filter(project => {
    const isOwner = project.owner_id && String(project.owner_id) === String(userProfile?.emp_id);
    const isMember = project.members && Array.isArray(project.members) && 
                     project.members.includes(String(userProfile?.emp_id));
    return isOwner || isMember;
  });

  // Team projects - projects where members list EXACTLY matches department team
  const teamProjects = (projectsLoading || !hasTeam) ? [] : projects.filter(project => {
    if (!project.members || !Array.isArray(project.members)) return false;
    
    let projectMemberIds = [...project.members];
    if (project.owner_id && !projectMemberIds.includes(String(project.owner_id))) {
      projectMemberIds.push(String(project.owner_id));
    }
    
    const sortedProjectMembers = projectMemberIds.map(id => String(id)).sort();
    
    const exactMatch = sortedProjectMembers.length === sortedTeamMemberIds.length &&
                      sortedProjectMembers.every((id, index) => id === sortedTeamMemberIds[index]);
    
    return exactMatch;
  });

  // Get filtered projects based on selected filter
  const getFilteredProjects = () => {
    if (projectsLoading) return []; // Return empty array while loading
    
    switch (projectFilter) {
      case 'my':
        return myProjects;
      case 'team':
        return teamProjects;
      case 'all':
      default:
        const combinedProjects = [...myProjects];
        teamProjects.forEach(teamProject => {
          if (!combinedProjects.some(myProject => myProject.id === teamProject.id)) {
            combinedProjects.push(teamProject);
          }
        });
        return combinedProjects;
    }
  };

  const filteredProjects = getFilteredProjects();

  const getReportData = () => {
    if (reportType === 'project-report') return selectedProject;
    if (reportType === 'team-workload') return { teamWorkload, departmentTeams };
    return null;
  };

  // Calculate counts for dropdown options (avoid recalculating on each render)
  const allProjectsCount = projectsLoading ? 0 : myProjects.length + teamProjects.filter(tp => !myProjects.some(mp => mp.id === tp.id)).length;

  return (
    <div className="space-y-6">
      {/* Single Projects Section with Filter */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Projects {projectsLoading ? (
              <span className="text-sm text-gray-500 font-normal">(Loading...)</span>
            ) : (
              `(${filteredProjects.length})`
            )}
          </h3>
          
          {/* Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <label htmlFor="project-filter" className="text-sm text-gray-600">
              Show:
            </label>
            <select
              id="project-filter"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={projectsLoading}
            >
              <option value="my">My Projects ({myProjects.length})</option>
              {hasTeam && (
                <option value="team">
                  {teamName} Team Projects ({teamProjects.length})
                </option>
              )}
              <option value="all">All Projects ({allProjectsCount})</option>
            </select>
          </div>
        </div>
        
        {filteredProjects.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            {projectFilter === 'my' && "You're not personally assigned to any projects."}
            {projectFilter === 'team' && "No projects found that exactly match your team composition."}
            {projectFilter === 'all' && "No projects found."}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              userEmpId={userProfile?.emp_id} // Fixed: was userProfile?.userEmpId
              onGenerateReport={handleGenerateReport}
              showTeamBadge={true}
              myProjects={myProjects}
              teamProjects={teamProjects}
            />
          ))}
          </div>
        )}
      </div>

      {/* Team Workload Report Card */}
      <div className={`border rounded-lg p-6 ${hasTeam ? 'hover:shadow-md' : 'bg-gray-50'} transition-shadow`}>
        <div className="flex items-center justify-between">
          <div className="flex-grow">
            <h3 className="text-lg font-medium text-gray-900">Team Workload Report</h3>
            
            {/* {workloadLoading ? (
              <div className="mt-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600 mt-1">
                  {hasTeam 
                    ? `Generate team workload report for ${teamName}` 
                    : 'You are not managing any team'
                  }
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  {hasTeam ? (
                    <>Includes: Individual workloads, overdue tasks, task distribution, and team performance metrics</>
                  ) : (
                    <>Contact your administrator to be assigned as a team manager</>
                  )}
                </div>
              </>
            )} */}
            
            {/* Show error status */}
            {workloadError && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                Error: {workloadError}
              </div>
            )}
          </div>
          
          <button
            onClick={() => handleGenerateReport('team-workload')}
            className={`px-4 py-2 rounded-lg transition-colors ml-4 ${
              hasTeam && !workloadLoading
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            disabled={!hasTeam || workloadLoading}
          >
            {workloadLoading ? 'Loading...' : hasTeam ? 'Generate Report' : 'No Team'}
          </button>
        </div>
      </div>

      {/* Report Preview Modal */}
      {showPreview && (
        <ReportPreviewModal
          reportType={reportType}
          data={getReportData()}
          onClose={() => setShowPreview(false)}
          userRole="manager"
        />
      )}
    </div>
  );
}