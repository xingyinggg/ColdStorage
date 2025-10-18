"use client";

import { useState} from "react";
import ManagerTasksView from "@/app/dashboard/tasks/components/ManagerTasksView";
import { useManagerTasks } from '@/utils/hooks/useManagerTasks';
import { useDirectorInsights } from "@/utils/hooks/useDirectorInsights";
import HeaderBar from "@/components/layout/HeaderBar";
import { StatCard } from "@/components/ui/StatCard";
import { Th, Td } from "@/components/ui/Table";

export default function DirectorDashboard({ user, userProfile, onLogout }) {
  const [activeSection, setActiveSection] = useState('overview');

  // existing manager hook
  const {
    allTasks,
    allProjects, 
    staffMembers,
    getTasksByStaff,
    updateTaskAssignment,
    loading: tasksLoading,
    error: tasksError
  } = useManagerTasks();
  
  const {
    loading,
    error,
    companyKPIs,
    projectPortfolio,
    taskMetrics,
    departmentPerformance,
    resourceAllocation,
    riskIndicators,
    collaborationMetrics,
    getTopPerformingDepartments,
    getUnderperformingDepartments,
    getOverloadedEmployees,
    getUnderutilizedEmployees,
    getOverallRiskLevel,
    refreshData
  } = useDirectorInsights();

  const formatPercentage = (value) => `${value}%`;
  const formatDecimal = (value) => {
    const num = parseFloat(value);
    return !isNaN(num) ? num.toFixed(1) : '0.0';
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getWorkloadColor = (level) => {
    switch (level) {
      case 'overloaded': return 'bg-red-100 text-red-800';
      case 'optimal': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-blue-100 text-blue-800';
      case 'underutilized': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading executive dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">Error loading dashboard</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={refreshData}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        title="Director Dashboard"
        user={user}
        userProfile={userProfile}
        roleLabel="Director"
        roleColor="purple"
        onLogout={onLogout}
      />

      {/* Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {/* Removed 'risks' from the tabs array */}
            {['overview', 'tasks', 'departments', 'resources', 'collaboration'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSection(tab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeSection === tab
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          
          {/* Overview Tab */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              {/* Company-wide KPIs */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Strategic Executive Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    color="purple" 
                    label="Total Employees" 
                    value={companyKPIs.totalEmployees} 
                  />
                  <StatCard 
                    color="blue" 
                    label="Total Projects" 
                    value={companyKPIs.totalProjects} 
                  />
                  <StatCard 
                    color="green" 
                    label="Total Tasks" 
                    value={companyKPIs.totalTasks} 
                  />
                </div>
              </div>

              {/* Project Portfolio Overview */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Project Portfolio Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{projectPortfolio.active}</div>
                      <div className="text-sm text-gray-600">Active Projects</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{projectPortfolio.completed}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">{projectPortfolio.onHold}</div>
                      <div className="text-sm text-gray-600">On Hold</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">{formatPercentage(projectPortfolio.completionRate)}</div>
                      <div className="text-sm text-gray-600">Completion Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task Metrics Overview */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Task Performance Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">{taskMetrics.active}</div>
                      <div className="text-sm text-gray-600">Active Tasks</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">{taskMetrics.completed}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-red-600">{taskMetrics.overdue}</div>
                      <div className="text-sm text-gray-600">Overdue</div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-lg shadow">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">{formatPercentage(taskMetrics.completionRate)}</div>
                      <div className="text-sm text-gray-600">Completion Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top & Bottom Performing Departments */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Top Performing Departments</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {getTopPerformingDepartments(3).map((dept, index) => (
                        <div key={dept.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              <span className="text-white text-sm font-bold">{index + 1}</span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{dept.name}</div>
                              <div className="text-sm text-gray-500">{dept.employeeCount} employees</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">{dept.productivityScore}</div>
                            <div className="text-sm text-gray-500">Score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Areas for Improvement</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      {getUnderperformingDepartments(3).map((dept) => (
                        <div key={dept.name} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{dept.name}</div>
                            <div className="text-sm text-gray-500">
                              {dept.employeeCount} employees • {formatPercentage(dept.taskCompletionRate)} task completion
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">{dept.productivityScore}</div>
                            <div className="text-sm text-gray-500">Score</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Risk section removed */}
            </div>
          )}

          {/* Tasks Tab */}
          {activeSection === 'tasks' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Task Management</h2>
              </div>
              {/* Wrapped in error boundary to catch any rendering issues */}
              <div className="bg-white shadow rounded-lg p-6">
                {tasksError ? (
                  <div className="text-center py-8">
                    <p className="text-red-500 mb-2">Error loading tasks</p>
                    <p className="text-gray-500">{tasksError}</p>
                  </div>
                ) : tasksLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading tasks...</p>
                  </div>
                ) : (
                  <ManagerTasksView 
                    currentUserEmpId={userProfile?.emp_id}
                    userRole="director"
                    tasks={allTasks || []} // Pass tasks explicitly
                  />
                )}
              </div>
            </div>
          )}

          {/* Departments Tab */}
          {activeSection === 'departments' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Department Performance Analysis</h2>
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <Th>Department</Th>
                        <Th align="center">Employees</Th>
                        <Th align="center">Tasks</Th>
                        <Th align="center">Task Completion</Th>
                        <Th align="center">Projects</Th>
                        <Th align="center">Project Completion</Th>
                        <Th align="center">Tasks/Employee</Th>
                        <Th align="center">Productivity Score</Th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {departmentPerformance.map((dept) => (
                        <tr key={dept.name} className="hover:bg-gray-50">
                          <Td>
                            <div className="font-medium text-gray-900">{dept.name}</div>
                          </Td>
                          <Td align="center">{dept.employeeCount}</Td>
                          <Td align="center">
                            <div>{dept.totalTasks}</div>
                            <div className="text-xs text-red-600">
                              {dept.overdueTasks > 0 && `${dept.overdueTasks} overdue`}
                            </div>
                          </Td>
                          <Td align="center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              dept.taskCompletionRate >= 80 ? 'bg-green-100 text-green-800' :
                              dept.taskCompletionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {formatPercentage(dept.taskCompletionRate)}
                            </span>
                          </Td>
                          <Td align="center">{dept.totalProjects}</Td>
                          <Td align="center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              dept.projectCompletionRate >= 80 ? 'bg-green-100 text-green-800' :
                              dept.projectCompletionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {formatPercentage(dept.projectCompletionRate)}
                            </span>
                          </Td>
                          <Td align="center">{formatDecimal(dept.tasksPerEmployee)}</Td>
                          <Td align="center">
                            <div className={`text-lg font-bold ${
                              dept.productivityScore >= 80 ? 'text-green-600' :
                              dept.productivityScore >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {dept.productivityScore}
                            </div>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Resources Tab */}
          {activeSection === 'resources' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-gray-900">Resource Utilization Analysis</h2>
              
              {/* Resource Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard color="red" label="Overloaded" value={resourceAllocation.summary.overloadedCount} />
                <StatCard color="green" label="Optimal Load" value={resourceAllocation.summary.optimalCount} />
                <StatCard color="blue" label="Moderate Load" value={resourceAllocation.summary.optimalCount} />
                <StatCard color="yellow" label="Underutilized" value={resourceAllocation.summary.underutilizedCount} />
              </div>

              {/* Department Workloads */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Department Workload Distribution</h3>
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <Th>Department</Th>
                          <Th align="center">Total Employees</Th>
                          <Th align="center">Active Tasks</Th>
                          <Th align="center">Avg. Workload</Th>
                          <Th align="center">Overloaded</Th>
                          <Th align="center">Underutilized</Th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {resourceAllocation.departmentWorkloads.map((dept) => (
                          <tr key={dept.name} className="hover:bg-gray-50">
                            <Td><div className="font-medium text-gray-900">{dept.name}</div></Td>
                            <Td align="center">{dept.totalEmployees}</Td>
                            <Td align="center">{dept.totalActiveTasks}</Td>
                            <Td align="center">{formatDecimal(dept.averageWorkload)}</Td>
                            <Td align="center">
                              <span className="text-red-600 font-medium">{dept.overloadedEmployees}</span>
                            </Td>
                            <Td align="center">
                              <span className="text-yellow-600 font-medium">{dept.underutilizedEmployees}</span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Employee Workload Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Overloaded Employees</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {getOverloadedEmployees(5).map((emp) => (
                        <div key={emp.emp_id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{emp.name}</div>
                            <div className="text-sm text-gray-500">{emp.department} • {emp.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">{emp.activeTasks}</div>
                            <div className="text-sm text-gray-500">active tasks</div>
                          </div>
                        </div>
                      ))}
                      {getOverloadedEmployees().length === 0 && (
                        <div className="text-center text-gray-500 py-4">No overloaded employees</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Underutilized Employees</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3">
                      {getUnderutilizedEmployees(5).map((emp) => (
                        <div key={emp.emp_id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{emp.name}</div>
                            <div className="text-sm text-gray-500">{emp.department} • {emp.role}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-yellow-600">{emp.activeTasks}</div>
                            <div className="text-sm text-gray-500">active tasks</div>
                          </div>
                        </div>
                      ))}
                      {getUnderutilizedEmployees().length === 0 && (
                        <div className="text-center text-gray-500 py-4">No underutilized employees</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Risks Tab - Commented out due to data fetching issues */}
          {/* {activeSection === 'risks' && (
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Risk Management Dashboard</h2>
                <div className={`px-4 py-2 rounded-lg ${getRiskColor(getOverallRiskLevel())}`}>
                  <span className="font-medium">Overall Risk: {getOverallRiskLevel().toUpperCase()}</span>
                </div>
              </div>

              {/* Risk Metrics Grid */}
              {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Stagnant Projects</h3>
                    <div className={`px-2 py-1 rounded text-sm font-medium ${getRiskColor(riskIndicators.stagnantProjects.riskLevel)}`}>
                      {riskIndicators.stagnantProjects.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-red-600 mb-2">{riskIndicators.stagnantProjects.count}</div>
                  <div className="text-sm text-gray-600">Projects not updated in 30+ days</div>
                  {riskIndicators.stagnantProjects.items.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-sm font-medium text-gray-700">Most Stagnant:</div>
                      {riskIndicators.stagnantProjects.items.slice(0, 3).map((project) => (
                        <div key={project.id} className="text-sm text-gray-600 truncate">
                          • {project.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Overdue Tasks</h3>
                    <div className={`px-2 py-1 rounded text-sm font-medium ${getRiskColor(riskIndicators.overdueTasks.riskLevel)}`}>
                      {riskIndicators.overdueTasks.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-red-600 mb-2">{riskIndicators.overdueTasks.count}</div>
                  <div className="text-sm text-gray-600">
                    {riskIndicators.overdueTasks.highPriorityOverdue} high priority overdue
                  </div>
                  
                  {Object.keys(riskIndicators.overdueTasks.byDepartment).length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">By Department:</div>
                      <div className="space-y-1">
                        {Object.entries(riskIndicators.overdueTasks.byDepartment)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 3)
                          .map(([dept, count]) => (
                            <div key={dept} className="flex justify-between text-sm">
                              <span className="text-gray-600">{dept}</span>
                              <span className="font-medium text-red-600">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">High Priority Backlog</h3>
                    <div className={`px-2 py-1 rounded text-sm font-medium ${getRiskColor(riskIndicators.highPriorityBacklog.riskLevel)}`}>
                      {riskIndicators.highPriorityBacklog.riskLevel.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-600 mb-2">{riskIndicators.highPriorityBacklog.count}</div>
                  <div className="text-sm text-gray-600">
                    {riskIndicators.highPriorityBacklog.pending} pending, {riskIndicators.highPriorityBacklog.inProgress} in progress
                  </div>
                  
                  {Object.keys(riskIndicators.highPriorityBacklog.byDepartment).length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-medium text-gray-700 mb-2">By Department:</div>
                      <div className="space-y-1">
                        {Object.entries(riskIndicators.highPriorityBacklog.byDepartment)
                          .sort(([,a], [,b]) => b - a)
                          .slice(0, 3)
                          .map(([dept, count]) => (
                            <div key={dept} className="flex justify-between text-sm">
                              <span className="text-gray-600">{dept}</span>
                              <span className="font-medium text-orange-600">{count}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          })} */}

          {/* Collaboration Tab */}
          {activeSection === 'collaboration' && (
            <div className="space-y-8">
              <h2 className="text-2xl font-bold text-gray-900">Cross-Departmental Collaboration</h2>
              
              {/* Collaboration Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard 
                  color="purple" 
                  label="Total Projects" 
                  value={collaborationMetrics.totalProjects || 0} 
                />
                <StatCard 
                  color="blue" 
                  label="Cross-Dept Projects" 
                  value={collaborationMetrics.crossDeptProjects || 0} 
                />
                <StatCard 
                  color="green" 
                  label="Collaboration Rate" 
                  value={`${collaborationMetrics.collaborationRate || 0}%`} 
                />
                <StatCard 
                  color="gray" 
                  label="Avg Depts/Project" 
                  value={collaborationMetrics.averageDepartmentsPerProject || '0.0'} 
                />
              </div>

              {/* Cross-Departmental Projects */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Cross-Departmental Projects</h3>
                </div>
                <div className="p-6">
                  {collaborationMetrics.crossDepartmentalProjects && collaborationMetrics.crossDepartmentalProjects.length > 0 ? (
                    <div className="space-y-4">
                      {collaborationMetrics.crossDepartmentalProjects.map((project) => (
                        <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">{project.title}</h4>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              project.status === 'active' ? 'bg-green-100 text-green-800' :
                              project.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {project.status}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">{project.departmentCount}</span> departments involved
                            </div>
                            <div>
                              Departments: {project.departments.join(', ')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <div className="text-lg mb-2">No cross-departmental projects found</div>
                      <div className="text-sm">Consider promoting collaboration across departments for better synergy</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}
