// Tests for deadline-service-unavailable and DB-select error paths in notification routes
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'tests', '.env.test') });

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { createClient } from '@supabase/supabase-js';

// Mock supabase helpers
vi.mock('../../server/lib/supabase.js', async () => {
    const actual = await vi.importActual('../../server/lib/supabase.js');
    return {
        ...actual,
        getServiceClient: vi.fn(),
        getUserFromToken: vi.fn(),
        getEmpIdForUserId: vi.fn(),
    };
});

// Mock the deadline service module at top-level to ensure notification.js picks up the mocked module
vi.mock('../../server/services/deadlineNotificationService.js', () => ({}));

import { getServiceClient, getUserFromToken, getEmpIdForUserId } from '../../server/lib/supabase.js';

// Helper to build a test supabase client
function getTestSupabaseClient() {
    const url = process.env.SUPABASE_TEST_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_TEST_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase test env missing');
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

describe('Notification routes - deadline unavailable and DB error paths', () => {
    let supabaseClient;
    let app;
    let request;

    beforeAll(async () => {
        supabaseClient = getTestSupabaseClient();

        // Provide mocked helpers
        getServiceClient.mockImplementation(() => supabaseClient);
        getUserFromToken.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440001', email: 'staff@example.com' });
        getEmpIdForUserId.mockResolvedValue(1);

        // Now import the router fresh so the top-level import picks up the mocked module
        // Use dynamic import so the vi.mock above affects the imported module
        const notificationModule = await import('../../server/routes/notification.js');
        const notificationRouter = notificationModule.default;

        // Force the module to behave as if the deadline service is not available
        if (typeof notificationModule.__setRunDeadlineChecksForTest === 'function') {
            notificationModule.__setRunDeadlineChecksForTest(null);
        }

        app = express();
        app.use(express.json());
        app.use('/notification', notificationRouter);
        request = supertest(app);
    });

    afterAll(() => {
        // restore module mocks for other tests
        vi.unmock('../../server/services/deadlineNotificationService.js');
    });

    it('POST /notification/check-deadlines should return 503 when deadline service unavailable', async () => {
        const res = await request.post('/notification/check-deadlines').set('Authorization', 'Bearer faketoken').send({ force: true });
        expect(res.status).toBe(503);
        expect(res.body).toHaveProperty('success', false);
    });

    it('GET /notification/deadline-status should return available:false when service unavailable', async () => {
        const res = await request.get('/notification/deadline-status').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        expect(res.body.data).toBeDefined();
        expect(res.body.data.available).toBe(false);
    });

    it('GET /notification should return 500 when DB select fails', async () => {
        // spy on supabaseClient.from to simulate select error
        const originalFrom = supabaseClient.from.bind(supabaseClient);
        const fromSpy = vi.spyOn(supabaseClient, 'from').mockImplementation((table) => {
            const q = originalFrom(table);
            if (table === 'notifications') {
                // Provide chainable methods: select().eq().order() -> final async return { data, error }
                q.select = () => ({
                    eq: () => ({
                        order: async () => ({ data: null, error: { message: 'simulated select failure' } }),
                    }),
                });
            }
            return q;
        });

        const res = await request.get('/notification').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(500);

        fromSpy.mockRestore();
    });

    it('GET /notification/unread-count should return 500 when DB count fails', async () => {
        const originalFrom2 = supabaseClient.from.bind(supabaseClient);
        const fromSpy2 = vi.spyOn(supabaseClient, 'from').mockImplementation((table) => {
            const q = originalFrom2(table);
            if (table === 'notifications') {
                // select(..., {count:'exact', head:true}).eq().eq() -> final async return { count, error }
                q.select = () => ({
                    eq: () => ({
                        eq: async () => ({ count: null, error: { message: 'simulated count failure' } }),
                    }),
                });
            }
            return q;
        });

        const res = await request.get('/notification/unread-count').set('Authorization', 'Bearer faketoken');
        expect(res.status).toBe(500);

        fromSpy2.mockRestore();
    });
});
