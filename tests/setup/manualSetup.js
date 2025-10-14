import { setupTestDatabase, seedTestData } from './setupTestDB.js';

console.log('🚀 Manual test database setup starting...');

async function runSetup() {
  try {
    await setupTestDatabase();
    await seedTestData();
    console.log('✅ Manual setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Manual setup failed:', error);
    process.exit(1);
  }
}

runSetup();