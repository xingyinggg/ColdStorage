// React Hook to bridge React frontend and Express.js backend
import { useState, useEffect } from 'react';

export function useHrInsights() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [headcount, setHeadcount] = useState(0);
  const [departments, setDepartments] = useState({});
  const [orgActiveTasks, setOrgActiveTasks] = useState(0);
  const [orgOverdueTasks, setOrgOverdueTasks] = useState(0);
  const [performanceRankings, setPerformanceRankings] = useState([]);
  const [trends, setTrends] = useState([]);
  const [deptLoads, setDeptLoads] = useState([]);

  useEffect(() => {
    const fetchHrData = async () => {
      try {
        setLoading(true);
        
        // Fetch insights
        const insightsResponse = await fetch('http://localhost:4000/hr/insights');
        const insightsData = await insightsResponse.json();
        
        // Optional endpoints - handle errors gracefully
        let deptData = [], perfData = [], trendsData = [];
        
        try {
          const deptResponse = await fetch('http://localhost:4000/hr/departments');
          if (deptResponse.ok) deptData = await deptResponse.json();
        } catch (e) { console.warn('Departments endpoint not available'); }
        
        // fetch performance rankings
        try {
          const perfResponse = await fetch('http://localhost:4000/hr/analytics/performance-rankings');
          if (perfResponse.ok) perfData = await perfResponse.json();
        } catch (e) { console.warn('Performance rankings not available'); }
        
        // fetch trends data
        try {
          const trendsResponse = await fetch('http://localhost:4000/hr/analytics/trends?period=monthly');
          if (trendsResponse.ok) trendsData = await trendsResponse.json();
        } catch (e) { console.warn('Trends data not available'); }
        
        // Set data
        setHeadcount(insightsData.totalEmployees);
        setDepartments(insightsData.departmentBreakdown);
        setOrgActiveTasks(insightsData.totalTasks);
        setOrgOverdueTasks(insightsData.overdueTasks || 0);
        setDeptLoads(deptData);
        setPerformanceRankings(perfData);
        setTrends(trendsData);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHrData();
  }, []);

  return {
    loading,
    error,
    headcount,
    departments,
    orgActiveTasks,
    orgOverdueTasks,
    deptLoads,
    performanceRankings,
    trends
  };
}