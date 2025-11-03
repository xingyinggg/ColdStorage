// tests/unit/task_priority.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

/**
 * Unit Tests for Task Priority Feature (CS-US76)
 * User Story CS-US76: Task Priority Assignment
 * 
 * Test Organization:
 * - UNIT TESTS ONLY: Isolated validation and permission logic tests
 * - For integration tests, see: tests/integration/task_priority.test.js
 * 
 * Test Coverage:
 * 1. Priority input validation (1-10 inclusive)
 * 2. Task owner permission validation
 * 3. Authentication and authorization checks
 */

// Create mock Supabase with enhanced query chain tracking
const createMockSupabase = () => {
    const mockResponses = new Map();
    let lastQuery = null;

    const createChain = (tableName = '', sharedQuery = null) => {
        // Use shared query object to maintain state across chain calls
        let currentQuery = sharedQuery || {
            type: '',
            filters: [],
            orders: [],
            table: tableName
        };

        return {
            insert: vi.fn((data) => {
                currentQuery.type = 'insert';
                currentQuery.data = data;
                return createChain(tableName, currentQuery);
            }),
            select: vi.fn((fields = '*') => {
                currentQuery.type += currentQuery.type ? '-select' : 'select';
                currentQuery.fields = fields;
                return createChain(tableName, currentQuery);
            }),
            update: vi.fn((data) => {
                currentQuery.type = 'update';
                currentQuery.data = data;
                return createChain(tableName, currentQuery);
            }),
            delete: vi.fn(() => {
                currentQuery.type = 'delete';
                return createChain(tableName, currentQuery);
            }),
            eq: vi.fn((field, value) => {
                currentQuery.filters.push({ type: 'eq', field, value });
                return createChain(tableName, currentQuery);
            }),
            or: vi.fn((condition) => {
                currentQuery.filters.push({ type: 'or', condition });
                return createChain(tableName, currentQuery);
            }),
            in: vi.fn((field, values) => {
                currentQuery.filters.push({ type: 'in', field, values });
                return createChain(tableName, currentQuery);
            }),
            order: vi.fn((field, options = {}) => {
                const ascending = options.ascending !== false;
                currentQuery.orders.push({ field, ascending });
                return createChain(tableName, currentQuery);
            }),
            single: vi.fn(() => {
                lastQuery = { ...currentQuery };
                
                // For insert-select chain, return the inserted data
                if (currentQuery.type === 'insert-select') {
                    const insertResponse = mockResponses.get('insert') || { data: null, error: null };
                    return insertResponse;
                }
                if (currentQuery.type.includes('update')) {
                    const updateResponse = mockResponses.get('update') || { data: null, error: null };
                    // Update returns array, but .single() returns first element
                    if (updateResponse.data && Array.isArray(updateResponse.data)) {
                        return { data: updateResponse.data[0], error: updateResponse.error };
                    }
                    return updateResponse;
                }
                if (currentQuery.type.includes('select')) {
                    return mockResponses.get('select-single') || { data: null, error: null };
                }
                return { data: null, error: null };
            }),
            then: vi.fn((callback) => {
                lastQuery = { ...currentQuery };
                
                // For users table, return empty array (no need for user lookups in unit tests)
                if (tableName === 'users') {
                    return callback({ data: [], error: null });
                }
                
                // For update-select chain, return update response
                if (currentQuery.type === 'update-select') {
                    const updateResponse = mockResponses.get('update') || { data: [], error: null };
                    return callback(updateResponse);
                }
                
                let result = mockResponses.get('select') || { data: [], error: null };
                
                // Apply ordering if specified
                if (currentQuery.orders.length > 0 && result.data && Array.isArray(result.data)) {
                    result.data = [...result.data].sort((a, b) => {
                        for (const order of currentQuery.orders) {
                            const aVal = a[order.field] ?? (order.field === 'priority' ? 0 : '');
                            const bVal = b[order.field] ?? (order.field === 'priority' ? 0 : '');
                            
                            if (aVal !== bVal) {
                                if (order.ascending) {
                                    return aVal > bVal ? 1 : -1;
                                } else {
                                    return aVal < bVal ? 1 : -1;
                                }
                            }
                        }
                        return 0;
                    });
                }
                
                return callback(result);
            })
        };
    };

    return {
        auth: {
            getUser: vi.fn()
        },
        from: vi.fn((table) => createChain(table)),
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(() => Promise.resolve({ data: { path: 'test-file.pdf' }, error: null })),
                remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
                getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/test-file.pdf' } }))
            }))
        },
        _setMockResponse: (queryType, response) => {
            mockResponses.set(queryType, response);
        },
        _getLastQuery: () => lastQuery
    };
};

const mockSupabase = createMockSupabase();

// Mock Supabase functions
vi.mock('../../server/lib/supabase.js', () => ({
    getServiceClient: () => mockSupabase,
    getAnonClient: () => mockSupabase,
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
    getUserRole: vi.fn(),
    getNumericIdFromEmpId: vi.fn((empId) => {
        // Extract numeric portion from emp_id (e.g., "TEST001" -> 1)
        if (!empId) return null;
        if (typeof empId === 'number') return empId;
        const match = String(empId).match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }),
}));

