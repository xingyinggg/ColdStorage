import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

console.log('🔧 Testing Supabase connection...');
console.log('URL:', process.env.SUPABASE_TEST_URL);
console.log('Key exists:', !!process.env.SUPABASE_TEST_SERVICE_KEY);

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const supabaseServiceKey = process.env.SUPABASE_TEST_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

try {
  console.log('🔍 Testing connection...');
  const { data, error } = await supabase.from('users').select('count').limit(1);
  
  if (error) {
    console.log('⚠️ Query error (this might be expected):', error.message);
  } else {
    console.log('✅ Connection successful!');
  }
} catch (error) {
  console.error('❌ Connection failed:', error.message);
}

console.log('✅ Test complete');
process.exit(0);