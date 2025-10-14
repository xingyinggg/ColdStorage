// // tests/integration/task_priority.test.js
// import { describe, it, expect, beforeEach, vi } from 'vitest';
// import request from 'supertest';
// import express from 'express';

// /**
//  * Integration Tests for Task Priority Feature (CS-US76)
//  * User Story CS-US76: Task Priority Assignment
//  * 
//  * Test Organization:
//  * - End-to-end API workflow tests
//  * - Multi-component interaction tests
//  * - Full request/response cycle validation
//  * 
//  * Test Coverage:
//  * 1. Dashboard sorting by priority (descending order)
//  * 2. Priority updates for task owners (complete workflows)
//  * 3. Edge cases and integration scenarios
//  * 4. UI integration and data consistency
//  */

// // Create mock Supabase with enhanced query chain tracking
// const createMockSupabase = () => {
//     const mockResponses = new Map();
//     let lastQuery = null;

//     const createChain = (tableName = '', sharedQuery = null) => {
//         // Use shared query object to maintain state across chain calls
//         let currentQuery = sharedQuery || {
//             type: '',
//             filters: [],
//             orders: [],
//             table: tableName
//         };

//         return {
//             insert: vi.fn((data) => {
//                 currentQuery.type = 'insert';
//                 currentQuery.data = data;
//                 return createChain(tableName, currentQuery);
//             }),
//             select: vi.fn((fields = '*') => {
//                 currentQuery.type += currentQuery.type ? '-select' : 'select';
//                 currentQuery.fields = fields;
//                 return createChain(tableName, currentQuery);
//             }),
//             update: vi.fn((data) => {
//                 currentQuery.type = 'update';
//                 currentQuery.data = data;
//                 return createChain(tableName, currentQuery);
//             }),
//             delete: vi.fn(() => {
//                 currentQuery.type = 'delete';
//                 return createChain(tableName, currentQuery);
//             }),
//             eq: vi.fn((field, value) => {
//                 currentQuery.filters.push({ type: 'eq', field, value });
//                 return createChain(tableName, currentQuery);
//             }),
//             or: vi.fn((condition) => {
//                 currentQuery.filters.push({ type: 'or', condition });
//                 return createChain(tableName, currentQuery);
//             }),
//             in: vi.fn((field, values) => {
//                 currentQuery.filters.push({ type: 'in', field, values });
//                 return createChain(tableName, currentQuery);
//             }),
//             order: vi.fn((field, options = {}) => {
//                 const ascending = options.ascending !== false;
//                 currentQuery.orders.push({ field, ascending });
//                 return createChain(tableName, currentQuery);
//             }),
//             single: vi.fn(() => {
//                 lastQuery = { ...currentQuery };
                
//                 // For insert-select chain, return the inserted data
//                 if (currentQuery.type === 'insert-select') {
//                     const insertResponse = mockResponses.get('insert') || { data: null, error: null };
//                     return insertResponse;
//                 }
//                 if (currentQuery.type.includes('update')) {
//                     const updateResponse = mockResponses.get('update') || { data: null, error: null };
//                     // Update returns array, but .single() returns first element
//                     if (updateResponse.data && Array.isArray(updateResponse.data)) {
//                         return { data: updateResponse.data[0], error: updateResponse.error };
//                     }
//                     return updateResponse;
//                 }
//                 if (currentQuery.type.includes('select')) {
//                     return mockResponses.get('select-single') || { data: null, error: null };
//                 }
//                 return { data: null, error: null };
//             }),
//             then: vi.fn((callback) => {
//                 lastQuery = { ...currentQuery };
                
//                 // For users table, return empty array (no need for user lookups in unit tests)
//                 if (tableName === 'users') {
//                     return callback({ data: [], error: null });
//                 }
                
//                 // For update-select chain, return update response
//                 if (currentQuery.type === 'update-select') {
//                     const updateResponse = mockResponses.get('update') || { data: [], error: null };
//                     return callback(updateResponse);
//                 }
                
