import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { getServiceClient, getUserFromToken } from '../lib/supabase.js';

const router = express.Router();

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

// Get executive overview metrics
router.get('/overview', authenticateToken, async (req, res) => {
  try {
    const supabase = getServiceClient();
    // Parallel queries for better performance
    const [
      employeesData,
      tasksData, 
      projectsData
    ] = await Promise.all([
      // Get all employees
      supabase
        .from('users')
        .select('department, role, created_at')
        .not('department', 'is', null),
      
      // Get all tasks - Remove updated_at since it doesn't exist
      supabase
        .from('tasks')
        .select('status, owner_id, created_at, due_date, priority'),
      
      // Get all projects
      supabase
        .from('projects')
        .select('status, created_at, updated_at')
    ]);

    const [employees, tasks, projects] = [
      employeesData.data || [],
      tasksData.data || [],
      projectsData.data || []
    ];

    // Calculate current date for comparisons
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Calculate overview metrics
    const totalEmployees = employees.length;
    const totalTasks = tasks.length;
    const totalProjects = projects.length;
    
    const activeTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status)).length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
    ).length;

    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const onHoldProjects = projects.filter(p => p.status === 'on-hold').length;

    // Calculate task completion rate
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const projectCompletionRate = totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0;

    // System activity - tasks created in last 30 days (only use created_at since updated_at doesn't exist for tasks)
    const recentActivity = tasks.filter(t => {
      const created = new Date(t.created_at);
      return created >= thirtyDaysAgo;
    }).length;

    res.json({
      companyKPIs: {
        totalEmployees,
        totalProjects,
        totalTasks,
        systemActivity: recentActivity
      },
      projectPortfolio: {
        total: totalProjects,
        active: activeProjects,
        completed: completedProjects,
        onHold: onHoldProjects,
        completionRate: projectCompletionRate
      },
      taskMetrics: {
        total: totalTasks,
        active: activeTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        completionRate: taskCompletionRate
      }
    });

  } catch (error) {
    console.error('Director overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get department performance data
router.get('/departments', async (req, res) => {
  try {
    const supabase = getServiceClient();
    
    // Get all users with their departments (not employees table)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, emp_id, name, department, role')
      .not('department', 'is', null);
    
    if (usersError) throw usersError;
    
    // Get all tasks with owner information
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id, owner_id, status, priority, created_at, due_date');
    
    if (taskError) throw taskError;
    
    // Get all projects with owner information  
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, owner_id, status');
    
    if (projError) throw projError;
    
    // Group users by department
    const departmentGroups = users.reduce((acc, user) => {
      if (!acc[user.department]) {
        acc[user.department] = [];
      }
      acc[user.department].push(user);
      return acc;
    }, {});
    
    // Calculate department performance
    const departments = Object.entries(departmentGroups).map(([dept, deptUsers]) => {
      const userIds = deptUsers.map(u => u.emp_id);
      
      // Tasks for this department
      const deptTasks = tasks.filter(t => userIds.includes(t.owner_id));
      const completedTasks = deptTasks.filter(t => t.status === 'completed');
      
      // Projects for this department
      const deptProjects = projects.filter(p => userIds.includes(p.owner_id));
      const completedProjects = deptProjects.filter(p => p.status === 'completed');
      
      // Calculate metrics - ensure all values are numbers
      const taskCompletionRate = deptTasks.length > 0 
        ? Math.round((completedTasks.length / deptTasks.length) * 100)
        : 0;
        
      const projectCompletionRate = deptProjects.length > 0
        ? Math.round((completedProjects.length / deptProjects.length) * 100)
        : 0;
      
      // Return as number, not string
      const tasksPerEmployee = deptUsers.length > 0
        ? parseFloat((deptTasks.length / deptUsers.length).toFixed(1))
        : 0.0;
      
      // Calculate productivity score (weighted average)
      const productivityScore = Math.round(
        (taskCompletionRate * 0.4) + 
        (projectCompletionRate * 0.3) + 
        (Math.min(tasksPerEmployee * 10, 30) * 0.3)
      );
      
      return {
        name: dept,
        employeeCount: deptUsers.length,
        taskCompletionRate,
        projectCompletionRate,  
        tasksPerEmployee, 
        productivityScore,
        totalTasks: deptTasks.length,
        totalProjects: deptProjects.length
      };
    });
    
    res.json({ departments });
    
  } catch (error) {
    console.error('Error fetching department performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get resource allocation metrics - Remove authentication temporarily
router.get('/resources', async (req, res) => {
  try {
    const supabase = getServiceClient();
    // Get employees with their task loads
    const { data: employees, error } = await supabase
      .from('users')
      .select(`
        emp_id,
        name,
        department,
        role,
        tasks_owned:tasks!tasks_owner_id_fkey(
          id,
          status,
          priority,
          due_date,
          created_at
        )
      `)
      .not('department', 'is', null);

    if (error) throw error;

    const now = new Date();
    const resourceData = employees.map(emp => {
      const tasks = emp.tasks_owned || [];
      const activeTasks = tasks.filter(t => ['pending', 'in_progress'].includes(t.status));
      const overdueTasks = tasks.filter(t => 
        t.status !== 'completed' && t.due_date && new Date(t.due_date) < now
      );
      const highPriorityTasks = activeTasks.filter(t => t.priority === 'high');

      // Calculate workload level
      let workloadLevel = 'underutilized';
      if (activeTasks.length >= 8) workloadLevel = 'overloaded';
      else if (activeTasks.length >= 5) workloadLevel = 'optimal';
      else if (activeTasks.length >= 2) workloadLevel = 'moderate';

      return {
        emp_id: emp.emp_id,
        name: emp.name,
        department: emp.department,
        role: emp.role,
        totalTasks: tasks.length,
        activeTasks: activeTasks.length,
        overdueTasks: overdueTasks.length,
        highPriorityTasks: highPriorityTasks.length,
        workloadLevel,
        workloadScore: activeTasks.length
      };
    });

    // Calculate department workload distribution
    const departmentWorkload = {};
    resourceData.forEach(emp => {
      const dept = emp.department;
      if (!departmentWorkload[dept]) {
        departmentWorkload[dept] = {
          name: dept,
          totalEmployees: 0,
          totalActiveTasks: 0,
          averageWorkload: 0,
          overloadedEmployees: 0,
          underutilizedEmployees: 0
        };
      }

      const deptStats = departmentWorkload[dept];
      deptStats.totalEmployees += 1;
      deptStats.totalActiveTasks += emp.activeTasks;
      
      if (emp.workloadLevel === 'overloaded') deptStats.overloadedEmployees += 1;
      if (emp.workloadLevel === 'underutilized') deptStats.underutilizedEmployees += 1;
    });

    // Calculate averages
    Object.keys(departmentWorkload).forEach(dept => {
      const stats = departmentWorkload[dept];
      stats.averageWorkload = stats.totalEmployees > 0 ? 
        Math.round((stats.totalActiveTasks / stats.totalEmployees) * 10) / 10 : 0;
    });

    res.json({
      employeeWorkloads: resourceData.sort((a, b) => b.workloadScore - a.workloadScore),
      departmentWorkloads: Object.values(departmentWorkload),
      summary: {
        totalEmployees: resourceData.length,
        overloadedCount: resourceData.filter(e => e.workloadLevel === 'overloaded').length,
        underutilizedCount: resourceData.filter(e => e.workloadLevel === 'underutilized').length,
        optimalCount: resourceData.filter(e => e.workloadLevel === 'optimal').length
      }
    });

  } catch (error) {
    console.error('Error fetching resource allocation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get risk indicators - Remove authentication temporarily  
router.get('/risks', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Get stagnant projects (not updated in 30+ days)
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, title, status, updated_at, created_at');

    if (projError) throw projError;

    const stagnantProjects = projects.filter(project => {
      const lastUpdate = new Date(project.updated_at || project.created_at);
      return project.status !== 'completed' && lastUpdate < thirtyDaysAgo;
    });

    // Get all overdue tasks across organization
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        priority,
        due_date,
        owner_id,
        created_at,
        task_owner:users!tasks_owner_id_fkey(name, department)
      `)
      .not('status', 'eq', 'completed')
      .not('due_date', 'is', null);

    if (taskError) throw taskError;

    const overdueTasks = tasks.filter(task => new Date(task.due_date) < now);

    // Get high-priority backlogs
    const { data: highPriorityTasks, error: hpError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        status,
        priority,
        created_at,
        owner_id,
        task_owner:users!tasks_owner_id_fkey(name, department)
      `)
      .eq('priority', 'high')
      .in('status', ['pending', 'in_progress']);

    if (hpError) throw hpError;

    // Calculate risk scores
    const riskMetrics = {
      stagnantProjects: {
        count: stagnantProjects.length,
        items: stagnantProjects.slice(0, 10), // Top 10 most stagnant
        riskLevel: stagnantProjects.length > 5 ? 'high' : stagnantProjects.length > 2 ? 'medium' : 'low'
      },
      overdueTasks: {
        count: overdueTasks.length,
        highPriorityOverdue: overdueTasks.filter(t => t.priority === 'high').length,
        byDepartment: getTasksByDepartment(overdueTasks),
        riskLevel: overdueTasks.length > 20 ? 'high' : overdueTasks.length > 10 ? 'medium' : 'low'
      },
      highPriorityBacklog: {
        count: highPriorityTasks.length,
        pending: highPriorityTasks.filter(t => t.status === 'pending').length,
        inProgress: highPriorityTasks.filter(t => t.status === 'in_progress').length,
        byDepartment: getTasksByDepartment(highPriorityTasks),
        riskLevel: highPriorityTasks.length > 15 ? 'high' : highPriorityTasks.length > 8 ? 'medium' : 'low'
      }
    };

    res.json(riskMetrics);

  } catch (error) {
    console.error('Error fetching risk indicators:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to group tasks by department
function getTasksByDepartment(tasks) {
  const byDept = {};
  tasks.forEach(task => {
    const dept = task.task_owner?.department || 'Unknown';
    byDept[dept] = (byDept[dept] || 0) + 1;
  });
  return byDept;
}

// Get cross-departmental collaboration metrics
router.get('/collaboration', async (req, res) => {
  try {
    const supabase = getServiceClient();
    // Get tasks with collaborators (if you have a collaborators field)
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        owner_id,
        collaborators,
        status,
        task_owner:users!tasks_owner_id_fkey(department)
      `);

    if (taskError) throw taskError;

    // Get projects with members
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        owner_id,
        members,
        status
      `);

    if (projError) throw projError;

    // Get user department mapping
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('emp_id, department');

    if (userError) throw userError;

    const userDeptMap = {};
    users.forEach(user => {
      userDeptMap[user.emp_id] = user.department;
    });

    // Analyze cross-departmental projects
    const crossDeptProjects = [];
    projects.forEach(project => {
      if (project.members && project.members.length > 1) {
        const departments = new Set();
        project.members.forEach(memberId => {
          if (userDeptMap[memberId]) {
            departments.add(userDeptMap[memberId]);
          }
        });
        
        if (departments.size > 1) {
          crossDeptProjects.push({
            ...project,
            departmentCount: departments.size,
            departments: Array.from(departments)
          });
        }
      }
    });

    // Calculate collaboration score
    const totalProjects = projects.length;
    const collaborationRate = totalProjects > 0 ? 
      Math.round((crossDeptProjects.length / totalProjects) * 100) : 0;

    res.json({
      crossDepartmentalProjects: crossDeptProjects,
      collaborationMetrics: {
        totalProjects,
        crossDeptProjects: crossDeptProjects.length,
        collaborationRate,
        averageDepartmentsPerProject: crossDeptProjects.length > 0 ? 
          Math.round((crossDeptProjects.reduce((sum, p) => sum + p.departmentCount, 0) / crossDeptProjects.length) * 10) / 10 : 0
      }
    });

  } catch (error) {
    console.error('Error fetching collaboration metrics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get company-wide KPIs - Remove authentication temporarily for testing
router.get('/kpis', async (req, res) => {
  try {
    const supabase = getServiceClient();
    
    // Get total users count (your employees are in the users table)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, emp_id, department, role, created_at')
      .not('department', 'is', null); // Only count users with departments
    
    if (usersError) throw usersError;
    
    // Get total projects count and status distribution
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, status, created_at, updated_at');
    
    if (projError) throw projError;
    
    // Get total tasks count and status distribution - Remove updated_at since it doesn't exist
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('id, status, priority, created_at, due_date');
    
    if (taskError) throw taskError;
    
    // Calculate project portfolio metrics
    const activeProjects = projects.filter(p => p.status === 'active').length;
    const completedProjects = projects.filter(p => p.status === 'completed').length;
    const onHoldProjects = projects.filter(p => p.status === 'on-hold').length;
    
    const projectPortfolio = {
      active: activeProjects,
      completed: completedProjects,
      onHold: onHoldProjects,
      completionRate: projects.length > 0 
        ? Math.round((completedProjects / projects.length) * 100)
        : 0
    };
    
    // Calculate task metrics
    const now = new Date();
    const activeTasks = tasks.filter(t => t.status === 'in-progress' || t.status === 'pending').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => 
      t.due_date && 
      new Date(t.due_date) < now && 
      t.status !== 'completed'
    ).length;
    
    const taskMetrics = {
      active: activeTasks,
      completed: completedTasks,
      overdue: overdueTasks,
      completionRate: tasks.length > 0
        ? Math.round((completedTasks / tasks.length) * 100)
        : 0
    };
    
    // Calculate system activity (tasks created in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = tasks.filter(t => 
      new Date(t.created_at) >= thirtyDaysAgo
    ).length;
    
    // Company KPIs calculated from actual data
    const companyKPIs = {
      totalEmployees: users.length,
      totalProjects: projects.length,
      totalTasks: tasks.length, 
      systemActivity: recentActivity
    };
    
    res.json({
      companyKPIs,
      projectPortfolio,
      taskMetrics
    });
    
  } catch (error) {
    console.error('Error calculating KPIs:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
