import express from 'express';
import { getServiceClient, getUserFromToken } from '../lib/supabase.js';

const router = express.Router();

// Get executive overview metrics
router.get('/overview', async (req, res) => {
  try {
    const supabase = getServiceClient();
    // Parallel queries for better performance
    const [
      employeesData,
      tasksData, 
      projectsData
    ] = await Promise.all([
      // Get all employees (including directors without departments)
      supabase
        .from('users')
        .select('department, role, created_at'),
      
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
    
    // Get all users with their departments (exclude directors from dept grouping)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, emp_id, name, department, role')
      .not('department', 'is', null)
      .neq('role', 'director');
    
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
    
    // Group users by department (directors already excluded from query)
    const departmentGroups = users.reduce((acc, user) => {
      if (!user.department) return acc; // Extra safety check
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

// Helper function to group tasks by department
// function getTasksByDepartment(tasks) {
//   const byDept = {};
//   tasks.forEach(task => {
//     const dept = task.task_owner?.department || 'Unknown';
//     byDept[dept] = (byDept[dept] || 0) + 1;
//   });
//   return byDept;
// }

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

// Get company-wide KPIs
router.get('/kpis', async (req, res) => {
  try {
    const supabase = getServiceClient();
    
    // Get total users count (including directors who don't have departments)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, emp_id, department, role, created_at');
    
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

// Director: Get all tasks (with owner info)
// router.get("/tasks/all", async (req, res) => {
//   try {
//     const { userId } = req.user;
    
//     // Verify director role
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("role")
//       .eq("id", userId)
//       .single();

//     if (userError || userData.role !== "director") {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const { data: tasksData, error: tasksError } = await supabase
//       .from("tasks")
//       .select("*")
//       .order("created_at", { ascending: false });

//     if (tasksError) {
//       console.error("Error fetching tasks:", tasksError);
//       return res.status(500).json({ error: "Failed to fetch tasks" });
//     }

//     // Enrich tasks with owner information
//     const enrichedTasks = await Promise.all(
//       (tasksData || []).map(async (task) => {
//         if (task.owner_id) {
//           const { data: ownerData } = await supabase
//             .from("users")
//             .select("name")
//             .eq("emp_id", task.owner_id)
//             .single();
//           return { ...task, owner_name: ownerData?.name || "Unknown" };
//         }
//         return task;
//       })
//     );

//     res.json({ tasks: enrichedTasks });
//   } catch (error) {
//     console.error("Error in /tasks/all:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// Director: Get all staff members
// router.get("/staff-members", async (req, res) => {
//   try {
//     const { userId } = req.user;
    
//     // Verify director role
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("role")
//       .eq("id", userId)
//       .single();

//     if (userError || userData.role !== "director") {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const { data, error } = await supabase
//       .from("users")
//       .select("emp_id, name, role, department")
//       .in("role", ["staff", "manager"])
//       .order("name");

//     if (error) {
//       console.error("Error fetching staff members:", error);
//       return res.status(500).json({ error: "Failed to fetch staff members" });
//     }

//     res.json({ staffMembers: data || [] });
//   } catch (error) {
//     console.error("Error in /staff-members:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

// Director: Update task assignment
// router.put("/tasks/:taskId", async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { taskId } = req.params;
//     const { collaborators, ...updates } = req.body;

//     // Verify director role
//     const { data: userData, error: userError } = await supabase
//       .from("users")
//       .select("role")
//       .eq("id", userId)
//       .single();

//     if (userError || userData.role !== "director") {
//       return res.status(403).json({ error: "Access denied" });
//     }

//     const { data, error } = await supabase
//       .from("tasks")
//       .update({ collaborators, ...updates })
//       .eq("id", taskId)
//       .select();

//     if (error) {
//       console.error("Error updating task:", error);
//       return res.status(500).json({ error: "Failed to update task" });
//     }

//     res.json({ task: data[0] });
//   } catch (error) {
//     console.error("Error in PUT /tasks/:taskId:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

/* istanbul ignore next */
export default router;