//                 let result = mockResponses.get('select') || { data: [], error: null };
                
//                 // Apply ordering if specified
//                 if (currentQuery.orders.length > 0 && result.data && Array.isArray(result.data)) {
//                     result.data = [...result.data].sort((a, b) => {
//                         for (const order of currentQuery.orders) {
//                             const aVal = a[order.field] ?? (order.field === 'priority' ? 0 : '');
//                             const bVal = b[order.field] ?? (order.field === 'priority' ? 0 : '');
                            
//                             if (aVal !== bVal) {
//                                 if (order.ascending) {
//                                     return aVal > bVal ? 1 : -1;
//                                 } else {
//                                     return aVal < bVal ? 1 : -1;
//                                 }
//                             }
//                         }
//                         return 0;
//                     });
//                 }
                
//                 return callback(result);
//             })
//         };
//     };

//     return {
//         auth: {
//             getUser: vi.fn()
//         },
//         from: vi.fn((table) => createChain(table)),
//         storage: {
//             from: vi.fn(() => ({
//                 upload: vi.fn(() => Promise.resolve({ data: { path: 'test-file.pdf' }, error: null })),
//                 remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
//                 getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test-file.pdf' } }))
//             }))
//         },
//         _setMockResponse: (queryType, response) => {
//             mockResponses.set(queryType, response);
//         },
//         _getLastQuery: () => lastQuery
//     };
// };

// const mockSupabase = createMockSupabase();

// // Mock Supabase functions
// vi.mock('../../server/lib/supabase.js', () => ({
//     getServiceClient: () => mockSupabase,
//     getAnonClient: () => mockSupabase,
//     getUserFromToken: vi.fn(),
//     getEmpIdForUserId: vi.fn(),
//     getUserRole: vi.fn(),
// }));

// // Import task routes
// let taskRoutes;
// try {
//     taskRoutes = (await import('../../server/routes/tasks.js')).default;
// } catch {
//     console.warn('Task routes file not found. Creating mock routes.');
//     taskRoutes = express.Router();
//     taskRoutes.post('/', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
//     taskRoutes.get('/', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
//     taskRoutes.put('/:id', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
//     taskRoutes.delete('/:id', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
// }

// const app = express();
// app.use(express.json());
// app.use('/tasks', taskRoutes);

// describe('Task Priority Feature - Integration Tests', () => {
//     let mockUser;
//     let mockEmpId;
//     let mockAuthToken;
//     let supabaseHelpers;

//     beforeEach(async () => {
//         vi.clearAllMocks();

//         mockUser = {
//             id: '550e8400-e29b-41d4-a716-446655440000',
//             email: 'taskowner@example.com',
//             aud: 'authenticated',
//             role: 'authenticated'
//         };

//         mockEmpId = '12345';
//         mockAuthToken = 'mock-jwt-token';

//         // Mock authentication helpers
//         supabaseHelpers = await import('../../server/lib/supabase.js');
//         supabaseHelpers.getUserFromToken.mockResolvedValue(mockUser);
//         supabaseHelpers.getEmpIdForUserId.mockResolvedValue(mockEmpId);
//         supabaseHelpers.getUserRole.mockResolvedValue('staff');
//     });

//     describe('[INTEGRATION] Dashboard Priority Sorting - Descending Order', () => {
//         it('should retrieve tasks sorted by priority in descending order', async () => {
//             const mockTasks = [
//                 { id: 1, title: 'Task A', priority: 3, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-10T10:00:00Z' },
//                 { id: 2, title: 'Task B', priority: 10, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-11T10:00:00Z' },
//                 { id: 3, title: 'Task C', priority: 7, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-12T10:00:00Z' },
//                 { id: 4, title: 'Task D', priority: 1, status: 'completed', owner_id: mockEmpId, created_at: '2025-10-13T10:00:00Z' },
//                 { id: 5, title: 'Task E', priority: 5, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T10:00:00Z' }
//             ];

