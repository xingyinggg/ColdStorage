// tests/integration/subtasks.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Lightweight mock Supabase similar to task_priority tests
const createMockSupabase = () => {
  const mockResponses = new Map();
  let lastQuery = null;

  const createChain = (tableName = '', sharedQuery = null) => {
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
      order: vi.fn((field, options = {}) => {
        const ascending = options.ascending !== false;
        currentQuery.orders.push({ field, ascending });
        return createChain(tableName, currentQuery);
      }),
      single: vi.fn(() => {
        lastQuery = { ...currentQuery };
        if (currentQuery.type === 'insert-select') {
          return mockResponses.get('insert') || { data: null, error: null };
        }
        if (currentQuery.type.includes('update')) {
          const updateResponse = mockResponses.get('update') || { data: null, error: null };
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
        let result = mockResponses.get('select') || { data: [], error: null };
        if (currentQuery.orders.length > 0 && result.data && Array.isArray(result.data)) {
          result.data = [...result.data].sort((a, b) => {
            for (const order of currentQuery.orders) {
              const aVal = a[order.field] ?? 0;
              const bVal = b[order.field] ?? 0;
              if (aVal !== bVal) {
                if (order.ascending) return aVal > bVal ? 1 : -1;
                return aVal < bVal ? 1 : -1;
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
    from: vi.fn((table) => createChain(table)),
    auth: { getUser: vi.fn() },
    storage: { from: vi.fn(() => ({ upload: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() })) },
    _setMockResponse: (queryType, response) => {
      mockResponses.set(queryType, response);
    },
    _getLastQuery: () => lastQuery
  };
};

const mockSupabase = createMockSupabase();

// Mock server Supabase helpers used by routes
vi.mock('../../server/lib/supabase.js', () => ({
  getServiceClient: () => mockSupabase,
  getAnonClient: () => mockSupabase,
  getUserFromToken: vi.fn(),
  getEmpIdForUserId: vi.fn(),
}));

// Import subtasks routes
let subtasksRoutes;
try {
  subtasksRoutes = (await import('../../server/routes/subtasks.js')).default;
} catch {
  subtasksRoutes = express.Router();
}

const app = express();
app.use(express.json());
app.use('/subtasks', subtasksRoutes);

describe('Subtasks API - Integration', () => {
  let mockUser;
  let mockEmpId;
  let mockAuthToken;
  let helpers;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUser = { id: 'user-1' };
    mockEmpId = '111';
    mockAuthToken = 'token';
    helpers = await import('../../server/lib/supabase.js');
    helpers.getUserFromToken.mockResolvedValue(mockUser);
    helpers.getEmpIdForUserId.mockResolvedValue(mockEmpId);
  });

  it('GET /subtasks/task/:id returns subtasks for owner', async () => {
    // Parent task owned by requester
    mockSupabase._setMockResponse('select-single', {
      data: { id: 10, owner_id: mockEmpId, collaborators: [] },
      error: null,
    });
    // Subtasks list
    mockSupabase._setMockResponse('select', {
      data: [
        { id: 1, parent_task_id: 10, title: 'S1', priority: 9, status: 'ongoing' },
        { id: 2, parent_task_id: 10, title: 'S2', priority: 5, status: 'ongoing' },
      ],
      error: null,
    });

    const res = await request(app)
      .get('/subtasks/task/10')
      .set('Authorization', `Bearer ${mockAuthToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.subtasks)).toBe(true);
    expect(res.body.subtasks.length).toBe(2);
  });

  it('POST /subtasks creates subtask when requester owns parent', async () => {
    // Parent task select-single for ownership check
    mockSupabase._setMockResponse('select-single', {
      data: { id: 20, owner_id: mockEmpId },
      error: null,
    });
    // Insert result
    mockSupabase._setMockResponse('insert', {
      data: { id: 101, parent_task_id: 20, title: 'New sub', priority: 7 },
      error: null,
    });

    const res = await request(app)
      .post('/subtasks')
      .set('Authorization', `Bearer ${mockAuthToken}`)
      .send({ parent_task_id: 20, title: 'New sub', priority: 7 });

    expect([200,201]).toContain(res.status);
    expect(res.body.subtask?.title).toBe('New sub');
  });

  it('POST /subtasks rejects when requester is not owner', async () => {
    // Parent task is owned by someone else
    mockSupabase._setMockResponse('select-single', {
      data: { id: 21, owner_id: '999' },
      error: null,
    });

    const res = await request(app)
      .post('/subtasks')
      .set('Authorization', `Bearer ${mockAuthToken}`)
      .send({ parent_task_id: 21, title: 'Nope' });

    expect(res.status).toBe(403);
  });

  it('DELETE /subtasks/:id removes subtask for owner', async () => {
    // Load subtask -> parent id
    mockSupabase._setMockResponse('select-single', {
      data: { id: 30, parent_task_id: 300, owner_id: mockEmpId },
      error: null,
    });
    // Next select-single is parent task ownership check
    // Return owner match
    // Our mock returns same response for select-single; sufficient for route flow
    const res = await request(app)
      .delete('/subtasks/30')
      .set('Authorization', `Bearer ${mockAuthToken}`);

    // Route returns 200 with { ok: true } on success
    expect([200,204]).toContain(res.status);
  });
});


