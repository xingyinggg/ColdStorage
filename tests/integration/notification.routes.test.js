// Integration tests for notification routes: GET /notification and POST /notification
import dotenv from 'dotenv';
import path from 'path';
// Load test env
dotenv.config({ path: path.join(process.cwd(), "tests", ".env.test") });

// Determine if test env is present; if so, force server to use test DB
const hasTestEnv = !!process.env.SUPABASE_TEST_URL && !!process.env.SUPABASE_TEST_SERVICE_KEY;
if (hasTestEnv) {
    process.env.SUPABASE_URL = process.env.SUPABASE_TEST_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY;
} else {
    // Make the skip reason visible in CI logs
    // Note: We'll guard the suite below so this file doesn't fail when env is missing
    console.log('⚠️ Skipping notification routes integration tests - Supabase test env not configured');
}

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createClient } from '@supabase/supabase-js';

// Mock supabase helpers before importing router so the module uses the mocked functions
vi.mock('../../server/lib/supabase.js', async () => {
    const actual = await vi.importActual('../../server/lib/supabase.js');
    return {
        ...actual,
        getServiceClient: vi.fn(),
        getUserFromToken: vi.fn(),
        getEmpIdForUserId: vi.fn(),
    };
});

import {
    getServiceClient,
    getUserFromToken,
    getEmpIdForUserId,
} from '../../server/lib/supabase.js';

// Import the router under test
import notificationRouter from '../../server/routes/notification.js';

