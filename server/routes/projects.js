import { Router } from 'express';
import { getServiceClient, getUserFromToken, getEmpIdForUserId } from '../lib/supabase.js';
import { ProjectSchema } from '../schemas/task.js';

const router = Router();

// Get projects where user is a member
router.get('/', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(404).json({ error: 'Employee ID not found' });
    }

    // Get projects where user is owner or member
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .or(`owner_id.eq.${empId},members.cs.{${empId}}`);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ projects: data });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Get project members by project ID
router.get('/:id/members', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const projectId = req.params.id;

    // get current users emp_id
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) {
      return res.status(404).json({ error: 'Employee ID not found' });
    }

    // Get project with members
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('members, owner_id, title') // Make sure to select the fields you need
      .eq('id', projectId)
      .single();

    if (projectError) {
      console.error('Project error:', projectError);
      return res.status(404).json({ error: 'Project not found' });
    }

    console.log('Project data:', project); // Debug log

    // Get all member IDs including owner, but exclude current user
    const allMemberIds = [...(project.members || [])];
    if (project.owner_id && !allMemberIds.includes(project.owner_id)) {
      allMemberIds.push(project.owner_id);
    }

    // Remove current user from the list
    const collaboratorIds = allMemberIds.filter(id => id !== empId);

    console.log('All member IDs:', allMemberIds);
    console.log('Collaborator IDs (excluding current user):', collaboratorIds);

    if (collaboratorIds.length === 0) {
      return res.json({ members: [] });
    }

    // Get user details for all members
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('emp_id, name, email')
      .in('emp_id', collaboratorIds);

    if (usersError) {
      console.error('Users error:', usersError);
      return res.status(500).json({ error: usersError.message });
    }

    console.log('Users data:', users); // Debug log

    res.json({ members: users || [] });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;