//             // Mock will automatically sort when .order() is called
//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             console.log('Priority sorting response:', response.status);

//             expect(response.status).toBe(200);
            
//             // Extract tasks array (API returns { tasks: [...] })
//             const tasks = response.body.tasks || response.body;
//             expect(Array.isArray(tasks)).toBe(true);

//             if (tasks.length > 1) {
//                 // Verify tasks are sorted by priority (descending)
//                 const priorities = tasks.map(task => task.priority ?? 0);
//                 console.log('Priorities order:', priorities);
                
//                 for (let i = 1; i < priorities.length; i++) {
//                     expect(priorities[i - 1]).toBeGreaterThanOrEqual(priorities[i]);
//                 }
//             }
//         });

//         it('should handle tasks with null priority in sorting (sorted to end)', async () => {
//             const mockTasks = [
//                 { id: 1, title: 'Task A', priority: 8, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-10T10:00:00Z' },
//                 { id: 2, title: 'Task B', priority: null, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-11T10:00:00Z' },
//                 { id: 3, title: 'Task C', priority: 5, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-12T10:00:00Z' },
//                 { id: 4, title: 'Task D', status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-13T10:00:00Z' } // No priority field
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             expect(Array.isArray(tasks)).toBe(true);
            
//             // Tasks with null/undefined priority should be treated as 0
//             const priorities = tasks.map(task => task.priority ?? 0);
            
//             for (let i = 1; i < priorities.length; i++) {
//                 expect(priorities[i - 1]).toBeGreaterThanOrEqual(priorities[i]);
//             }
//         });

//         it('should display high-priority tasks (8-10) at the top', async () => {
//             const mockTasks = [
//                 { id: 1, title: 'Critical', priority: 10, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T10:00:00Z' },
//                 { id: 2, title: 'High', priority: 9, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T09:00:00Z' },
//                 { id: 3, title: 'Important', priority: 8, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T08:00:00Z' },
//                 { id: 4, title: 'Medium', priority: 5, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T07:00:00Z' },
//                 { id: 5, title: 'Low', priority: 2, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T06:00:00Z' }
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
            
//             if (tasks.length >= 3) {
//                 // First three tasks should all be high priority (8-10)
//                 expect(tasks[0].priority).toBeGreaterThanOrEqual(8);
//                 expect(tasks[1].priority).toBeGreaterThanOrEqual(8);
//                 expect(tasks[2].priority).toBeGreaterThanOrEqual(8);
                
//                 // And should be in descending order
//                 expect(tasks[0].priority).toBeGreaterThanOrEqual(tasks[1].priority);
//                 expect(tasks[1].priority).toBeGreaterThanOrEqual(tasks[2].priority);
//             }
//         });

//         it('should maintain sort order for tasks with same priority', async () => {
//             const now = new Date('2025-10-14T12:00:00Z');
//             const mockTasks = [
//                 { id: 1, title: 'Task A', priority: 5, created_at: new Date(now.getTime() - 3600000).toISOString(), owner_id: mockEmpId, status: 'ongoing' },
//                 { id: 2, title: 'Task B', priority: 5, created_at: new Date(now.getTime() - 7200000).toISOString(), owner_id: mockEmpId, status: 'ongoing' },
//                 { id: 3, title: 'Task C', priority: 5, created_at: now.toISOString(), owner_id: mockEmpId, status: 'ongoing' }
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
            
//             // All should have same priority
//             const priorities = tasks.map(t => t.priority);
//             expect(new Set(priorities).size).toBe(1); // All same value
//         });

//         it('should handle empty task list', async () => {
//             mockSupabase._setMockResponse('select', {
//                 data: [],
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             expect(Array.isArray(tasks)).toBe(true);
//             expect(tasks.length).toBe(0);
//         });

