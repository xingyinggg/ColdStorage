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
  if (!token) {
    throw new Error('No token provided');
  }
  
  // Create a client with the user's access token
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    }
  );
  
  // Now getUser() will use the token from the headers
  const { data, error } = await supabase.auth.getUser();
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

/**
 * Get numeric user ID from emp_id (for tables that use numeric foreign keys)
 * This function extracts the number from emp_id strings like "TEST001" -> 1
 * @param {string} empId - The employee ID (e.g., "TEST001")
 * @returns {number|null} - The numeric ID or null if invalid
 */
export function getNumericIdFromEmpId(empId) {
  if (!empId) return null;
  
  // Handle if it's already a number
  if (typeof empId === 'number') return empId;
  
  // Extract numeric portion from emp_id (e.g., "TEST001" -> 1)
  const match = String(empId).match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return null;
}

/**
 * Get UUID from emp_id by querying the users table
 * @param {string} empId - The employee ID (e.g., "TEST001")
 * @returns {Promise<string|null>} - The user UUID or null
 */
export async function getUserIdFromEmpId(empId) {
  const supabase = getServiceClient();
  const { data, error} = await supabase
    .from('users')
    .select('id')
    .eq('emp_id', empId)
    .single();
  if (error) return null;
  return data?.id || null;
}

/**
 * Get emp_id from numeric user ID by querying the users table
 * @param {number} numericId - The numeric user ID (e.g., 1)
 * @returns {Promise<string|null>} - The emp_id or null
 */
export async function getEmpIdFromNumericId(numericId) {
  if (!numericId) return null;
  
  const supabase = getServiceClient();
  
  // Query users table where the numeric part of emp_id matches
  // This assumes emp_id format like "TEST001" where the numeric part is extracted
  const { data, error } = await supabase
    .from('users')
    .select('emp_id')
    .limit(1000);  // Get all users to search
  
  if (error || !data) return null;
  
  // Find the user where the numeric portion matches
  const user = data.find(u => {
    if (!u.emp_id) return false;
    const match = String(u.emp_id).match(/(\d+)$/);
    return match && parseInt(match[1], 10) === numericId;
  });
  
  return user?.emp_id || null;
}


