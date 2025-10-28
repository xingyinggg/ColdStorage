"use client"
import DepartmentTeamWorkload from "./DepartmentTeamWorkload"
import ProjectStatusReport from "./ProjectStatusReport"
import { useAuth } from "@/utils/hooks/useAuth"
import { useDirectorInsights } from "@/utils/hooks/useDirectorInsights"
import { useHrInsights } from "@/utils/hooks/useHrInsights"

export default function ReportPreviewModal({ reportType, data, onClose, userRole }) {
  const { user } = useAuth();
  const { departmentPerformance } = useDirectorInsights();
  const { 
    headcount, 
    departments, 
    orgActiveTasks, 
    orgOverdueTasks, 
    performanceRankings 
  } = useHrInsights();
  const handleExportPDF = async () => {
    const element = document.querySelector("#report-content");
    if (!element) {
      alert("Report content not found!");
      return;
    }

    try {
      // Show loading state
      const originalText = document.querySelector('button[onclick*="handleExportPDF"]')?.textContent;
      const exportButton = document.querySelector('button[onclick*="handleExportPDF"]');
      if (exportButton) {
        exportButton.disabled = true;
        exportButton.textContent = 'Generating PDF...';
      }

      const html = element.innerHTML;
      const filename = getReportFileName();
      const title = getReportTitle();
      
      // Call your Express backend
      const response = await fetch('http://localhost:4000/report/generate-pdf', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html, filename, title })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'PDF generation failed');
      }
      
      // Download the PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Reset button
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.textContent = originalText;
      }
      
    } catch (err) {
      console.error("PDF export failed:", err);
      alert(`Error generating PDF: ${err.message}`);
      
      // Reset button on error
      const exportButton = document.querySelector('button[onclick*="handleExportPDF"]');
      if (exportButton) {
        exportButton.disabled = false;
        exportButton.textContent = 'Export PDF';
      }
    }
  };

  const renderPreviewContent = () => {
    if (reportType === 'project-report' && data) {
      // Use enhanced report for both staff and managers
      return (
        <div className="space-y-4">
          <ProjectStatusReport project={data} />
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

    // Director Reports
    if (reportType === 'organizational-report') {
      return renderDirectorOrganizationalReport();
    }

    if (reportType === 'task-analysis') {
      return renderDirectorTaskAnalysis();
    }

    // HR Reports
    if (['employee-performance', 'team-collaboration', 'workload-wellbeing', 'organizational-trends'].includes(reportType)) {
      return renderHrReport();
    }

    return <div>Report type not supported</div>;
  };

  const renderDirectorOrganizationalReport = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🏢</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-gray-900">Organization-wide Report</h4>
            <p className="text-sm text-gray-500">
              {data.timeRange === '1month' ? 'Last Month' :
               data.timeRange === '3months' ? 'Last 3 Months' :
               data.timeRange === '6months' ? 'Last 6 Months' :
               data.timeRange === '1year' ? 'Last Year' : 'Custom Range'} • Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Real Department Performance Data */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h5 className="text-lg font-medium text-blue-900 mb-4">Department Performance Overview</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentPerformance.map((dept, index) => (
              <div key={dept.department || index} className="bg-white rounded-lg p-4 border">
                <h6 className="font-medium text-gray-900 mb-2">{dept.department || 'Unknown Department'}</h6>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Members:</span>
                    <span className="font-medium">{dept.memberCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Productivity:</span>
                    <span className="font-medium text-green-600">{dept.productivity || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Active Tasks:</span>
                    <span className="font-medium">{dept.activeTasks || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completion Rate:</span>
                    <span className="font-medium text-blue-600">{dept.completionRate || 0}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h6 className="font-medium text-blue-900 mb-2">📊 Report Summary</h6>
          <div className="text-sm text-blue-800 space-y-1">
            <div>• Comprehensive analysis of organizational performance across all departments</div>
            <div>• Real-time data from task completion and project management systems</div>
            <div>• Performance metrics calculated from actual database records</div>
            <div>• Strategic insights for organizational improvement and resource allocation</div>
          </div>
        </div>
      </div>
    );
  };

  const renderDirectorTaskAnalysis = () => {
    // Calculate task distribution from real department data
    const totalTasks = departmentPerformance.reduce((sum, dept) => sum + (dept.activeTasks || 0), 0);
    const avgProductivity = departmentPerformance.length > 0 
      ? Math.round(departmentPerformance.reduce((sum, dept) => sum + (dept.productivity || 0), 0) / departmentPerformance.length)
      : 0;

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <span className="text-2xl">📈</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-gray-900">Task Analysis Report</h4>
            <p className="text-sm text-gray-500">
              {data.timeRange === '1month' ? 'Last Month' :
               data.timeRange === '3months' ? 'Last 3 Months' :
               data.timeRange === '6months' ? 'Last 6 Months' :
               data.timeRange === '1year' ? 'Last Year' : 'Custom Range'} • Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Real Task Analytics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">Total Active Tasks</p>
            <p className="text-2xl font-bold text-blue-700">{totalTasks}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-900">Avg Productivity</p>
            <p className="text-2xl font-bold text-green-700">{avgProductivity}%</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-900">Departments</p>
            <p className="text-2xl font-bold text-purple-700">{departmentPerformance.length}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-900">Analysis Type</p>
            <p className="text-2xl font-bold text-orange-700">Real-time</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h5 className="text-lg font-medium text-green-900 mb-4">Task Distribution by Department</h5>
          <div className="space-y-3">
            {departmentPerformance.map((dept, index) => (
              <div key={dept.department || index} className="flex items-center justify-between bg-white rounded p-3">
                <span className="font-medium text-gray-900">{dept.department || 'Unknown'}</span>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">{dept.activeTasks || 0} tasks</span>
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{width: `${Math.min((dept.activeTasks || 0) / Math.max(totalTasks, 1) * 100, 100)}%`}}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-green-600">{dept.productivity || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h6 className="font-medium text-green-900 mb-2">🎯 Analysis Highlights</h6>
          <div className="text-sm text-green-800 space-y-1">
            <div>• Task analysis based on real organizational data and performance metrics</div>
            <div>• Department productivity calculated from actual task completion rates</div>
            <div>• Live insights from current task assignments and project statuses</div>
            <div>• Data-driven recommendations for task allocation optimization</div>
          </div>
        </div>
      </div>
    );
  };

  const renderHrReport = () => {
    const reportTitles = {
      'employee-performance': 'Employee Performance Analytics',
      'team-collaboration': 'Team Collaboration Analysis', 
      'workload-wellbeing': 'Employee Workload & Well-being',
      'organizational-trends': 'Organizational Performance Trends'
    };

    const reportIcons = {
      'employee-performance': '👤',
      'team-collaboration': '🤝',
      'workload-wellbeing': '⚖️', 
      'organizational-trends': '📊'
    };

    const reportDescriptions = {
      'employee-performance': 'Individual employee performance metrics and improvement areas',
      'team-collaboration': 'Cross-team collaboration patterns and communication effectiveness',
      'workload-wellbeing': 'Employee workload balance and wellness indicators',
      'organizational-trends': 'Company-wide performance trends and growth metrics'
    };

    const reportColors = {
      'employee-performance': 'blue',
      'team-collaboration': 'green',
      'workload-wellbeing': 'yellow',
      'organizational-trends': 'purple'
    };

    const color = reportColors[reportType];

    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
            <span className="text-2xl">{reportIcons[reportType]}</span>
          </div>
          <div>
            <h4 className="text-xl font-semibold text-gray-900">{reportTitles[reportType]}</h4>
            <p className="text-sm text-gray-500">
              {data.timeRange === '1month' ? 'Last Month' :
               data.timeRange === '3months' ? 'Last 3 Months' :
               data.timeRange === '6months' ? 'Last 6 Months' :
               data.timeRange === '1year' ? 'Last Year' : 'Custom Range'} • Generated {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Real HR Data Integration */}
        <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-6`}>
          <h5 className={`text-lg font-medium text-${color}-900 mb-4`}>Real HR Analytics Data</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-blue-700">{headcount}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Active Tasks</p>
              <p className="text-2xl font-bold text-green-700">{orgActiveTasks}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Departments</p>
              <p className="text-2xl font-bold text-purple-700">{Object.keys(departments).length}</p>
            </div>
            <div className="bg-white rounded-lg p-4 border">
              <p className="text-sm text-gray-600">Overdue Tasks</p>
              <p className="text-2xl font-bold text-red-700">{orgOverdueTasks}</p>
            </div>
          </div>
          
          {/* Performance Rankings Preview */}
          {performanceRankings.length > 0 && (
            <div className="bg-white rounded-lg p-4 border">
              <h6 className="font-medium text-gray-900 mb-3">Top Performers</h6>
              <div className="space-y-2">
                {performanceRankings.slice(0, 3).map((emp, index) => (
                  <div key={emp.id} className="flex items-center justify-between text-sm">
                    <span>#{index + 1} {emp.name}</span>
                    <span className="text-green-600 font-medium">{Math.round(emp.performanceScore)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={`bg-${color}-50 border border-${color}-200 rounded-lg p-4`}>
          <h6 className={`font-medium text-${color}-900 mb-2`}>🎯 Report Features</h6>
          <div className={`text-sm text-${color}-800 space-y-1`}>
            <div>• {reportDescriptions[reportType]}</div>
            <div>• Real-time data from employee performance and task completion systems</div>
            <div>• Advanced analytics with actionable insights and recommendations</div>
            <div>• Integration with organizational goals and performance benchmarks</div>
          </div>
        </div>
      </div>
    );
  };

  const getReportFileName = () => {
    switch(reportType) {
      case 'project-report':
        return `${data?.title || "Project"}_Report.pdf`;
      case 'team-workload':
        return "Team_Workload_Report.pdf";
      case 'organizational-report':
        return `Organization_Report_${data?.filter || 'All'}_${new Date().toISOString().split('T')[0]}.pdf`;
      case 'task-analysis':
        return `Task_Analysis_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      case 'employee-performance':
        return `Employee_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      case 'team-collaboration':
        return `Team_Collaboration_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      case 'workload-wellbeing':
        return `Workload_Wellbeing_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      case 'organizational-trends':
        return `Organizational_Trends_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      default:
        return "Report.pdf";
    }
  };

  const getReportTitle = () => {
    if (reportType === 'project-report') {
      return `Project Report: ${data?.title || 'Unknown Project'}`;
    }
    if (reportType === 'team-workload') {
      return 'Team Workload Report';
    }
    if (reportType === 'organizational-report') {
      return data?.filter === 'all' ? 'Organization-wide Report' : `${data?.filter} Department Report`;
    }
    if (reportType === 'task-analysis') {
      return 'Task Analysis Report';
    }
    if (reportType === 'employee-performance') {
      return 'Employee Performance Analytics';
    }
    if (reportType === 'team-collaboration') {
      return 'Team Collaboration Analysis';
    }
    if (reportType === 'workload-wellbeing') {
      return 'Employee Workload & Well-being';
    }
    if (reportType === 'organizational-trends') {
      return 'Organizational Performance Trends';
    }
    return 'Report Preview';
  };

  return (
    <div className="fixed inset-0 bg-black/10 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white z-10">
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

        <div id='report-content' className="p-6">
          {renderPreviewContent()}
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end space-x-3 sticky bottom-0">
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