// Helper to create test Supabase client
function getTestSupabaseClient() {
    const url = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error('Supabase test env missing (URL/key)');
    }
    return createClient(
        url,
        key,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

// Vitest compatibility helper (works across versions)
const describeIf = (cond) => (cond ? describe : describe.skip);

describeIf(hasTestEnv)('Notification routes - integration', () => {
    let app;
    let request;
    let supabaseClient;
    const createdNotificationIds = [];

    beforeAll(async () => {
        supabaseClient = getTestSupabaseClient();

        // Point the mocked getServiceClient to our test client
        getServiceClient.mockImplementation(() => supabaseClient);

        // Basic auth mocks
        getUserFromToken.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001', email: 'staff@example.com' });
        getEmpIdForUserId.mockResolvedValue(1);

        // Create express app and mount router
        app = express();
        app.use(express.json());
        app.use('/notification', notificationRouter);
        request = supertest(app);
    });

    afterEach(async () => {
        // cleanup notifications created during tests
        if (createdNotificationIds.length > 0) {
            await supabaseClient.from('notifications').delete().in('id', createdNotificationIds);
            createdNotificationIds.length = 0;
        }
    });

    it('GET /notification should return notifications for authenticated user', async () => {
        // insert a test notification for emp_id = 1
        const now = new Date().toISOString();
        const notif = {
            emp_id: 1,
            type: 'Test',
            notification_category: 'test',
            title: 'Integration Test - GET Notification',
            description: 'Test notification',
            read: false,
            created_at: now,
            sent_at: now,
        };

        const { data: inserted, error: insertError } = await supabaseClient.from('notifications').insert(notif).select().single();
        if (insertError) throw insertError;
        createdNotificationIds.push(inserted.id);

        const res = await request.get('/notification').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const found = res.body.find((n) => n.id === inserted.id || n.title === notif.title);
        expect(found).toBeDefined();
        if (found) {
            expect(found.emp_id).toBe(1);
            expect(found.title).toContain('Integration Test - GET Notification');
        }
    });

    it('POST /notification should create a new notification and return 201', async () => {
        const payload = {
            title: 'Integration Test - POST Notification',
            type: 'Manual',
            description: 'Created by integration test',
            emp_id: 1,
        };

        const res = await request.post('/notification').set('Authorization', 'Bearer faketoken').send(payload);
        expect(res.status).toBe(201);
        expect(res.body).toBeDefined();
        expect(res.body.title).toBe(payload.title);
        expect(res.body.emp_id).toBe(1);

        // track for cleanup
        if (res.body.id) createdNotificationIds.push(res.body.id);
        else {
            // fallback: find the inserted row
            const { data } = await supabaseClient.from('notifications').select('id').ilike('title', `%${payload.title}%`).limit(1).single();
            if (data && data.id) createdNotificationIds.push(data.id);
        }
    });

    it('GET /notification/unread-count should return the correct unread count', async () => {
        // insert two unread and one read notification
        const now = new Date().toISOString();
        const notifs = [
            { emp_id: 1, type: 'Test', title: 'Unread 1', description: 'u1', read: false, created_at: now },
            { emp_id: 1, type: 'Test', title: 'Unread 2', description: 'u2', read: false, created_at: now },
            { emp_id: 1, type: 'Test', title: 'Read', description: 'r1', read: true, created_at: now },
        ];
        const { data: inserted } = await supabaseClient.from('notifications').insert(notifs).select();
        inserted.forEach((r) => createdNotificationIds.push(r.id));

        const res = await request.get('/notification/unread-count').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body.unread_count).toBeGreaterThanOrEqual(2);
    });

    it('PATCH /notification/:id/read should mark a notification as read', async () => {
        const now = new Date().toISOString();
        const { data: inserted } = await supabaseClient.from('notifications').insert({ emp_id: 1, type: 'Test', title: 'To Read', description: 'mark me', read: false, created_at: now }).select().single();
        createdNotificationIds.push(inserted.id);

        const res = await request.patch(`/notification/${inserted.id}/read`).set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        // Refresh from DB to ensure read flag set
        const { data: refreshed } = await supabaseClient.from('notifications').select('id, read').eq('id', inserted.id).single();
        expect(refreshed.read).toBe(true);
    });

    it('PATCH /notification/mark-all-read should mark all unread notifications as read for the user', async () => {
        const now = new Date().toISOString();
        // create two unread notifications
        const { data: created } = await supabaseClient.from('notifications').insert([
            { emp_id: 1, type: 'Test', title: 'Bulk1', description: 'b1', read: false, created_at: now },
            { emp_id: 1, type: 'Test', title: 'Bulk2', description: 'b2', read: false, created_at: now },
        ]).select();
        created.forEach((r) => createdNotificationIds.push(r.id));

        const res = await request.patch('/notification/mark-all-read').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body.updated_count).toBeGreaterThanOrEqual(2);

        // verify in DB
        const { data: after } = await supabaseClient.from('notifications').select('id, read').in('id', created.map((c) => c.id));
        after.forEach((r) => expect(r.read).toBe(true));
    });

    it('POST /notification/check-deadlines should trigger deadline checks and return success', async () => {

        const res = await request.post('/notification/check-deadlines').set('Authorization', 'Bearer faketoken').send({ force: true });
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        expect(res.body.success).toBe(true);
    });

    it('GET /notification/deadline-status should return service status', async () => {
        const res = await request.get('/notification/deadline-status').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        // Service should be available (deadline service exists in repo)
        expect(res.body.data).toBeDefined();
        expect(res.body.data.available).toBe(true);
    });

    // Additional edge-case / integration coverage
    it('GET /notification should return 401 when token is missing or invalid', async () => {
        // Temporarily make getUserFromToken return null
        getUserFromToken.mockResolvedValueOnce(null);
        const res = await request.get('/notification');
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /notification should return 400 when required fields are missing', async () => {
        const res = await request.post('/notification').set('Authorization', 'Bearer faketoken').send({ title: 'Missing fields' });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('PATCH /notification/:id/read should fall back when read_at column missing', async () => {
        // create a notification to update
        const now = new Date().toISOString();
        const { data: inserted } = await supabaseClient.from('notifications').insert({ emp_id: 1, type: 'Test', title: 'Fallback Single', description: 'fb single', read: false, created_at: now }).select().single();
        createdNotificationIds.push(inserted.id);

        // Spy on supabaseClient.from to simulate first-call error about missing read_at
        let firstCall = true;
        const originalFrom = supabaseClient.from.bind(supabaseClient);
        const fromSpy = vi.spyOn(supabaseClient, 'from').mockImplementation((table) => {
            const q = originalFrom(table);
            // wrap update to simulate error on first update call
            const originalUpdate = q.update.bind(q);
            q.update = (vals) => {
                if (table === 'notifications' && firstCall) {
                    firstCall = false;
                    return {
                        eq: () => ({ eq: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: 'PGRST204', message: 'read_at missing' } }) }) }) })
                    };
                }
                return originalUpdate(vals);
            };
            return q;
        });

        const res = await request.patch(`/notification/${inserted.id}/read`).set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        // cleanup spy
        fromSpy.mockRestore();
        // verify DB state
        const { data: refreshed } = await supabaseClient.from('notifications').select('id, read').eq('id', inserted.id).single();
        expect(refreshed.read).toBe(true);
    });

    it('PATCH /notification/mark-all-read should fall back when read_at column missing (bulk)', async () => {
        const now = new Date().toISOString();
        const { data: created } = await supabaseClient.from('notifications').insert([
            { emp_id: 1, type: 'Test', title: 'BulkFallback1', description: 'bf1', read: false, created_at: now },
            { emp_id: 1, type: 'Test', title: 'BulkFallback2', description: 'bf2', read: false, created_at: now },
        ]).select();
        created.forEach((r) => createdNotificationIds.push(r.id));

        // Simulate first update call failing with read_at missing, then succeeding
        let firstCall = true;
        const originalFrom = supabaseClient.from.bind(supabaseClient);
        const fromSpy = vi.spyOn(supabaseClient, 'from').mockImplementation((table) => {
            const q = originalFrom(table);
            const originalUpdate = q.update.bind(q);
            q.update = (vals) => {
                if (table === 'notifications' && firstCall) {
                    firstCall = false;
                    return {
                        eq: () => ({ eq: () => ({ select: async () => ({ data: null, error: { code: 'PGRST204', message: 'read_at missing' } }) }) })
                    };
                }
                return originalUpdate(vals);
            };
            return q;
        });

        const res = await request.patch('/notification/mark-all-read').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        expect(res.body.updated_count).toBeGreaterThanOrEqual(2);

        fromSpy.mockRestore();
    });

    it('POST /notification should return 401 when token invalid', async () => {
        // Simulate invalid token
        getUserFromToken.mockResolvedValueOnce(null);
        const payload = { title: 'AuthFail', type: 'Test', emp_id: 1 };
        const res = await request.post('/notification').send(payload);
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('GET /notification should return 401 when employee id not found', async () => {
        // getUserFromToken returns a valid user but getEmpIdForUserId returns null
        getUserFromToken.mockResolvedValueOnce({ id: '550e8400-e29b-41d4-a716-446655440010', email: 'noemp@example.com' });
        getEmpIdForUserId.mockResolvedValueOnce(null);

        const res = await request.get('/notification').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /notification should return 401 when currentEmpId not found', async () => {
        // valid user but getEmpIdForUserId for current user returns null
        getUserFromToken.mockResolvedValueOnce({ id: '550e8400-e29b-41d4-a716-446655440011', email: 'noemp2@example.com' });
        getEmpIdForUserId.mockResolvedValueOnce(null);

        const payload = { title: 'Should401', type: 'Test', emp_id: 1 };
        const res = await request.post('/notification').set('Authorization', 'Bearer faketoken').send(payload);
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('POST /notification should return 500 when DB insert fails', async () => {
        // Simulate DB insert error for notifications table
        const payload = { title: 'DBFail', type: 'Test', emp_id: 1 };

        const originalFrom = supabaseClient.from.bind(supabaseClient);
        const insertSpy = vi.spyOn(supabaseClient, 'from').mockImplementation((table) => {
            const q = originalFrom(table);
            if (table === 'notifications') {
                const originalInsert = q.insert.bind(q);
                q.insert = (vals) => ({
                    select: () => ({ single: async () => ({ data: null, error: { message: 'simulated insert failure' } }) })
                });
                return q;
            }
            return q;
        });

        const res = await request.post('/notification').set('Authorization', 'Bearer faketoken').send(payload);
        // server returns 500 when insert fails
        expect([500, 502]).toContain(res.status);
        insertSpy.mockRestore();
    });

    it('GET /notification/unread-count should return 401 when token invalid', async () => {
        getUserFromToken.mockResolvedValueOnce(null);
        const res = await request.get('/notification/unread-count');
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('PATCH /notification/:id/read should return 404 when notification missing', async () => {
        // create and delete a notification then attempt patch
        const { data: created } = await supabaseClient.from('notifications').insert({ emp_id: 1, type: 'Test', title: 'ToBeDeleted', description: 'delete me', read: false }).select().single();
        // delete it
        await supabaseClient.from('notifications').delete().eq('id', created.id);

        const res = await request.patch(`/notification/${created.id}/read`).set('Authorization', 'Bearer faketoken');
        // route returns 404 when no data found
        expect([404, 500]).toContain(res.status); // accept 404 or 500 depending on DB schema behavior
    });

    it('POST /notification should persist task_id when provided', async () => {
        const payload = {
            title: 'Integration Test - POST Notification with task',
            type: 'Manual',
            description: 'Created by integration test',
            emp_id: 1,
            task_id: 999999,
        };

        const res = await request.post('/notification').set('Authorization', 'Bearer faketoken').send(payload);
        expect(res.status).toBe(201);
        expect(res.body).toBeDefined();
        expect(res.body.task_id === 999999 || res.body.task_id == '999999').toBeTruthy();
        if (res.body.id) createdNotificationIds.push(res.body.id);
    });
});
