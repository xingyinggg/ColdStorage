import { Router } from "express";
import {
  getServiceClient,
  getUserFromToken,
  getEmpIdForUserId,
} from "../lib/supabase.js";


const router = Router();

// GET /department_teams/my-team - get manager's team members
router.get('/my-team', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const emp_id = await getEmpIdForUserId(user.id);
    
    if (!emp_id) {
      return res.status(400).json({ error: 'Employee ID not found' });
    }

    const supabase = getServiceClient();

    // Find teams where current user is a manager
    const { data: teams, error: teamError } = await supabase
      .from('department_teams')
      .select('*')
      .contains('manager_ids', [emp_id]);

    if (teamError) {
      console.error('Error fetching teams:', teamError);
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }

    if (!teams || teams.length === 0) {
      return res.json({ 
        teams: [], 
        message: 'No teams found for this manager' 
      });
    }

    // Get all unique member IDs from all teams
    const allMemberIds = teams.reduce((acc, team) => {
      return [...acc, ...(team.member_ids || [])];
    }, []);

    const uniqueMemberIds = [...new Set(allMemberIds)];

    if (uniqueMemberIds.length === 0) {
      return res.json({ 
        teams: teams.map(team => ({ ...team, members: [] }))
      });
    }

    // Get detailed member information
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('emp_id, name, email, department, role')
      .in('emp_id', uniqueMemberIds)
      .order('name');

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch member details' });
    }

    // Combine team data with member details
    const teamsWithMembers = teams.map(team => ({
      ...team,
      members: (team.member_ids || []).map(memberId => 
        members.find(member => member.emp_id === memberId)
      ).filter(Boolean) // Remove any null/undefined members
    }));

    res.json({ teams: teamsWithMembers });
    
  } catch (error) {
    console.error('Error fetching manager team:', error);
    res.status(500).json({ error: 'Failed to fetch team data' });
  }
});

