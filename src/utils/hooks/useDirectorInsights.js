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

      const headers = {
        'Content-Type': 'application/json'
      };

      const [
        kpiResponse,
        deptResponse,
        collabResponse
      ] = await Promise.all([
        fetch('http://localhost:4000/director/kpis', { 
          headers,
          credentials: 'include' // Include cookies for authentication
        }),
        fetch('http://localhost:4000/director/departments', { 
          headers,
          credentials: 'include' // Include cookies for authentication
        }),
        fetch('http://localhost:4000/director/collaboration', { 
          headers,
          credentials: 'include' // Include cookies for authentication
        })
      ]);

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
      
      if (!collabResponse.ok) {
        const errorText = await collabResponse.text();
        console.error('Collaboration Response error:', errorText);
        throw new Error(`Failed to fetch collaboration data: ${collabResponse.status} - ${errorText}`);
      }

      // Parse all responses
      const kpiData = await kpiResponse.json();
      const deptData = await deptResponse.json();
      const collabData = await collabResponse.json();

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

      setDepartmentPerformance(deptData.departments?.map(dept => ({
        department: dept.name,
        memberCount: dept.employeeCount,
        activeTasks: dept.totalTasks,
        productivity: dept.productivityScore,
        completionRate: dept.taskCompletionRate,
        totalProjects: dept.totalProjects
      })) || []);
      
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
      // Use cookie authentication instead of token
      const res = await fetch(`${apiUrl}/tasks/director/all`, {
        credentials: 'include', // Include cookies in the request
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
      // Use cookie authentication instead of token
      const res = await fetch(`${apiUrl}/projects/director/all`, {
        credentials: 'include', // Include cookies in the request
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
      // Use cookie authentication instead of token
      const res = await fetch(`${apiUrl}/tasks/director/staff-members`, {
        credentials: 'include', // Include cookies in the request
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
        },
        credentials: 'include', // Include cookies in the request
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
    // Commenting out these API calls to avoid "Not found" errors
    // fetchAllTasks();
    // fetchAllProjects();
    // fetchStaffMembers();
  }, [fetchDirectorData]);

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
    collaborationMetrics,
    allTasks,
    allProjects,
    staffMembers,
    getTasksByStaff,
    updateTaskAssignment,
    getTopPerformingDepartments,
    getUnderperformingDepartments,
    refreshData,
    getTasksByStaff,
    updateTaskAssignment
  };
}
