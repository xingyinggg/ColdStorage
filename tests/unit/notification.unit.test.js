import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock supabase helpers
vi.mock('../../server/lib/supabase.js', async () => {
    const actual = await vi.importActual('../../server/lib/supabase.js');
    return {
        ...actual,
        getServiceClient: vi.fn(),
        getUserFromToken: vi.fn(),
        getEmpIdForUserId: vi.fn(),
        getNumericIdFromEmpId: vi.fn((emp) => emp),
    };
});

import {
    getServiceClient,
    getUserFromToken,
    getEmpIdForUserId,
    getNumericIdFromEmpId,
} from '../../server/lib/supabase.js';

import notificationRouter from '../../server/routes/notification.js';

function makeChainResult(result) {
    return {
        select: () => ({ eq: () => ({ eq: () => Promise.resolve(result), order: () => Promise.resolve(result) }), order: () => Promise.resolve(result), single: () => Promise.resolve(result) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve(result) }) }),
        update: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve(result), single: () => Promise.resolve(result) }) }) }),
        delete: () => ({ in: () => Promise.resolve(result) }),
    };
}

describe('Notification routes - unit', () => {
    let app;
    let request;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/notification', notificationRouter);
        request = supertest(app);
        // reset mocks
        getServiceClient.mockReset();
        getUserFromToken.mockReset();
        getEmpIdForUserId.mockReset();
        getNumericIdFromEmpId.mockReset();
        getNumericIdFromEmpId.mockImplementation((x) => x);
    });

    it('GET /notification without auth returns 401', async () => {
        const res = await request.get('/notification');
        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    it('POST /notification missing required fields returns 400', async () => {
        const payload = { type: 'X', emp_id: 1 }; // missing title
        const res = await request.post('/notification').send(payload).set('Authorization', 'Bearer any');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('POST /notification should create notification and return 201', async () => {
        // prepare mocks
        getUserFromToken.mockResolvedValue({ id: 'user-1' });
        getEmpIdForUserId.mockResolvedValue(10);
        const inserted = { id: 123, title: 'T', emp_id: 1 };
        const supabaseMock = {
            from: (table) => makeChainResult({ data: inserted, error: null }),
        };
        getServiceClient.mockImplementation(() => supabaseMock);

        const payload = { title: 'T', type: 'Manual', emp_id: 1 };
        const res = await request.post('/notification').send(payload).set('Authorization', 'Bearer token');
        expect(res.status).toBe(201);
        expect(res.body).toBeDefined();
        expect(res.body.title).toBe('T');
    });

    it('GET /notification/unread-count returns count', async () => {
        getUserFromToken.mockResolvedValue({ id: 'u' });
        getEmpIdForUserId.mockResolvedValue('empX');
        getNumericIdFromEmpId.mockImplementation((e) => 42);
        const supabaseMock = {
            from: (table) => ({ select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 5, error: null }) }) }) }),
        };
        getServiceClient.mockImplementation(() => supabaseMock);

        const res = await request.get('/notification/unread-count').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.unread_count).toBe(5);
    });

    it('PATCH /notification/:id/read returns 404 when not found', async () => {
        getUserFromToken.mockResolvedValue({ id: 'u' });
        getEmpIdForUserId.mockResolvedValue('empX');
        getNumericIdFromEmpId.mockImplementation((e) => 99);
        const supabaseMock = {
            from: (table) => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }) }) }),
        };
        getServiceClient.mockImplementation(() => supabaseMock);

        const res = await request.patch('/notification/555/read').set('Authorization', 'Bearer t');
        expect(res.status).toBe(404);
        expect(res.body.error).toBeDefined();
    });

    it('PATCH /notification/mark-all-read returns updated_count', async () => {
        getUserFromToken.mockResolvedValue({ id: 'u' });
        getEmpIdForUserId.mockResolvedValue('empX');
        getNumericIdFromEmpId.mockImplementation((e) => 7);
        const updatedData = [{ id: 1 }, { id: 2 }];
        const supabaseMock = {
            from: (table) => ({ update: () => ({ eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: updatedData, error: null }) }) }) }) }),
        };
        getServiceClient.mockImplementation(() => supabaseMock);

        const res = await request.patch('/notification/mark-all-read').set('Authorization', 'Bearer t');
        expect(res.status).toBe(200);
        expect(res.body.updated_count).toBe(updatedData.length);
    });
});
