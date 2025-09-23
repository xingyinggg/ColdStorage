import { Router } from 'express';
import { getServiceClient, getUserFromToken, getEmpIdForUserId } from '../lib/supabase.js';
import { TaskSchema } from '../schemas/task.js';

const router = Router();

// Create task
router.post('/', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing access token' });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: 'emp_id not found' });

    const parsed = TaskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...parsed.data, owner_id: empId }])
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List tasks
router.get('/', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing access token' });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: 'emp_id not found' });

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('owner_id', empId)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });

    res.json({ tasks: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing access token' });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: 'emp_id not found' });

    const { id } = req.params;
    const updates = req.body || {};

    const { data, error } = await supabase
      .from('tasks')
      .update({ ...updates })
      .eq('id', Number(id))
      .eq('owner_id', empId)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getServiceClient();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing access token' });

    const user = await getUserFromToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    const empId = await getEmpIdForUserId(user.id);
    if (!empId) return res.status(400).json({ error: 'emp_id not found' });

    const { id } = req.params;
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', Number(id))
      .eq('owner_id', empId);
    if (error) return res.status(400).json({ error: error.message });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;


