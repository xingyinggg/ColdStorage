"use client";

import { useState, useEffect, useCallback } from 'react';

export function useDirectorInsights() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allTasks, setAllTasks] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  
  // State for all data sections
  const [companyKPIs, setCompanyKPIs] = useState({
    totalEmployees: 0,
    totalProjects: 0,
    totalTasks: 0,
    systemActivity: 0
  });
  
  const [projectPortfolio, setProjectPortfolio] = useState({
    active: 0,
    completed: 0,
    onHold: 0,
    completionRate: 0
  });
  
  const [taskMetrics, setTaskMetrics] = useState({
    active: 0,
    completed: 0,
    overdue: 0,
    completionRate: 0
  });
  
  const [departmentPerformance, setDepartmentPerformance] = useState([]);
  const [resourceAllocation, setResourceAllocation] = useState({
    summary: {
      overloadedCount: 0,
      optimalCount: 0,
      underutilizedCount: 0
    },
    departmentWorkloads: [],
    overloadedEmployees: [],
    underutilizedEmployees: []
  });
  
  const [riskIndicators, setRiskIndicators] = useState({
    stagnantProjects: {
      count: 0,
      riskLevel: 'low',
      items: []
    },
    overdueTasks: {
      count: 0,
      riskLevel: 'low',
      highPriorityOverdue: 0,
      byDepartment: {}
    },
    highPriorityBacklog: {
      count: 0,
      riskLevel: 'low',
      pending: 0,
      inProgress: 0,
      byDepartment: {}
    }
  });
  
  const [collaborationMetrics, setCollaborationMetrics] = useState({
    totalProjects: 0,
    crossDeptProjects: 0,
    collaborationRate: 0,
    averageDepartmentsPerProject: '0.0',
    crossDepartmentalProjects: []
  });

  const fetchDirectorData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching director data...');

      const headers = {
        'Content-Type': 'application/json'
      };

      const [
        kpiResponse,
        deptResponse,
        resourceResponse,
        riskResponse,
        collabResponse
      ] = await Promise.all([
        fetch('http://localhost:4000/director/kpis', { headers }),
        fetch('http://localhost:4000/director/departments', { headers }),
        fetch('http://localhost:4000/director/resources', { headers }),
        fetch('http://localhost:4000/director/risks', { headers }),
        fetch('http://localhost:4000/director/collaboration', { headers })
      ]);

      // Check for errors with better logging
      console.log('Response status:', {
        kpi: kpiResponse.status,
        dept: deptResponse.status,
        resource: resourceResponse.status,
        risk: riskResponse.status,
        collab: collabResponse.status
      });

      if (!kpiResponse.ok) {
        const errorText = await kpiResponse.text();
        console.error('KPI Response error:', errorText);
        throw new Error(`Failed to fetch KPIs: ${kpiResponse.status} - ${errorText}`);
      }
      
      if (!deptResponse.ok) {
        const errorText = await deptResponse.text();
        console.error('Department Response error:', errorText);
        throw new Error(`Failed to fetch department data: ${deptResponse.status} - ${errorText}`);
      }
      
      if (!resourceResponse.ok) {
        const errorText = await resourceResponse.text();
        console.error('Resource Response error:', errorText);
        throw new Error(`Failed to fetch resource data: ${resourceResponse.status} - ${errorText}`);
      }
      
      if (!riskResponse.ok) {
        const errorText = await riskResponse.text();
        console.error('Risk Response error:', errorText);
        throw new Error(`Failed to fetch risk data: ${riskResponse.status} - ${errorText}`);
      }
      
      if (!collabResponse.ok) {
        const errorText = await collabResponse.text();
        console.error('Collaboration Response error:', errorText);
        throw new Error(`Failed to fetch collaboration data: ${collabResponse.status} - ${errorText}`);
      }

      // Parse all responses
      const kpiData = await kpiResponse.json();
      const deptData = await deptResponse.json();
      const resourceData = await resourceResponse.json();
      const riskData = await riskResponse.json();
      const collabData = await collabResponse.json();

      console.log('Parsed data:', { kpiData, deptData, resourceData, riskData, collabData });

      // Update state with fetched data
      setCompanyKPIs(kpiData.companyKPIs || {
        totalEmployees: 0,
        totalProjects: 0,
        totalTasks: 0,
        systemActivity: 0
      });

      setProjectPortfolio(kpiData.projectPortfolio || {
        active: 0,
        completed: 0,
        onHold: 0,
        completionRate: 0
      });

      setTaskMetrics(kpiData.taskMetrics || {
        active: 0,
        completed: 0,
        overdue: 0,
        completionRate: 0
      });

      setDepartmentPerformance(deptData.departments || []);
      
      setResourceAllocation({
        summary: resourceData.summary || { overloadedCount: 0, optimalCount: 0, underutilizedCount: 0 },
        departmentWorkloads: resourceData.departmentWorkloads || [],
        overloadedEmployees: resourceData.employeeWorkloads?.filter(e => e.workloadLevel === 'overloaded') || [],
        underutilizedEmployees: resourceData.employeeWorkloads?.filter(e => e.workloadLevel === 'underutilized') || []
      });

      setRiskIndicators(riskData || {
        stagnantProjects: { count: 0, riskLevel: 'low', items: [] },
        overdueTasks: { count: 0, riskLevel: 'low', highPriorityOverdue: 0, byDepartment: {} },
        highPriorityBacklog: { count: 0, riskLevel: 'low', pending: 0, inProgress: 0, byDepartment: {} }
      });

      setCollaborationMetrics({
        totalProjects: collabData.collaborationMetrics?.totalProjects || 0,
        crossDeptProjects: collabData.collaborationMetrics?.crossDeptProjects || 0,
        collaborationRate: collabData.collaborationMetrics?.collaborationRate || 0,
        averageDepartmentsPerProject: collabData.collaborationMetrics?.averageDepartmentsPerProject?.toString() || '0.0',
        crossDepartmentalProjects: collabData.crossDepartmentalProjects || []
      });

    } catch (err) {
      console.error('Error fetching director data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all tasks for directors
  const fetchAllTasks = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/tasks/director/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const body = await res.json();
      setAllTasks(body.tasks || []);
    } catch (err) {
      console.error('Error fetching all tasks:', err);
      setError(err.message);
      setAllTasks([]);
    }
  }, []);

  // Fetch all projects for directors
  const fetchAllProjects = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/projects/director/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const body = await res.json();
      setAllProjects(body.projects || []);
    } catch (err) {
      console.error('Error fetching all projects:', err);
      setError(err.message);
      setAllProjects([]);
    }
  }, []);

  // Fetch all staff members for directors
  const fetchStaffMembers = useCallback(async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const res = await fetch(`${apiUrl}/tasks/director/staff-members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }
      const body = await res.json();
      setStaffMembers(body.staffMembers || []);
    } catch (err) {
      console.error('Error fetching staff members:', err);
      setError(err.message);
      setStaffMembers([]);
    }
  }, []);

  // Get tasks by staff member
  const getTasksByStaff = useCallback((empId) => {
    return allTasks.filter(task => 
      task.collaborators && task.collaborators.includes(empId)
    );
  }, [allTasks]);

  // Update task assignment
  const updateTaskAssignment = useCallback(async (taskId, collaborators, updates) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      
      const res = await fetch(`${apiUrl}/tasks/director/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ collaborators, ...updates }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Request failed: ${res.status}`);
      }

      // Refresh tasks after update
      await fetchAllTasks();
    } catch (err) {
      console.error('Error updating task assignment:', err);
      setError(err.message);
    }
  }, [fetchAllTasks]);

  useEffect(() => {
    fetchDirectorData();
    fetchAllTasks();
    fetchAllProjects();
    fetchStaffMembers();
  }, [fetchDirectorData, fetchAllTasks, fetchAllProjects, fetchStaffMembers]);

  // Utility functions
  const getTopPerformingDepartments = useCallback((limit = 5) => {
    return [...departmentPerformance]
      .sort((a, b) => b.productivityScore - a.productivityScore)
      .slice(0, limit);
  }, [departmentPerformance]);

  const getUnderperformingDepartments = useCallback((limit = 5) => {
    return [...departmentPerformance]
      .sort((a, b) => a.productivityScore - b.productivityScore)
      .slice(0, limit);
  }, [departmentPerformance]);

  const getOverloadedEmployees = useCallback((limit) => {
    const employees = resourceAllocation.overloadedEmployees || [];
    return limit ? employees.slice(0, limit) : employees;
  }, [resourceAllocation.overloadedEmployees]);

  const getUnderutilizedEmployees = useCallback((limit) => {
    const employees = resourceAllocation.underutilizedEmployees || [];
    return limit ? employees.slice(0, limit) : employees;
  }, [resourceAllocation.underutilizedEmployees]);

  const getOverallRiskLevel = useCallback(() => {
    const risks = [
      riskIndicators.stagnantProjects.riskLevel,
      riskIndicators.overdueTasks.riskLevel,
      riskIndicators.highPriorityBacklog.riskLevel
    ];
    
    if (risks.includes('high')) return 'high';
    if (risks.includes('medium')) return 'medium';
    return 'low';
  }, [riskIndicators]);

  const refreshData = useCallback(() => {
    fetchDirectorData();
  }, [fetchDirectorData]);

  return {
    loading,
    error,
    companyKPIs,
    projectPortfolio,
    taskMetrics,
    departmentPerformance,
    resourceAllocation,
    riskIndicators,
    collaborationMetrics,
    allTasks,
    allProjects,
    staffMembers,
    getTasksByStaff,
    updateTaskAssignment,
    getTopPerformingDepartments,
    getUnderperformingDepartments,
    getOverloadedEmployees,
    getUnderutilizedEmployees,
    getOverallRiskLevel,
    refreshData,
    getTasksByStaff,
    updateTaskAssignment
  };
}
