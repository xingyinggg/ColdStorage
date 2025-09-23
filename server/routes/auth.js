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

export default router;


