import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get all employees with their profiles and stats
router.get('/employees', async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        *,
        tasks_assigned:tasks!tasks_assigned_to_fkey(count),
        tasks_completed:tasks!tasks_assigned_to_fkey(count).eq(status, 'completed')
      `);
    
    if (error) throw error;
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get HR dashboard insights/analytics
router.get('/insights', async (req, res) => {
  try {
    // Employee count by department
    const { data: deptStats, error: deptError } = await supabase
      .from('users')
      .select('department')
      .not('department', 'is', null);

    // Task completion rates
    const { data: taskStats, error: taskError } = await supabase
      .from('tasks')
      // .select('status, assigned_to, created_at');
      .select('status, owner_id, created_at, due_date');

    // Project statistics
    const { data: projectStats, error: projectError } = await supabase
      .from('projects')
      .select('status, created_at');

    if (deptError || taskError || projectError) {
      throw deptError || taskError || projectError;
    }

    // Process data for insights
    const departmentCounts = deptStats.reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {});

    const taskCompletionRate = taskStats.length > 0 
      ? (taskStats.filter(task => task.status === 'completed').length / taskStats.length) * 100
      : 0;

    // Count overdue tasks
    const overdueTasks = taskStats.filter(task => 
      task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date()
    ).length;

    res.json({
      totalEmployees: deptStats.length,
      departmentBreakdown: departmentCounts,
      totalTasks: taskStats.length,
      overdueTasks: overdueTasks,
      taskCompletionRate: Math.round(taskCompletionRate),
      totalProjects: projectStats.length,
      activeProjects: projectStats.filter(p => p.status === 'active').length
    });
  } catch (error) {
    console.error('HR insights error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get employee performance data
router.get('/performance', async (req, res) => {
  try {
    const { data: performance, error } = await supabase
      .from('users')
      .select(`
        emp_id,
        name,
        department,
        role,
        tasks_assigned:tasks!tasks_assigned_to_fkey(
          id,
          status,
          priority,
          due_date,
          created_at
        )
      `);

    if (error) throw error;

    // Calculate performance metrics for each employee
    const performanceData = performance.map(emp => {
      const tasks = emp.tasks_assigned || [];
      const completedTasks = tasks.filter(t => t.status === 'completed');
      const overdueTasks = tasks.filter(t => 
        t.status !== 'completed' && new Date(t.due_date) < new Date()
      );

      return {
        ...emp,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        overdueTasks: overdueTasks.length,
        completionRate: tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0
      };
    });

    res.json(performanceData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate HR reports
router.get('/reports/:type', async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate } = req.query;

  try {
    switch (type) {
      case 'productivity':
        // Productivity report logic
        const { data: productivityData, error: prodError } = await supabase
          .from('tasks')
          .select(`
            *,
            assigned_user:user_profiles!tasks_assigned_to_fkey(name, department)
          `)
          .gte('created_at', startDate || '2024-01-01')
          .lte('created_at', endDate || new Date().toISOString());

        if (prodError) throw prodError;
        res.json(productivityData);
        break;

      case 'department':
        // Department report logic
        const { data: deptData, error: deptErr } = await supabase
          .from('users')
          .select('department, role, created_at')
          .not('department', 'is', null);

        if (deptErr) throw deptErr;
        res.json(deptData);
        break;

      default:
        res.status(400).json({ error: 'Invalid report type' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update employee details (HR admin function)
router.put('/employees/:empId', async (req, res) => {
  const { empId } = req.params;
  const updates = req.body;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('emp_id', empId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get department workload data
router.get('/departments', async (req, res) => {
  try {
    // Get all employees grouped by department
    const { data: employees, error: empError } = await supabase
      .from('users')
      .select(`
        department,
        id,
        tasks_assigned:tasks!tasks_owner_id_fkey(
          id,
          status,
          due_date
        )
      `)
      .not('department', 'is', null);

    if (empError) throw empError;

    // Group employees by department and calculate stats
    const departmentStats = {};

    employees.forEach(emp => {
      const dept = emp.department;
      const tasks = emp.tasks_assigned || [];
      
      if (!departmentStats[dept]) {
        departmentStats[dept] = {
          name: dept,
          members: 0,
          active: 0,
          overdue: 0
        };
      }

      departmentStats[dept].members += 1;
      
      // Count active and overdue tasks for this employee
      tasks.forEach(task => {
        if (task.status === 'in_progress' || task.status === 'pending') {
          departmentStats[dept].active += 1;
        }
        if (task.status !== 'completed' && task.due_date && new Date(task.due_date) < new Date()) {
          departmentStats[dept].overdue += 1;
        }
      });
    });

    // Convert object to array
    const deptLoads = Object.values(departmentStats);

    res.json(deptLoads);
  } catch (error) {
    console.error('Department stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Employee Performance Rankings
router.get('/analytics/performance-rankings', async (req, res) => {
  try {
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        id, name, department, role,
        tasks_assigned:tasks!tasks_owner_id_fkey(
          status, due_date, priority, created_at
        )
      `);

    if (error) throw error;

    const rankings = employees.map(emp => {
      const tasks = emp.tasks_assigned || [];
      const completed = tasks.filter(t => t.status === 'completed').length;
      const overdue = tasks.filter(t => 
        t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()
      ).length;

      return {
        id: emp.id,
        name: emp.name,
        department: emp.department,
        totalTasks: tasks.length,
        completedTasks: completed,
        overdueRate: tasks.length > 0 ? (overdue / tasks.length) * 100 : 0,
        performanceScore: tasks.length > 0 ? ((completed - overdue) / tasks.length) * 100 : 0
      };
    }).sort((a, b) => b.performanceScore - a.performanceScore);

    res.json(rankings);
  } catch (error) {
    console.error('Performance rankings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Monthly/Weekly productivity trends
router.get('/analytics/trends', async (req, res) => {
  const { period = 'monthly' } = req.query;
  
  try {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('created_at, status, due_date')
      .order('created_at');

    // Group by time periods and calculate trends
    const trends = groupTasksByPeriod(tasks, period);
    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function groupTasksByPeriod(tasks, period) {
  const grouped = {};
  
  tasks.forEach(task => {
    const date = new Date(task.created_at);
    let key;
    
    if (period === 'monthly') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else if (period === 'weekly') {
      const week = Math.ceil(date.getDate() / 7);
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-W${week}`;
    }
    
    if (!grouped[key]) {
      grouped[key] = { period: key, total: 0, completed: 0 };
    }
    
    grouped[key].total++;
    if (task.status === 'completed') {
      grouped[key].completed++;
    }
  });
  
  return Object.values(grouped);
}

export default router;