// GET /department_teams/workload - get team workload data
router.get('/workload', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(token);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const emp_id = await getEmpIdForUserId(user.id);
    
    if (!emp_id) {
      return res.status(400).json({ error: 'Employee ID not found' });
    }

    const supabase = getServiceClient();

    // First get the manager's teams
    const { data: teams, error: teamError } = await supabase
      .from('department_teams')
      .select('id, department, team_name, member_ids, manager_ids')
      .contains('manager_ids', [emp_id]);

    if (teamError) {
      console.error('Error fetching teams:', teamError);
      return res.status(500).json({ error: 'Failed to fetch teams' });
    }

    if (!teams || teams.length === 0) {
      return res.json({ 
        workload: {},
        summary: { total_members: 0, total_tasks: 0, due_soon: 0, overdue: 0 },
        teams: []
      });
    }

    // Get all unique member IDs from all teams this manager manages
    const allMemberIds = teams.reduce((acc, team) => {
      return [...acc, ...(team.member_ids || [])];
    }, []);

    const uniqueMemberIds = [...new Set(allMemberIds)];

    if (uniqueMemberIds.length === 0) {
      return res.json({ 
        workload: {},
        summary: { total_members: 0, total_tasks: 0, due_soon: 0, overdue: 0 },
        teams: teams
      });
    }

    console.log('🔍 Debug - Team member IDs:', uniqueMemberIds);

    // Get member details
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select('emp_id, name, email, department, role')
      .in('emp_id', uniqueMemberIds);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return res.status(500).json({ error: 'Failed to fetch member details' });
    }

    console.log('👥 Debug - Found members:', members?.length || 0);

    // FIXED: Get tasks for team members (both owned and collaboration)
    const memberIdsAsStrings = uniqueMemberIds.map(id => String(id));
    
    // Try a simpler query first - get all tasks where owner_id matches any team member
    const { data: ownedTasks, error: ownedTasksError } = await supabase
      .from('tasks')
      .select('*')
      .in('owner_id', memberIdsAsStrings)
      .neq('status');

    if (ownedTasksError) {
      console.error('Error fetching owned tasks:', ownedTasksError);
      return res.status(500).json({ error: 'Failed to fetch owned tasks' });
    }

    console.log('📋 Debug - Found owned tasks:', ownedTasks?.length || 0);

    // Get collaboration tasks separately
    let collaborationTasks = [];
    try {
      // This query gets tasks where any team member is in collaborators array
      const { data: collabTasks, error: collabError } = await supabase
        .from('tasks')
        .select('*')
        .neq('status')
        .not('collaborators', 'is', null);

      if (collabError) {
        console.error('Error fetching collaboration tasks:', collabError);
      } else {
        // Filter collaboration tasks in JavaScript since Supabase array contains is tricky
        collaborationTasks = (collabTasks || []).filter(task => {
          if (!task.collaborators || !Array.isArray(task.collaborators)) return false;
          return task.collaborators.some(collabId => 
            memberIdsAsStrings.includes(String(collabId))
          );
        });
      }
    } catch (collabErr) {
      console.error('Collaboration tasks query failed:', collabErr);
    }

    console.log('🤝 Debug - Found collaboration tasks:', collaborationTasks.length);

    // Combine all tasks
    const allTasks = [...(ownedTasks || []), ...collaborationTasks];
    
    console.log('📊 Debug - Total tasks:', allTasks.length);

    // Process workload data
    const workloadData = {};
    
    // Initialize workload data for each member
    (members || []).forEach(member => {
      workloadData[member.emp_id] = {
        member_info: member,
        owned_tasks: [],
        collaboration_tasks: [],
        total_tasks: 0,
        due_soon_count: 0,
        overdue_count: 0,
        task_status_breakdown: {
          'under review': 0,
          'ongoing': 0,
          'completed': 0
        }
      };
    });

    // Process tasks
    const today = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(today.getDate() + 3);

    allTasks.forEach(task => {
      uniqueMemberIds.forEach(memberEmpId => {
        const memberEmpIdString = String(memberEmpId);
        
        if (!workloadData[memberEmpId]) return;

        const isOwner = task.owner_id === memberEmpIdString;
        const isCollaborator = task.collaborators && 
          Array.isArray(task.collaborators) &&
          task.collaborators.includes(memberEmpIdString);

        if (!isOwner && !isCollaborator) return;

        // Add task details for easier access
        const taskWithDetails = {
          ...task,
          project_name: null, // We'll add project info later if needed
          due_soon: task.due_date ? new Date(task.due_date) <= threeDaysFromNow : false,
          overdue: task.due_date ? new Date(task.due_date) < today : false
        };

        // Add to appropriate category
        if (isOwner) {
          workloadData[memberEmpId].owned_tasks.push(taskWithDetails);
        } else if (isCollaborator) {
          workloadData[memberEmpId].collaboration_tasks.push(taskWithDetails);
        }

        // Update counters (avoid double counting)
        const alreadyCounted = workloadData[memberEmpId].owned_tasks.some(t => t.id === task.id) ||
                              workloadData[memberEmpId].collaboration_tasks.some(t => t.id === task.id && !isOwner);
        
        if (!alreadyCounted || isOwner) {
          workloadData[memberEmpId].total_tasks++;
          
          if (taskWithDetails.due_soon) {
            workloadData[memberEmpId].due_soon_count++;
          }

          if (taskWithDetails.overdue) {
            workloadData[memberEmpId].overdue_count++;
          }

          // Status breakdown
          if (task.status && workloadData[memberEmpId].task_status_breakdown.hasOwnProperty(task.status)) {
            workloadData[memberEmpId].task_status_breakdown[task.status]++;
          }
        }
      });
    });

    // Calculate summary
    const summary = {
      total_members: (members || []).length,
      total_tasks: Object.values(workloadData).reduce((sum, member) => sum + member.total_tasks, 0),
      due_soon: Object.values(workloadData).reduce((sum, member) => sum + member.due_soon_count, 0),
      overdue: Object.values(workloadData).reduce((sum, member) => sum + member.overdue_count, 0)
    };

    console.log('📈 Debug - Summary:', summary);

    res.json({ 
      workload: workloadData,
      summary,
      teams: teams
    });
    
  } catch (error) {
    console.error('Error fetching team workload:', error);
    res.status(500).json({ error: 'Failed to fetch workload data' });
  }
});

export default router;