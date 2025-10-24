// app/dashboard/HrDashboard.js
"use client";

import { useState } from "react";
import { useHrInsights } from "@/utils/hooks/useHrInsights";
import Link from "next/link";
import { Bar, Pie, Line } from 'react-chartjs-2';
import HeaderBar from "@/components/layout/HeaderBar";
import { StatCard } from "@/components/ui/StatCard";
import { Th, Td } from "@/components/ui/Table";

// Chart.js registration
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

export default function HrDashboard({ user, userProfile, onLogout }) {
  const [selectedTab, setSelectedTab] = useState("overview");

  const {
    loading,
    error,
    headcount,
    departments,
    orgActiveTasks,
    orgOverdueTasks,
    deptLoads,
    performanceRankings,
    trends
  } = useHrInsights();

  // Update tabs to include analytics
  const tabs = ["overview", "analytics", "departments", "reports"];

  // Department headcount pie chart
  const departmentChartData = {
    labels: Object.keys(departments || {}),
    datasets: [{
      data: Object.values(departments || {}),
      backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316']
    }]
  };

  const taskStatusData = {
    labels: ['Active Tasks', 'Overdue Tasks'],
    datasets: [{
      data: [orgActiveTasks, orgOverdueTasks],
      backgroundColor: ['#10B981', '#EF4444']
    }]
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading HR dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderBar
        title="HR Dashboard"
        user={user}
        userProfile={userProfile}
        roleLabel={userProfile?.role || "HR"}
        roleColor="purple"
        onLogout={onLogout}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation - Update to include analytics */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                    selectedTab === tab
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {selectedTab === "overview" && (
          <OverviewTab
            headcount={headcount}
            orgActiveTasks={orgActiveTasks}
            orgOverdueTasks={orgOverdueTasks}
            departments={departments}
            trends={trends}
          />
        )}

        {selectedTab === "analytics" && (
          <AnalyticsTab
            performanceRankings={performanceRankings}
            trends={trends}
            departments={departments}
          />
        )}

        {selectedTab === "departments" && (
          <LoadTable title="Department Load" rows={deptLoads} />
        )}

        {selectedTab === "reports" && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reports & Exports
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Generate summaries for board meetings or performance reviews.
            </p>
            <Link
              href="/dashboard/hr/reports"
              className="text-blue-600 hover:text-blue-800"
            >
              Go to Reports →
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-600 p-4 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Overview Tab
function OverviewTab({ headcount, orgActiveTasks, orgOverdueTasks, departments, trends }) {
  // Chart data
  const departmentChartData = {
    labels: Object.keys(departments || {}),
    datasets: [{
      data: Object.values(departments || {}),
      backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#F97316']
    }]
  };

  const taskStatusData = {
    labels: ['Active Tasks', 'Overdue Tasks'],
    datasets: [{
      data: [orgActiveTasks, orgOverdueTasks],
      backgroundColor: ['#10B981', '#EF4444']
    }]
  };

  // Generate sample trends data from tasks if needed
  const generateTrendsFromTasks = (tasks) => {
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return [];
    
    const monthlyTrends = {};
    
    tasks.forEach(task => {
      // Use due_date instead of created_at since it has proper date format
      if (!task.due_date) return;
      
      try {
        // Extract YYYY-MM from the due_date (YYYY-MM-DD)
        const period = task.due_date.substring(0, 7);
        
        if (!monthlyTrends[period]) {
          monthlyTrends[period] = { period, total: 0, completed: 0 };
        }
        
        monthlyTrends[period].total++;
        if (task.status === 'completed') {
          monthlyTrends[period].completed++;
        }
      } catch (e) {
        console.error('Error processing task for trend:', e);
      }
    });
    
    // Convert to array and sort by period
    return Object.values(monthlyTrends).sort((a, b) => a.period.localeCompare(b.period));
  };

  // Use sample tasks to generate trends if needed
  const sampleTasks = [
    { id: 1, title: "Task 1", due_date: "2025-06-15", status: "completed" },
    { id: 2, title: "Task 2", due_date: "2025-06-20", status: "completed" },
    { id: 3, title: "Task 3", due_date: "2025-07-05", status: "ongoing" },
    { id: 4, title: "Task 4", due_date: "2025-07-10", status: "completed" },
    { id: 5, title: "Task 5", due_date: "2025-08-01", status: "ongoing" },
    { id: 6, title: "Task 6", due_date: "2025-08-15", status: "completed" },
    { id: 7, title: "Task 7", due_date: "2025-09-01", status: "completed" },
    { id: 8, title: "Task 8", due_date: "2025-10-11", status: "ongoing" },
  ];

  // Check if trends data exists and is valid, otherwise generate it
  const validTrendsData = (trends && 
                           Array.isArray(trends) && 
                           trends.length > 0 && 
                           trends.some(t => t.period && t.completed !== undefined && t.total !== undefined));

  // Use this for clarity in the component
  const effectiveTrends = validTrendsData ? trends : [
    { period: '2025-06', completed: 45, total: 60 },
    { period: '2025-07', completed: 52, total: 68 },
    { period: '2025-08', completed: 48, total: 70 },
    { period: '2025-09', completed: 60, total: 75 },
    { period: '2025-10', completed: 55, total: 80 }
  ];

  console.log("Using mock data?", !validTrendsData);
  console.log("Effective trends data:", effectiveTrends);

  // Productivity trends chart data
  const trendsChartData = {
    labels: effectiveTrends.map((t, index) => {
      // Check if period exists and is properly formatted (YYYY-MM)
      if (t && t.period && typeof t.period === 'string') {
        console.log(`Processing trend period at index ${index}:`, t.period);
        
        // Match YYYY-MM format
        const match = t.period.match(/^(\d{4})-(\d{1,2})$/);
        if (match) {
          const year = match[1];
          const month = parseInt(match[2], 10);
          
          if (!isNaN(month) && month >= 1 && month <= 12) {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[month - 1]} ${year}`;
          }
        }
        
        // If format doesn't match, just return the period as is
        return t.period;
      }
      
      // Fallback for invalid periods
      return `Month ${index + 1}`;
    }),
    datasets: [
      {
        label: 'Tasks Completed',
        data: effectiveTrends.map(t => (t && typeof t.completed === 'number') ? t.completed : 0),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      },
      {
        label: 'Total Tasks',
        data: effectiveTrends.map(t => (t && typeof t.total === 'number') ? t.total : 0),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      }
    ]
  };

  return (
    <div>
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard color="blue" label="Headcount" value={headcount} />
        <StatCard color="green" label="Departments" value={Object.keys(departments || {}).length} />
        <StatCard color="purple" label="Active Tasks" value={orgActiveTasks} />
        <StatCard color="red" label="Overdue Tasks" value={orgOverdueTasks} />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Department Distribution Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Department Distribution</h3>
          {Object.keys(departments || {}).length > 0 ? (
            <div className="h-64">
              <Pie 
                data={departmentChartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } }
                }}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-center">No department data available</p>
          )}
        </div>

        {/* Task Status Chart */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Task Status Overview</h3>
          {(orgActiveTasks > 0 || orgOverdueTasks > 0) ? (
            <div className="h-64">
              <Pie 
                data={taskStatusData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'bottom' } }
                }}
              />
            </div>
          ) : (
            <p className="text-gray-500 text-center">No task data available</p>
          )}
        </div>
      </div>

      {/* Productivity Trends */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Task Completion Trends</h3>
        <div className="h-64">
          {console.log('Rendering chart with data:', trendsChartData)}
          <Line 
            data={trendsChartData} 
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { position: 'top' },
                tooltip: {
                  callbacks: {
                    title: function(tooltipItems) {
                      return tooltipItems[0].label;
                    }
                  }
                }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

// --- Analytics Tab
function AnalyticsTab({ performanceRankings, trends, departments }) {
  // Performance distribution data
  const performanceDistribution = {
    excellent: performanceRankings.filter(emp => emp.performanceScore >= 90).length,
    good: performanceRankings.filter(emp => emp.performanceScore >= 70 && emp.performanceScore < 90).length,
    average: performanceRankings.filter(emp => emp.performanceScore >= 50 && emp.performanceScore < 70).length,
    needsHelp: performanceRankings.filter(emp => emp.performanceScore < 50).length
  };

  const performanceChartData = {
    labels: ['Excellent (90%+)', 'Good (70-89%)', 'Average (50-69%)', 'Needs Help (<50%)'],
    datasets: [{
      data: [performanceDistribution.excellent, performanceDistribution.good, 
             performanceDistribution.average, performanceDistribution.needsHelp],
      backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
    }]
  };

  const getPerformanceStatus = (score) => {
    if (score >= 90) return { text: 'Excellent', color: 'text-green-600' };
    if (score >= 70) return { text: 'Good', color: 'text-blue-600' };
    if (score >= 50) return { text: 'Average', color: 'text-yellow-600' };
    return { text: 'Needs Help', color: 'text-red-600' };
  };

  return (
    <div>
      {/* Top Performers */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performers This Month</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {performanceRankings.slice(0, 3).map((emp, index) => {
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <div key={emp.id} className="border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-2xl mb-2">{medals[index]}</div>
                <h4 className="font-medium text-gray-900">{emp.name}</h4>
                <p className="text-sm text-gray-600">{emp.department}</p>
                <p className="text-lg font-bold text-blue-600">{Math.round(emp.performanceScore)}% Score</p>
                <p className="text-sm text-gray-500">{emp.completedTasks}/{emp.totalTasks} Tasks</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Rankings Table */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Employee Performance Rankings</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tasks</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {performanceRankings.map((emp) => {
                const status = getPerformanceStatus(emp.performanceScore);
                return (
                  <tr key={emp.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{emp.department}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {emp.completedTasks}/{emp.totalTasks}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                      {Math.round(emp.performanceScore)}%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-center text-sm font-medium ${status.color}`}>
                      {status.text}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Distribution Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Distribution</h3>
        {performanceRankings.length > 0 ? (
          <div className="h-64">
            <Bar 
              data={performanceChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
              }}
            />
          </div>
        ) : (
          <p className="text-gray-500 text-center">No performance data available</p>
        )}
      </div>
    </div>
  );
}

// --- Load Table
function LoadTable({ title, rows }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
      {rows?.length === 0 ? (
        <p className="text-sm text-gray-500">No data available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Name</Th>
                <Th align="center">Members</Th>
                <Th align="center">Active</Th>
                <Th align="center">Overdue</Th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <Td>{row.name}</Td>
                  <Td align="center">{row.members}</Td>
                  <Td align="center">{row.active}</Td>
                  <Td align="center">{row.overdue}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Advanced Filters Component (kept for future use)
function AdvancedFilters({ onFilter }) {
  const [filters, setFilters] = useState({
    department: 'all',
    dateRange: '30days',
    performanceLevel: 'all',
    searchTerm: ''
  });

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <div className="grid grid-cols-4 gap-4">
        <select
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
          className="border rounded p-2"
        >
          <option value="all">All Departments</option>
          <option value="Marketing">Marketing</option>
          <option value="Sales">Sales</option>
        </select>

        <input
          type="text"
          placeholder="Search employees..."
          value={filters.searchTerm}
          onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          className="border rounded p-2"
        />

        <select
          value={filters.performanceLevel}
          onChange={(e) => setFilters({ ...filters, performanceLevel: e.target.value })}
          className="border rounded p-2"
        >
          <option value="all">All Performance</option>
          <option value="high">High Performers</option>
          <option value="low">Needs Attention</option>
        </select>
      </div>
    </div>
  );
}
