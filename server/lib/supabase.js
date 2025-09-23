import { createClient } from '@supabase/supabase-js';

export function getServiceClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server env not configured');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAnonClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Server env not configured');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

export async function getUserFromToken(token) {
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error) throw error;
  return data?.user || null;
}

export async function getEmpIdForUserId(userId) {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('users')
    .select('emp_id')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.emp_id || null;
}


