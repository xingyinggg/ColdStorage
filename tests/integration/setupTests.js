import { beforeEach, afterEach } from 'vitest';

// Clean up test data before each test (but keep schema)
beforeEach(async () => {
  // Optional: clean up before each test
  // await cleanupTestDatabase();
   console.log('🧪 Starting integration test');
});

// Clean up test data after each test
afterEach(async () => {
  console.log('integration test completed')
});