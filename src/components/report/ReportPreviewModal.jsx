"use client"
import DepartmentTeamWorkload from "./DepartmentTeamWorkload"

export default function ReportPreviewModal({ reportType, data, onClose, userRole }) {
  const handleExportPDF = () => {
    // Dummy export function - in real implementation, this would generate and download a PDF
    const reportName = reportType === 'project-report' 
      ? `${data?.title || 'Project'} Report` 
      : 'Team Workload Report';
    alert(`PDF export for "${reportName}" would be generated here!`);
  };

  const renderPreviewContent = () => {
    if (reportType === 'project-report' && data) {
      return (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Project Report: {data.title}</h4>
          
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Project Status:</span>
                <div className="font-medium capitalize">{data.status}</div>
              </div>
              <div>
                <span className="text-gray-600">Team Members:</span>
                <div className="font-medium">{data.members?.length || 0}</div>
              </div>
              <div>
                <span className="text-gray-600">Created:</span>
                <div className="font-medium">{new Date(data.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <span className="text-gray-600">Last Updated:</span>
                <div className="font-medium">{new Date(data.updated_at).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium text-gray-700 mb-2">Description:</h5>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
              {data.description || 'No description provided'}
            </p>
          </div>
          
          {data.members && data.members.length > 0 && (
            <div className="max-h-40 overflow-y-auto">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Team Members:</h5>
              {data.members.map((member, index) => (
                <div key={index} className="border-b pb-2 mb-2 text-sm">
                  <div className="font-medium">{member.name}</div>
                  <div className="text-gray-600">{member.role} • {member.department}</div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-500 mt-4">
            This report will include detailed project timeline, task breakdown, member contributions, and progress analytics.
          </div>
        </div>
      );
    }

    if (reportType === 'team-workload') {
      const { teamWorkload, departmentTeams } = data;
      return (
        <div className="space-y-4">
          <DepartmentTeamWorkload
            teamWorkload={teamWorkload} 
            departmentTeams={departmentTeams} 
          />
        </div>
      );
    }
  };

  const getReportTitle = () => {
    if (reportType === 'project-report') {
      return `Project Report: ${data?.title || 'Unknown Project'}`;
    }
    if (reportType === 'team-workload') {
      return 'Team Workload Report';
    }
    return 'Report Preview';
  };

  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Report Preview: {getReportTitle()}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[68vh]">
          {renderPreviewContent()}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}