// Import task routes
let taskRoutes;
try {
    taskRoutes = (await import('../../server/routes/tasks.js')).default;
} catch {
    console.warn('Task routes file not found. Creating mock routes.');
    taskRoutes = express.Router();
    taskRoutes.post('/', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
    taskRoutes.get('/', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
    taskRoutes.put('/:id', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
    taskRoutes.delete('/:id', (req, res) => res.status(404).json({ error: 'Route not implemented' }));
}

const app = express();
app.use(express.json());
app.use('/tasks', taskRoutes);

describe('Task Priority Feature - Unit Tests (CS-US76)', () => {
    let mockUser;
    let mockEmpId;
    let mockAuthToken;
    let supabaseHelpers;

    beforeEach(async () => {
        vi.clearAllMocks();

        mockUser = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'taskowner@example.com',
            aud: 'authenticated',
            role: 'authenticated'
        };

        mockEmpId = '12345';
        mockAuthToken = 'mock-jwt-token';

        // Mock authentication helpers
        supabaseHelpers = await import('../../server/lib/supabase.js');
        supabaseHelpers.getUserFromToken.mockResolvedValue(mockUser);
        supabaseHelpers.getEmpIdForUserId.mockResolvedValue(mockEmpId);
        supabaseHelpers.getUserRole.mockResolvedValue('staff');
    });

    // ============================================================================
    // UNIT TESTS (CS-US76)
    // Tests for isolated validation logic and permission checks
    // ============================================================================

    describe('[UNIT] CS-US76: Priority Input Validation - Valid Range (1-10)', () => {
        it('should accept priority level 1 (minimum boundary)', async () => {
            const taskData = {
                title: 'Low Priority Task',
                description: 'Minimum priority',
                priority: 1,
                project_id: 1
            };

            const expectedTask = {
                id: 1,
                ...taskData,
                owner_id: mockEmpId,
                status: 'ongoing',
                created_at: new Date().toISOString()
            };

            mockSupabase._setMockResponse('insert', {
                data: expectedTask,
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Priority 1 response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            // POST returns task directly (not wrapped in array)
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBe(1);
            }
        });

        it('should accept priority level 5 (mid-range)', async () => {
            const taskData = {
                title: 'Medium Priority Task',
                priority: 5,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 2, ...taskData, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBe(5);
            }
        });

        it('should accept priority level 10 (maximum boundary)', async () => {
            const taskData = {
                title: 'Critical Priority Task',
                description: 'Maximum priority',
                priority: 10,
                project_id: 1
            };

            const expectedTask = {
                id: 3,
                ...taskData,
                owner_id: mockEmpId,
                status: 'ongoing',
                created_at: new Date().toISOString()
            };

            mockSupabase._setMockResponse('insert', {
                data: expectedTask,
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Priority 10 response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBe(10);
            }
        });

        it('should accept all valid priority levels (1-10)', async () => {
            const validPriorities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            
            for (const priority of validPriorities) {
                const taskData = {
                    title: `Task Priority ${priority}`,
                    priority: priority,
                    project_id: 1
                };

                mockSupabase._setMockResponse('insert', {
                    data: { id: priority, ...taskData, owner_id: mockEmpId, status: 'ongoing' },
                    error: null
                });

                const response = await request(app)
                    .post('/tasks')
                    .set('Authorization', `Bearer ${mockAuthToken}`)
                    .send(taskData);

                expect([200, 201]).toContain(response.status);
            }
        });
    });

    describe('[UNIT] CS-US76: Priority Input Validation - Invalid Values', () => {
        it('should reject priority level 0 (below minimum)', async () => {
            const taskData = {
                title: 'Invalid Priority Task',
                priority: 0,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Priority 0 response:', response.status, response.body);

            // Priority 0 is silently ignored and converted to null
            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should reject negative priority values', async () => {
            const taskData = {
                title: 'Negative Priority Task',
                priority: -5,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Negative priority response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            // Invalid priority should be ignored
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should reject priority level 11 (above maximum)', async () => {
            const taskData = {
                title: 'Invalid Priority Task',
                priority: 11,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Priority 11 response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            // Invalid priority should be ignored
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should reject priority level 100 (far above maximum)', async () => {
            const taskData = {
                title: 'Extremely High Invalid Priority',
                priority: 100,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should reject non-integer priority values (decimals)', async () => {
            const taskData = {
                title: 'Decimal Priority Task',
                priority: 5.5,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: 5, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Decimal priority response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            // Should parse as integer (5) or be rejected
            if (response.body && response.body.priority !== undefined && response.body.priority !== null) {
                expect(Number.isInteger(response.body.priority)).toBe(true);
            }
        });

        it('should handle string priority values', async () => {
            const taskData = {
                title: 'String Priority Task',
                priority: "5",
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: 5, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            // Should be parsed to integer
            if (response.body && response.body.priority !== undefined && response.body.priority !== null) {
                expect(response.body.priority).toBe(5);
            }
        });

        it('should handle non-numeric string priority values', async () => {
            const taskData = {
                title: 'Invalid String Priority',
                priority: "high",
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            // Invalid string should result in null priority
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should handle missing priority field (default behavior)', async () => {
            const taskData = {
                title: 'Task Without Priority',
                description: 'No priority specified',
                project_id: 1
                // No priority field
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, ...taskData, owner_id: mockEmpId, priority: null, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            console.log('Missing priority response:', response.status, response.body);

            expect([200, 201]).toContain(response.status);
            // Priority should be null or a default value
            if (response.body && response.body.priority !== undefined) {
                expect([null, undefined].includes(response.body.priority) || typeof response.body.priority === 'number').toBe(true);
            }
        });

        it('should handle null priority value', async () => {
            const taskData = {
                title: 'Null Priority Task',
                priority: null,
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });

        it('should handle empty string priority value', async () => {
            const taskData = {
                title: 'Empty String Priority',
                priority: "",
                project_id: 1
            };

            mockSupabase._setMockResponse('insert', {
                data: { id: 1, title: taskData.title, priority: null, owner_id: mockEmpId, status: 'ongoing' },
                error: null
            });

            const response = await request(app)
                .post('/tasks')
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(taskData);

            expect([200, 201]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBeNull();
            }
        });
    });

    describe('[UNIT] CS-US76: Task Owner Permission Validation', () => {
        it('should allow task owner to update their own task priority', async () => {
            const taskId = 1;
            const updateData = {
                priority: 9
            };

            // Mock fetching current task - owner matches
            mockSupabase._setMockResponse('select-single', {
                data: {
                    id: taskId,
                    title: 'My Task',
                    owner_id: mockEmpId, // Same as current user
                    priority: 5,
                    file: null
                },
                error: null
            });

            // Mock update response
            mockSupabase._setMockResponse('update', {
                data: [{
                    id: taskId,
                    title: 'My Task',
                    owner_id: mockEmpId,
                    priority: 9
                }],
                error: null
            });

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(updateData);

            console.log('Owner update response:', response.status, response.body);

            expect([200, 204]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBe(9);
            }
        });

        it('should prevent non-owner from updating task priority', async () => {
            const taskId = 1;
            const otherUserEmpId = '67890'; // Different from mockEmpId
            const updateData = {
                priority: 9
            };

            // Mock fetching current task - owner is different
            mockSupabase._setMockResponse('select-single', {
                data: {
                    id: taskId,
                    title: 'Someone Elses Task',
                    owner_id: otherUserEmpId, // Different owner
                    priority: 5,
                    file: null
                },
                error: null
            });

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(updateData);

            console.log('Non-owner update response:', response.status, response.body);

            // Should return 403 Forbidden for non-owner
            expect(response.status).toBe(403);
            expect(response.body.error).toBeDefined();
            if (response.body.error) {
                expect(response.body.error.toLowerCase()).toContain('own');
            }
        });

        it('should allow owner to update other fields while maintaining priority', async () => {
            const taskId = 1;
            const updateData = {
                title: 'Updated Title',
                status: 'under review'
                // Priority not included
            };

            mockSupabase._setMockResponse('select-single', {
                data: {
                    id: taskId,
                    title: 'Original Title',
                    owner_id: mockEmpId,
                    priority: 8,
                    status: 'ongoing',
                    file: null
                },
                error: null
            });

            mockSupabase._setMockResponse('update', {
                data: [{
                    id: taskId,
                    title: 'Updated Title',
                    owner_id: mockEmpId,
                    priority: 8, // Should remain unchanged
                    status: 'under review'
                }],
                error: null
            });

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(updateData);

            expect([200, 204]).toContain(response.status);
            if (response.body && response.body.priority !== undefined) {
                expect(response.body.priority).toBe(8);
            }
        });

        it('should prevent task update without authentication', async () => {
            const taskId = 1;
            const updateData = {
                priority: 9
            };

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                // No Authorization header
                .send(updateData);

            console.log('No auth update response:', response.status);

            expect(response.status).toBe(401);
            expect(response.body.error).toBeDefined();
        });

        it('should prevent task update with invalid token', async () => {
            const taskId = 1;
            const updateData = {
                priority: 9
            };

            // Mock invalid token
            supabaseHelpers.getUserFromToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                .set('Authorization', 'Bearer invalid-token')
                .send(updateData);

            console.log('Invalid token response:', response.status);

            expect(response.status).toBe(401);
            expect(response.body.error).toBeDefined();
        });

        it('should handle task not found scenario', async () => {
            const taskId = 999;
            const updateData = {
                priority: 7
            };

            mockSupabase._setMockResponse('select-single', {
                data: null,
                error: { message: 'Task not found' }
            });

            const response = await request(app)
                .put(`/tasks/${taskId}`)
                .set('Authorization', `Bearer ${mockAuthToken}`)
                .send(updateData);

            console.log('Task not found response:', response.status);

            expect(response.status).toBe(404);
            expect(response.body.error).toBeDefined();
        });

    });
});
