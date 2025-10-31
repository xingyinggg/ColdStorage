import { Router } from 'express';
import { getAnonClient, getServiceClient } from '../lib/supabase.js';
import { RegisterSchema } from '../schemas/task.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const supabaseAnon = getAnonClient();
    const supabaseService = getServiceClient();

    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const payload = parsed.data;
    const roleNormalized = payload.role.toLowerCase();

    // Fast path: prevent duplicate employee ID before creating auth user
    try {
      const { data: existingByEmp, error: existingEmpErr } = await supabaseService
        .from('users')
        .select('id')
        .eq('emp_id', payload.emp_id)
        .limit(1);
      if (!existingEmpErr && Array.isArray(existingByEmp) && existingByEmp.length > 0) {
        return res.status(409).json({ error: 'Employee ID already registered' });
      }
    } catch (precheckErr) {
      // Ignore precheck errors; fallback to normal flow which will still error on constraint
    }

    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          name: payload.name,
          department: payload.department,
          role: roleNormalized,
          emp_id: payload.emp_id,
        },
      },
    });

    if (signUpError) return res.status(400).json({ error: signUpError.message });

    const userId = signUpData.user?.id;
    if (userId) {
      const { error: upsertErr } = await supabaseService
        .from('users')
        .upsert(
          {
            id: userId,
            emp_id: payload.emp_id,
            name: payload.name,
            email: payload.email,
            department: payload.department,
            role: roleNormalized,
          },
          { onConflict: 'id' }
        );
      if (upsertErr) return res.status(400).json({ error: upsertErr.message });
    }

    const requiresEmailConfirm = !signUpData.session;
    res.status(201).json({ ok: true, requiresEmailConfirm });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const supabaseAnon = getAnonClient();
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabaseAnon.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.status(200).json({
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      user: data.user,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* istanbul ignore next */
/* istanbul ignore next */
export default router;



