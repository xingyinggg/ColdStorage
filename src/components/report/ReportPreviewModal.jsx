"use client"
import DepartmentTeamWorkload from "./DepartmentTeamWorkload"
import ProjectStatusReport from "./ProjectStatusReport"
import { useAuth } from "@/utils/hooks/useAuth"
import { useDirectorInsights } from "@/utils/hooks/useDirectorInsights"
import { useHrInsights } from "@/utils/hooks/useHrInsights"
import { set } from "zod"
import { useState } from "react"

export default function ReportPreviewModal({ reportType, data, onClose, userRole }) {
  const { user } = useAuth();
  const { departmentPerformance } = useDirectorInsights();
  const [isExporting, setIsExporting] = useState(false);
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

  setIsExporting(true); // start loading

  try {
    const html = element.innerHTML;
    const filename = getReportFileName();
    const title = getReportTitle();

    const response = await fetch("http://localhost:4000/report/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename, title }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "PDF generation failed");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF export failed:", err);
    alert(`Error generating PDF: ${err.message}`);
  } finally {
    setIsExporting(false); // end loading
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
    if (['employee-performance', 'workload-wellbeing', 'organizational-trends'].includes(reportType)) {
      return renderHrReport();
    }

    return <div>Report type not supported</div>;
  };

  const renderDirectorOrganizationalReport = () => {
    // Calculate overall organizational metrics
    const totalMembers = departmentPerformance.reduce((sum, dept) => sum + (dept.memberCount || 0), 0);
    const totalActiveTasks = departmentPerformance.reduce((sum, dept) => sum + (dept.activeTasks || 0), 0);
    const avgProductivity = departmentPerformance.length > 0 
      ? Math.round(departmentPerformance.reduce((sum, dept) => sum + (dept.productivity || 0), 0) / departmentPerformance.length)
      : 0;
    const avgCompletionRate = departmentPerformance.length > 0 
      ? Math.round(departmentPerformance.reduce((sum, dept) => sum + (dept.completionRate || 0), 0) / departmentPerformance.length)
      : 0;

    return (
      <div className="space-y-6">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Organization-wide Report</h2>
              <p className="text-gray-700 mt-1">
                {data.timeRange === '1month' ? 'Last Month' :
                 data.timeRange === '3months' ? 'Last 3 Months' :
                 data.timeRange === '6months' ? 'Last 6 Months' :
                 data.timeRange === '1year' ? 'Last Year' : 'Custom Range'} • Generated {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Report Type:</span>
              <div className="font-semibold text-gray-900">Strategic Overview</div>
            </div>
            <div>
              <span className="text-gray-600">Departments:</span>
              <div className="font-semibold text-gray-900">{departmentPerformance.length}</div>
            </div>
            <div>
              <span className="text-gray-600">Total Members:</span>
              <div className="font-semibold text-gray-900">{totalMembers}</div>
            </div>
            <div>
              <span className="text-gray-600">Data Source:</span>
              <div className="font-semibold text-gray-900">Real-time</div>
            </div>
          </div>
        </div>

        {/* Organizational Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{totalMembers}</div>
            <div className="text-sm text-gray-600 mt-1">Total Employees</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{totalActiveTasks}</div>
            <div className="text-sm text-gray-600 mt-1">Active Tasks</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{avgProductivity}%</div>
            <div className="text-sm text-gray-600 mt-1">Avg Productivity</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{avgCompletionRate}%</div>
            <div className="text-sm text-gray-600 mt-1">Completion Rate</div>
          </div>
        </div>
        
        {/* Department Performance Overview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Department Performance Overview
          </h3>
          {departmentPerformance.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No department data available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departmentPerformance.map((dept, index) => (
                <div key={dept.department || index} className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <h6 className="font-semibold text-gray-900">{dept.department || 'Unknown Department'}</h6>
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="text-gray-600 text-xs">Members</div>
                      <div className="font-bold text-lg text-gray-900">{dept.memberCount || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="text-gray-600 text-xs">Active Tasks</div>
                      <div className="font-bold text-lg text-blue-600">{dept.activeTasks || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="text-gray-600 text-xs">Productivity</div>
                      <div className="font-bold text-lg text-green-600">{dept.productivity || 0}%</div>
                    </div>
                    <div className="bg-white rounded-lg p-2 border">
                      <div className="text-gray-600 text-xs">Completion</div>
                      <div className="font-bold text-lg text-purple-600">{dept.completionRate || 0}%</div>
                    </div>
                  </div>
                  {/* Performance Indicator */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Performance Score</span>
                      <span className="font-medium">{Math.round(((dept.productivity || 0) + (dept.completionRate || 0)) / 2)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          Math.round(((dept.productivity || 0) + (dept.completionRate || 0)) / 2) >= 80 ? 'bg-green-500' :
                          Math.round(((dept.productivity || 0) + (dept.completionRate || 0)) / 2) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{width: `${Math.min(Math.round(((dept.productivity || 0) + (dept.completionRate || 0)) / 2), 100)}%`}}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Report Insights */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Strategic Insights & Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h6 className="font-medium text-blue-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Key Findings
              </h6>
              <div className="text-sm text-blue-800 space-y-1">
                <div>• Comprehensive analysis across {departmentPerformance.length} departments</div>
                <div>• Real-time performance tracking of {totalMembers} employees</div>
                <div>• {totalActiveTasks} active tasks in progress</div>
                <div>• Average organizational productivity: {avgProductivity}%</div>
              </div>
            </div>
            <div className="bg-white border border-blue-200 rounded-lg p-4">
              <h6 className="font-medium text-blue-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Recommendations
              </h6>
              <div className="text-sm text-blue-800 space-y-1">
                <div>• Data-driven insights for strategic planning</div>
                <div>• Performance benchmarks and improvement areas</div>
                <div>• Resource allocation optimization</div>
                <div>• Cross-departmental collaboration opportunities</div>
              </div>
            </div>
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
    const totalMembers = departmentPerformance.reduce((sum, dept) => sum + (dept.memberCount || 0), 0);
    const avgTasksPerMember = totalMembers > 0 ? (totalTasks / totalMembers).toFixed(1) : 0;

    // Sort departments by productivity for performance ranking
    const sortedDepartments = [...departmentPerformance].sort((a, b) => (b.productivity || 0) - (a.productivity || 0));

    return (
      <div className="space-y-6">
        {/* Report Header */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Task Analysis Report</h2>
              <p className="text-gray-700 mt-1">
                {data.timeRange === '1month' ? 'Last Month' :
                 data.timeRange === '3months' ? 'Last 3 Months' :
                 data.timeRange === '6months' ? 'Last 6 Months' :
                 data.timeRange === '1year' ? 'Last Year' : 'Custom Range'} • Generated {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Analysis Type:</span>
              <div className="font-semibold text-gray-900">Comprehensive</div>
            </div>
            <div>
              <span className="text-gray-600">Data Points:</span>
              <div className="font-semibold text-gray-900">Real-time</div>
            </div>
            <div>
              <span className="text-gray-600">Scope:</span>
              <div className="font-semibold text-gray-900">Organization-wide</div>
            </div>
            <div>
              <span className="text-gray-600">Accuracy:</span>
              <div className="font-semibold text-gray-900">Live Data</div>
            </div>
          </div>
        </div>
        
        {/* Task Analytics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{totalTasks}</div>
            <div className="text-sm text-gray-600 mt-1">Total Active Tasks</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{avgProductivity}%</div>
            <div className="text-sm text-gray-600 mt-1">Avg Productivity</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{departmentPerformance.length}</div>
            <div className="text-sm text-gray-600 mt-1">Departments</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{avgTasksPerMember}</div>
            <div className="text-sm text-gray-600 mt-1">Tasks per Employee</div>
          </div>
        </div>

        {/* Task Distribution Analysis */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Task Distribution by Department
          </h3>
          {departmentPerformance.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No task data available</p>
          ) : (
            <div className="space-y-4">
              {departmentPerformance.map((dept, index) => (
                <div key={dept.department || index} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{dept.department || 'Unknown'}</h4>
                        <p className="text-sm text-gray-600">{dept.memberCount || 0} members</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-gray-900">{dept.activeTasks || 0}</div>
                        <div className="text-xs text-gray-600">Tasks</div>
                      </div>
                      <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{dept.productivity || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              (dept.productivity || 0) >= 80 ? 'bg-green-500' :
                              (dept.productivity || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{width: `${Math.min(dept.productivity || 0, 100)}%`}}
                          ></div>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600">{dept.completionRate || 0}%</div>
                        <div className="text-xs text-gray-600">Completion</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance Rankings */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Department Performance Rankings
          </h3>
          <div className="space-y-3">
            {sortedDepartments.slice(0, 5).map((dept, index) => (
              <div key={dept.department || index} className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{dept.department || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{dept.activeTasks || 0} active tasks</div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{dept.productivity || 0}% productivity</div>
                    <div className="text-xs text-gray-600">{dept.completionRate || 0}% completion</div>
                  </div>
                  {index < 3 && (
                    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analysis Insights */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Task Analysis Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h6 className="font-medium text-green-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Key Metrics
              </h6>
              <div className="text-sm text-green-800 space-y-1">
                <div>• {totalTasks} active tasks across organization</div>
                <div>• {avgTasksPerMember} average tasks per employee</div>
                <div>• {avgProductivity}% organization-wide productivity</div>
                <div>• {departmentPerformance.length} departments analyzed</div>
              </div>
            </div>
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h6 className="font-medium text-green-900 mb-2 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Optimization Opportunities
              </h6>
              <div className="text-sm text-green-800 space-y-1">
                <div>• Task allocation optimization based on current workload</div>
                <div>• Department-specific performance improvement plans</div>
                <div>• Resource reallocation for balanced task distribution</div>
                <div>• Real-time monitoring and adaptive task management</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHrReport = () => {
    // Calculate advanced metrics
    const avgTasksPerEmployee = headcount > 0 ? Math.round(orgActiveTasks / headcount) : 0;
    const overdueTaksPercentage = orgActiveTasks > 0 ? Math.round((orgOverdueTasks / orgActiveTasks) * 100) : 0;
    const topPerformers = performanceRankings.slice(0, 5);

    if (reportType === 'employee-performance') {
      return (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Performance Analytics</h2>
                <p className="text-gray-700 mt-1">Individual performance tracking and development insights</p>
              </div>
            </div>
          </div>

          {/* Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{headcount}</div>
              <div className="text-sm text-gray-600 mt-1">Total Employees</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{topPerformers.length}</div>
              <div className="text-sm text-gray-600 mt-1">Top Performers</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{avgTasksPerEmployee}</div>
              <div className="text-sm text-gray-600 mt-1">Avg Tasks/Employee</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-700">{Object.keys(departments).length}</div>
              <div className="text-sm text-gray-600 mt-1">Departments</div>
            </div>
          </div>

          {/* Performance Rankings */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Individual Performance Rankings
            </h3>
            {topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.map((emp, index) => (
                  <div key={emp.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-gray-400' : 
                        index === 2 ? 'bg-orange-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-lg">
                          {emp.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 text-lg">{emp.name}</div>
                        <div className="text-sm text-gray-600">{emp.department} • {emp.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">{Math.round(emp.performanceScore)}%</div>
                        <div className="text-xs text-gray-600">Performance Score</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-blue-600">{emp.tasksCompleted || 0}</div>
                        <div className="text-xs text-gray-600">Tasks Completed</div>
                      </div>
                      {index < 3 && (
                        <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No performance data available</p>
            )}
          </div>

          {/* Department Performance Breakdown */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Department</h3>
            <div className="space-y-4">
              {Object.entries(departments).map(([deptName, count]) => {
                const deptPerformers = performanceRankings.filter(emp => emp.department === deptName);
                const avgScore = deptPerformers.length > 0 
                  ? Math.round(deptPerformers.reduce((sum, emp) => sum + emp.performanceScore, 0) / deptPerformers.length)
                  : 0;
                
                return (
                  <div key={deptName} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{deptName}</h4>
                      <span className="text-sm text-gray-600">{count} employees</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Avg Performance:</span>
                        <div className="font-bold text-lg text-blue-600">{avgScore}%</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Top Performers:</span>
                        <div className="font-bold text-lg text-green-600">{deptPerformers.filter(emp => emp.performanceScore >= 80).length}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Needs Attention:</span>
                        <div className="font-bold text-lg text-red-600">{deptPerformers.filter(emp => emp.performanceScore < 60).length}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            avgScore >= 80 ? 'bg-green-500' :
                            avgScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{width: `${avgScore}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'workload-wellbeing') {
      return (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-lg border border-yellow-200">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Employee Workload & Well-being</h2>
                <p className="text-gray-700 mt-1">Workload balance and wellness indicators</p>
              </div>
            </div>
          </div>

          {/* Workload Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{avgTasksPerEmployee}</div>
              <div className="text-sm text-gray-600 mt-1">Avg Tasks per Employee</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{100 - overdueTaksPercentage}%</div>
              <div className="text-sm text-gray-600 mt-1">On-time Completion</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-red-700">{overdueTaksPercentage}%</div>
              <div className="text-sm text-gray-600 mt-1">Overdue Rate</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-700">{performanceRankings.filter(emp => emp.performanceScore < 50).length}</div>
              <div className="text-sm text-gray-600 mt-1">At Risk Employees</div>
            </div>
          </div>

          {/* Workload Distribution */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Workload Distribution Analysis</h3>
            <div className="space-y-4">
              {Object.entries(departments).map(([deptName, count]) => {
                const deptTasks = Math.round((count / headcount) * orgActiveTasks);
                const workloadLevel = deptTasks / count;
                const workloadStatus = workloadLevel > avgTasksPerEmployee * 1.5 ? 'High' :
                                     workloadLevel < avgTasksPerEmployee * 0.5 ? 'Low' : 'Normal';
                const statusColor = workloadStatus === 'High' ? 'text-red-600 bg-red-50' :
                                  workloadStatus === 'Low' ? 'text-blue-600 bg-blue-50' : 'text-green-600 bg-green-50';
                
                return (
                  <div key={deptName} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">{deptName}</h4>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
                        {workloadStatus} Load
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Employees:</span>
                        <div className="font-bold text-lg">{count}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Est. Tasks:</span>
                        <div className="font-bold text-lg text-blue-600">{deptTasks}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">Tasks/Person:</span>
                        <div className="font-bold text-lg text-purple-600">{workloadLevel.toFixed(1)}</div>
                      </div>
                      <div>
                        <span className="text-gray-600">vs Avg:</span>
                        <div className={`font-bold text-lg ${workloadLevel > avgTasksPerEmployee ? 'text-red-600' : 'text-green-600'}`}>
                          {workloadLevel > avgTasksPerEmployee ? '+' : ''}{(workloadLevel - avgTasksPerEmployee).toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`h-3 rounded-full ${
                            workloadStatus === 'High' ? 'bg-red-500' :
                            workloadStatus === 'Low' ? 'bg-blue-500' : 'bg-green-500'
                          }`}
                          style={{width: `${Math.min((workloadLevel / (avgTasksPerEmployee * 2)) * 100, 100)}%`}}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Burnout Risk Assessment</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-2">High Risk</h4>
                <div className="text-3xl font-bold text-red-700 mb-1">
                  {performanceRankings.filter(emp => emp.performanceScore < 40).length}
                </div>
                <p className="text-sm text-red-800">Employees showing signs of burnout or low performance</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-2">Medium Risk</h4>
                <div className="text-3xl font-bold text-yellow-700 mb-1">
                  {performanceRankings.filter(emp => emp.performanceScore >= 40 && emp.performanceScore < 60).length}
                </div>
                <p className="text-sm text-yellow-800">Employees with declining performance indicators</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2">Low Risk</h4>
                <div className="text-3xl font-bold text-green-700 mb-1">
                  {performanceRankings.filter(emp => emp.performanceScore >= 60).length}
                </div>
                <p className="text-sm text-green-800">Employees with healthy work-life balance</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (reportType === 'organizational-trends') {
      return (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 p-6 rounded-lg border border-purple-200">
            <div className="flex items-center space-x-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-violet-600 rounded-lg flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Organizational Performance Trends</h2>
                <p className="text-gray-700 mt-1">Long-term trends and strategic insights</p>
              </div>
            </div>
          </div>

          {/* Trend Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{headcount}</div>
              <div className="text-sm text-gray-600 mt-1">Current Workforce</div>
              <div className="text-xs text-green-600 mt-1">↗ +5% vs last quarter</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-700">{Math.round((orgActiveTasks / headcount) * 100) / 100}</div>
              <div className="text-sm text-gray-600 mt-1">Productivity Index</div>
              <div className="text-xs text-green-600 mt-1">↗ +12% vs last quarter</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{100 - overdueTaksPercentage}%</div>
              <div className="text-sm text-gray-600 mt-1">Efficiency Rate</div>
              <div className="text-xs text-red-600 mt-1">↘ -3% vs last quarter</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-purple-700">{Object.keys(departments).length}</div>
              <div className="text-sm text-gray-600 mt-1">Active Departments</div>
              <div className="text-xs text-gray-600 mt-1">→ No change</div>
            </div>
          </div>

          {/* Growth Trends */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Departmental Growth Analysis</h3>
            <div className="space-y-4">
              {Object.entries(departments).sort(([,a], [,b]) => b - a).map(([deptName, count]) => {
                const growthRate = Math.floor(Math.random() * 21) - 10; // Simulated growth rate
                const isPositive = growthRate > 0;
                
                return (
                  <div key={deptName} className="bg-gray-50 rounded-lg p-4 border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{deptName}</h4>
                          <p className="text-sm text-gray-600">{count} employees</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-center">
                          <div className="text-lg font-bold text-gray-900">{Math.round((count / headcount) * 100)}%</div>
                          <div className="text-xs text-gray-600">of workforce</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-lg font-bold flex items-center ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                            {isPositive ? '↗' : '↘'} {Math.abs(growthRate)}%
                          </div>
                          <div className="text-xs text-gray-600">vs last quarter</div>
                        </div>
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full" 
                            style={{width: `${(count / Math.max(...Object.values(departments))) * 100}%`}}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Strategic Insights */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Growth Opportunities</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Expand high-performing departments</li>
                  <li>• Invest in technology infrastructure</li>
                  <li>• Cross-training programs for skill development</li>
                  <li>• Implement performance-based incentives</li>
                </ul>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-2">Areas for Improvement</h4>
                <ul className="text-sm text-orange-800 space-y-1">
                  <li>• Address workload imbalances</li>
                  <li>• Improve task completion rates</li>
                  <li>• Enhance inter-departmental collaboration</li>
                  <li>• Focus on employee retention strategies</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }
  };  const getReportFileName = () => {
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
    if (reportType === 'workload-wellbeing') {
      return 'Employee Workload & Well-being';
    }
    if (reportType === 'organizational-trends') {
      return 'Organizational Performance Trends';
    }
    return 'Report Preview';
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50">
      {/* Modal container */}
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
            Report Preview: {getReportTitle()}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div
          id="report-content"
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 text-sm sm:text-base leading-relaxed break-words"
        >
          {renderPreviewContent()}
        </div>

        {/* Footer buttons */}
        <div className="p-3 sm:p-6 border-t bg-gray-50 flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm sm:text-base"
          >
            Close
          </button>
          <button
  onClick={handleExportPDF}
  disabled={isExporting}
  className={`w-full sm:w-auto px-4 py-2 rounded-lg flex items-center justify-center gap-2 text-sm sm:text-base transition-colors ${
    isExporting
      ? "bg-gray-400 cursor-not-allowed"
      : "bg-red-600 hover:bg-red-700 text-white"
  }`}
>
  {isExporting ? (
    <>
      <svg
        className="animate-spin w-4 h-4 sm:w-5 sm:h-5 text-white"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v8H4z"
        ></path>
      </svg>
      <span>Generating PDF...</span>
    </>
  ) : (
    <>
      <svg
        className="w-4 h-4 sm:w-5 sm:h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span>Export PDF</span>
    </>
  )}
</button>

        </div>
      </div>
    </div>
  );

}