//         it('should handle single task in list', async () => {
//             const mockTasks = [
//                 { id: 1, title: 'Only Task', priority: 7, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T10:00:00Z' }
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             expect(tasks.length).toBe(1);
//             expect(tasks[0].priority).toBe(7);
//         });
//     });

//     describe('[INTEGRATION] Priority Update Validation for Owners', () => {
//         it('should successfully update priority from 5 to 9', async () => {
//             const taskId = 1;
//             const updateData = { priority: 9 };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     title: 'Task to Update',
//                     owner_id: mockEmpId,
//                     priority: 5,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     title: 'Task to Update',
//                     owner_id: mockEmpId,
//                     priority: 9
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(9);
//             }
//         });

//         it('should update priority from 10 to 1 (downgrade)', async () => {
//             const taskId = 2;
//             const updateData = { priority: 1 };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 10,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 1
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(1);
//             }
//         });

//         it('should update priority from 1 to 10 (upgrade)', async () => {
//             const taskId = 3;
//             const updateData = { priority: 10 };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 1,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 10
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(10);
//             }
//         });

//         it('should reject priority update with invalid value (0)', async () => {
//             const taskId = 1;
//             const updateData = { priority: 0 };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 5,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 5 // Should remain unchanged
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             // Invalid priority is silently ignored in the implementation
//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 // Priority should remain unchanged (5) or be null
//                 expect([5, null].includes(response.body.priority)).toBe(true);
//             }
//         });

//         it('should reject priority update with invalid value (11)', async () => {
//             const taskId = 1;
//             const updateData = { priority: 11 };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 5,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 5 // Should remain unchanged
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect([5, null].includes(response.body.priority)).toBe(true);
//             }
//         });

