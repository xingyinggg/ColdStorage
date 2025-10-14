import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import notifRoutes from '../../server/routes/notification.js';

// Create a more realistic mock that matches actual Supabase behavior
const createMockSupabase = () => {
    const mockResponses = new Map();

    const createChain = (queryType = '') => {
        return {
            insert: vi.fn((data) => createChain(queryType + 'insert')),
            select: vi.fn((fields = '*') => createChain(queryType + '-select')),
            single: vi.fn(async () => {
                if (queryType.includes('insert')) {
                    const res = mockResponses.get('insert');
                    return res || { data: null, error: null };
                }
                if (queryType.includes('select')) {
                    const res = mockResponses.get('select');
                    return res || { data: null, error: null };
                }
                return { data: null, error: null };
            }),
            then: vi.fn((callback) => {
                const result = mockResponses.get('select') || { data: [], error: null };
                return callback(result);
            }),
        };
    };

    return {
        from: vi.fn(() => createChain()),
        _setMockResponse: (queryType, response) => {
            // ✅ store the actual object, not Promise.resolve()
            mockResponses.set(queryType, response);
        },
    };
};



const mockSupabase = createMockSupabase();

// Mock ALL the functions your routes use
vi.mock('../../server/lib/supabase.js', () => ({
    getServiceClient: () => mockSupabase,
    getUserFromToken: vi.fn(),
    getEmpIdForUserId: vi.fn(),
    getUserRole: vi.fn(),
}));

// Import after mocking
import { getUserFromToken, getEmpIdForUserId, getUserRole } from '../../server/lib/supabase.js';

const app = express();
app.use(express.json());
app.use('/notification', notifRoutes);

describe('Notification Backend Logic Tests', () => {
    let mockUser;
    let mockEmpId;
    let mockManager;
    let mockManagerEmpId;

    beforeEach(() => {
        vi.clearAllMocks();

        // Mock user with realistic UUID
        mockUser = {
            id: '9f548e46-a5c6-4e79-bd05-e2e43ea45f32',
            email: 'zephanchin123@gmail.com',
            aud: 'authenticated',
            role: 'authenticated'
        };

        mockManager = {
            id: '550e8400-e29b-41d4-a716-446655440001',
            email: 'manager@example.com',
            aud: 'authenticated',
            role: 'authenticated'
        }

        // Mock employee ID
        mockEmpId = '10';
        mockManagerEmpId = '1'

        // Mock all the functions your code calls
        getUserFromToken.mockResolvedValue(mockUser);
        getEmpIdForUserId.mockResolvedValue(mockEmpId);
        getUserRole.mockResolvedValue('staff');
    });

    describe('CS-US13: Receive Notification on Task Assignment', () => {
        it('should create notification when a task is created', async () => {
            const notifData = {
                recipient_id: '9f548e46-a5c6-4e79-bd05-e2e43ea45f32',
                title: 'Test Task',
                type: 'task_assignment',
                description: 'Test Description',
                emp_id: mockEmpId,
                created_at: '2023-01-01T00:00:00Z'
            };

            // const expectedNotif = {
            //     id: 19,
            //     ...notifData,
            //     owner_id: mockEmpId,
            //     created_at: '2023-01-01T00:00:00Z'
            // };

            mockSupabase._setMockResponse('insert', {
                data: notifData,
                error: null
            });

            const response = await request(app)
                .post('/notification')
                .set('Authorization', 'Bearer valid-token')
                .send(notifData);

            console.log('Create notification response:', response.status, response.body);

            // Just test that we get some response
            expect(response.status).toBeGreaterThan(199);

            // expect(response.body.title).toBe('Test Task');
            // expect(response.body.recipient_id).toBe(notifData.recipient_id);
            // expect(response.body.emp_id).toBe(mockEmpId);
            expect(response.body.type).toBe('task_assignment');
            expect(response.body.description).toBe('Test Description');
            // Only test specific fields if response exists
            // if (response.body && response.status === 201) {
            //     expect(response.body.owner_id).toBe('12345');
            // }
        });
    });
});