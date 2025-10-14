import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

const supabaseUrl = process.env.SUPABASE_TEST_URL;
const supabaseServiceKey = process.env.SUPABASE_TEST_SERVICE_KEY;

function getTestServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function seedTestData() {
  const supabaseClient = getTestServiceClient();
  
  try {
    console.log("🌱 Seeding test data...");
    
    // Insert test users
    const { error: usersError } = await supabaseClient
      .from('users')
      .upsert([
        { 
          id: '550e8400-e29b-41d4-a716-446655440001',
          emp_id: 'TEST001', 
          name: 'Test User 1', 
          email: 'test1@example.com', 
          department: 'Engineering', 
          role: 'staff' 
        },
        { 
          id: '550e8400-e29b-41d4-a716-446655440002',
          emp_id: 'TEST002', 
          name: 'Test Manager', 
          email: 'manager@example.com', 
          department: 'Engineering', 
          role: 'manager' 
        }
      ], { onConflict: 'emp_id' });

    if (usersError) {
      console.warn("⚠️ Seed users warning:", usersError);
    } else {
      console.log("✅ Test users seeded successfully");
    }

    // Insert test projects
    const { error: projectsError } = await supabaseClient
      .from('projects')
      .upsert([
        { id: 1, title: 'Test Project 1', description: 'Test project description', owner_id: 'TEST001', status: 'active' },
        { id: 2, title: 'Test Project 2', description: 'Another test project', owner_id: 'TEST002', status: 'active' }
      ]);

    if (projectsError) {
      console.warn("⚠️ Seed projects warning:", projectsError);
    } else {
      console.log("✅ Test projects seeded successfully");
    }

    // Insert test tasks
    const { error: tasksError } = await supabaseClient
      .from('tasks')
      .upsert([
        { 
          id: 1,
          title: 'Test Task 1', 
          description: 'Test task description', 
          owner_id: 'TEST001', 
          status: 'ongoing',
          project_id: 1,
          priority: 5
        }
      ]);

    if (tasksError) {
      console.warn("⚠️ Seed tasks warning:", tasksError);
    } else {
      console.log("✅ Test tasks seeded successfully");
    }

    // Insert test subtasks
    const { error: subtasksError } = await supabaseClient
      .from('sub_task')
      .upsert([
        {
          id: 1,
          title: 'Test Subtask 1',
          description: 'Test subtask description',
          parent_task_id: 1,
          owner_id: 1, // Note: this should match the smallint type
          status: 'ongoing'
        }
      ]);

    if (subtasksError) {
      console.warn("⚠️ Seed subtasks warning:", subtasksError);
    } else {
      console.log("✅ Test subtasks seeded successfully");
    }

    console.log("🎉 All test data seeded successfully!");
    
  } catch (error) {
    console.error("❌ Seed data failed:", error.message);
    throw error;
  }
}

// Actually run the seeding function
console.log('🚀 Starting seed process...');

async function runSeed() {
  try {
    await seedTestData();
    console.log('✅ Seed complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

runSeed();