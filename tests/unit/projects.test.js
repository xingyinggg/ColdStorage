import { vi, describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the supabase helper module used by the route
vi.mock('../../../server/lib/supabase.js', () => ({
  getServiceClient: vi.fn(),
  getUserFromToken: vi.fn(),
  getEmpIdForUserId: vi.fn(),
}));

import projectRoutes from '../../server/routes/projects.js';
import { getServiceClient, getUserFromToken, getEmpIdForUserId } from '../../server/lib/supabase.js';

function makeSupabaseStub({ existingProjects = [] } = {}) {
  return {
    from(table) {
      if (table === 'projects') {
        return {
          // duplicate check: .select(...).ilike(...)
          select: (cols) => ({
            ilike: (col, val) => Promise.resolve({ data: existingProjects, error: null }),
            or: (expr) => Promise.resolve({ data: [], error: null }),
          }),
          // insert flow: .insert([...]).select().single()
          insert: (arr) => ({
            select: () => ({
              single: async () => ({ data: { id: 123, ...arr[0] }, error: null }),
            }),
          }),
          // update/delete used in other routes - provide safe defaults
          update: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
          delete: () => ({})
        };
      }

      // default safe stub for other tables
      return {
        select: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
      };
    },
  };
}

describe.skip('Projects route - POST /projects (unit)', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/projects', projectRoutes);

    // default auth mocks
    getUserFromToken.mockImplementation(async (token) => {
      if (!token || token.includes('invalid')) return null;
      return { id: 'user-test-id', email: 'tester@example.com' };
    });

    getEmpIdForUserId.mockImplementation(async (userId) => {
      if (!userId) return null;
      return 'TEST001';
    });
  });

  it('creates a project successfully with title and description', async () => {
    const supabaseStub = makeSupabaseStub({ existingProjects: [] });
    getServiceClient.mockReturnValue(supabaseStub);

    const payload = { title: 'New Project', description: 'A test project' };

    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe(payload.title);
    expect(res.body.description).toBe(payload.description);
    // owner_id should be set by server to mocked emp id
    expect(res.body.owner_id).toBe('TEST001');
  });

  it('returns 400 when title is missing', async () => {
    const supabaseStub = makeSupabaseStub();
    getServiceClient.mockReturnValue(supabaseStub);

    const payload = { description: 'No title here' };

    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.toLowerCase()).toContain('title');
  });

  it('returns 409 when project with same title already exists', async () => {
    const supabaseStub = makeSupabaseStub({ existingProjects: [{ id: 1, title: 'Dup Title' }] });
    getServiceClient.mockReturnValue(supabaseStub);

    const payload = { title: 'Dup Title', description: 'duplicate' };

    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('allows creating a project with empty description', async () => {
    const supabaseStub = makeSupabaseStub({ existingProjects: [] });
    getServiceClient.mockReturnValue(supabaseStub);

    const payload = { title: 'No Description Project', description: '' };

    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(payload.title);
    expect(res.body.description).toBe('');
  });

  it('returns 400 when title is too long (>100 chars)', async () => {
    const supabaseStub = makeSupabaseStub({ existingProjects: [] });
    getServiceClient.mockReturnValue(supabaseStub);

    const longTitle = 'x'.repeat(101);
    const payload = { title: longTitle, description: 'too long' };

    const res = await request(app)
      .post('/projects')
      .set('Authorization', 'Bearer valid-token')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.toLowerCase()).toContain('100');
  });
});