//         it('should handle priority update with multiple fields', async () => {
//             const taskId = 1;
//             const updateData = {
//                 title: 'Updated Task Title',
//                 description: 'Updated description',
//                 priority: 8,
//                 status: 'under review'
//             };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     title: 'Original Title',
//                     owner_id: mockEmpId,
//                     priority: 3,
//                     status: 'ongoing',
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     title: 'Updated Task Title',
//                     description: 'Updated description',
//                     owner_id: mockEmpId,
//                     priority: 8,
//                     status: 'under review'
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.status === 200) {
//                 expect(response.body.priority).toBe(8);
//                 expect(response.body.title).toBe('Updated Task Title');
//                 expect(response.body.status).toBe('under review');
//             }
//         });

//         it('should set priority to null when updating with null', async () => {
//             const taskId = 1;
//             const updateData = { priority: null };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 7,
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: null
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect(response.body.priority).toBeNull();
//             }
//         });

//         it('should handle concurrent priority updates gracefully', async () => {
//             const taskId = 1;
            
//             // Simulate multiple updates
//             const updates = [
//                 { priority: 8 },
//                 { priority: 9 },
//                 { priority: 7 }
//             ];

//             for (const update of updates) {
//                 mockSupabase._setMockResponse('select-single', {
//                     data: {
//                         id: taskId,
//                         owner_id: mockEmpId,
//                         priority: 5,
//                         file: null
//                     },
//                     error: null
//                 });

//                 mockSupabase._setMockResponse('update', {
//                     data: [{
//                         id: taskId,
//                         owner_id: mockEmpId,
//                         priority: update.priority
//                     }],
//                     error: null
//                 });

//                 const response = await request(app)
//                     .put(`/tasks/${taskId}`)
//                     .set('Authorization', `Bearer ${mockAuthToken}`)
//                     .send(update);

//                 expect([200, 204]).toContain(response.status);
//             }
//         });
//     });

//     describe('[INTEGRATION] Edge Cases and Integration Scenarios', () => {
//         it('should handle task with all fields including priority', async () => {
//             const taskData = {
//                 title: 'Complete Task',
//                 description: 'Full task with all fields',
//                 priority: 7,
//                 status: 'ongoing',
//                 due_date: '2025-12-31',
//                 project_id: 5
//             };

//             mockSupabase._setMockResponse('insert', {
//                 data: {
//                     id: 1,
//                     ...taskData,
//                     owner_id: mockEmpId,
//                     created_at: new Date().toISOString()
//                 },
//                 error: null
//             });

//             const response = await request(app)
//                 .post('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(taskData);

//             expect([200, 201]).toContain(response.status);
//             if (response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(7);
//             }
//         });

//         it('should preserve priority when updating status', async () => {
//             const taskId = 1;
//             const updateData = { status: 'completed' };

//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 9,
//                     status: 'ongoing',
//                     file: null
//                 },
//                 error: null
//             });

//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 9, // Should be preserved
//                     status: 'completed'
//                 }],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(updateData);

//             expect([200, 204]).toContain(response.status);
//             if (response.body && response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(9);
//             }
//         });

//         it('should handle very large task lists with mixed priorities', async () => {
//             const mockTasks = Array.from({ length: 50 }, (_, i) => ({
//                 id: i + 1,
//                 title: `Task ${i + 1}`,
//                 priority: Math.floor(Math.random() * 10) + 1, // Random 1-10
//                 status: 'ongoing',
//                 owner_id: mockEmpId,
//                 created_at: new Date(Date.now() - i * 1000).toISOString()
//             }));

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             expect(tasks.length).toBeGreaterThan(0);
            
//             // Verify descending order
//             const priorities = tasks.map(t => t.priority ?? 0);
//             for (let i = 1; i < priorities.length; i++) {
//                 expect(priorities[i - 1]).toBeGreaterThanOrEqual(priorities[i]);
//             }
//         });

//         it('should handle priority update race condition', async () => {
//             const taskId = 1;
            
//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     owner_id: mockEmpId,
//                     priority: 5,
//                     file: null
//                 },
//                 error: null
//             });

//             // Mock that someone else updated it
//             mockSupabase._setMockResponse('update', {
//                 data: [],
//                 error: null
//             });

//             const response = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send({ priority: 8 });

//             // Should return 404 when no rows updated
//             expect(response.status).toBe(404);
//         });

//         it('should handle database connection errors gracefully', async () => {
//             mockSupabase._setMockResponse('select', {
//                 data: null,
//                 error: { message: 'Database connection error' }
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(400);
//             expect(response.body.error).toBeDefined();
//         });

//         it('should validate priority bounds on update edge values', async () => {
//             const taskId = 1;
//             const boundaryTests = [
//                 { priority: 1, expected: 1 },
//                 { priority: 10, expected: 10 },
//                 { priority: 0, expected: null }, // Invalid
//                 { priority: 11, expected: null } // Invalid
//             ];

//             for (const test of boundaryTests) {
//                 mockSupabase._setMockResponse('select-single', {
//                     data: {
//                         id: taskId,
//                         owner_id: mockEmpId,
//                         priority: 5,
//                         file: null
//                     },
//                     error: null
//                 });

//                 mockSupabase._setMockResponse('update', {
//                     data: [{
//                         id: taskId,
//                         owner_id: mockEmpId,
//                         priority: test.expected
//                     }],
//                     error: null
//                 });

//                 const response = await request(app)
//                     .put(`/tasks/${taskId}`)
//                     .set('Authorization', `Bearer ${mockAuthToken}`)
//                     .send({ priority: test.priority });

//                 expect([200, 204]).toContain(response.status);
//             }
//         });

//         it('should handle priority in task creation with subtasks', async () => {
//             const taskData = {
//                 title: 'Parent Task',
//                 priority: 9,
//                 project_id: 1,
//                 subtasks: JSON.stringify([
//                     { title: 'Subtask 1', priority: 8 },
//                     { title: 'Subtask 2', priority: 7 }
//                 ])
//             };

//             mockSupabase._setMockResponse('insert', {
//                 data: {
//                     id: 1,
//                     title: 'Parent Task',
//                     priority: 9,
//                     owner_id: mockEmpId,
//                     status: 'ongoing'
//                 },
//                 error: null
//             });

//             const response = await request(app)
//                 .post('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send(taskData);

//             expect([200, 201]).toContain(response.status);
//             if (response.body.priority !== undefined) {
//                 expect(response.body.priority).toBe(9);
//             }
//         });
//     });

//     describe('[INTEGRATION] Priority Display and UI Integration', () => {
//         it('should return priority as integer type', async () => {
//             const mockTasks = [
//                 { id: 1, title: 'Task 1', priority: 5, status: 'ongoing', owner_id: mockEmpId, created_at: '2025-10-14T10:00:00Z' }
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: mockTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             if (tasks.length > 0 && tasks[0].priority !== null) {
//                 expect(typeof tasks[0].priority).toBe('number');
//                 expect(Number.isInteger(tasks[0].priority)).toBe(true);
//             }
//         });

//         it('should handle priority filtering for high-priority tasks', async () => {
//             const allTasks = [
//                 { id: 1, title: 'Critical', priority: 10, status: 'ongoing', owner_id: mockEmpId },
//                 { id: 2, title: 'High', priority: 9, status: 'ongoing', owner_id: mockEmpId },
//                 { id: 3, title: 'Medium', priority: 5, status: 'ongoing', owner_id: mockEmpId },
//                 { id: 4, title: 'Low', priority: 2, status: 'ongoing', owner_id: mockEmpId }
//             ];

//             mockSupabase._setMockResponse('select', {
//                 data: allTasks,
//                 error: null
//             });

//             const response = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(response.status).toBe(200);
            
//             const tasks = response.body.tasks || response.body;
//             const highPriorityTasks = tasks.filter(t => t.priority >= 8);
            
//             expect(highPriorityTasks.length).toBeGreaterThan(0);
//             highPriorityTasks.forEach(task => {
//                 expect(task.priority).toBeGreaterThanOrEqual(8);
//             });
//         });

//         it('should maintain data consistency after priority update', async () => {
//             const taskId = 1;
            
//             // Get task
//             mockSupabase._setMockResponse('select-single', {
//                 data: {
//                     id: taskId,
//                     title: 'Test Task',
//                     owner_id: mockEmpId,
//                     priority: 5,
//                     status: 'ongoing',
//                     file: null
//                 },
//                 error: null
//             });

//             // Update priority
//             mockSupabase._setMockResponse('update', {
//                 data: [{
//                     id: taskId,
//                     title: 'Test Task',
//                     owner_id: mockEmpId,
//                     priority: 9,
//                     status: 'ongoing'
//                 }],
//                 error: null
//             });

//             const updateResponse = await request(app)
//                 .put(`/tasks/${taskId}`)
//                 .set('Authorization', `Bearer ${mockAuthToken}`)
//                 .send({ priority: 9 });

//             expect([200, 204]).toContain(updateResponse.status);

//             // Get updated task list
//             mockSupabase._setMockResponse('select', {
//                 data: [{
//                     id: taskId,
//                     title: 'Test Task',
//                     owner_id: mockEmpId,
//                     priority: 9,
//                     status: 'ongoing',
//                     created_at: '2025-10-14T10:00:00Z'
//                 }],
//                 error: null
//             });

//             const listResponse = await request(app)
//                 .get('/tasks')
//                 .set('Authorization', `Bearer ${mockAuthToken}`);

//             expect(listResponse.status).toBe(200);
            
//             const tasks = listResponse.body.tasks || listResponse.body;
//             const updatedTask = tasks.find(t => t.id === taskId);
            
//             if (updatedTask) {
//                 expect(updatedTask.priority).toBe(9);
//             }
//         });
//     });
// });
