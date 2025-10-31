# Test Coverage Improvement Plan

## Current Coverage: 11.38% → Target: 70%+

### 📊 Current State:
- **Statements**: 11.38% ❌
- **Branches**: 55.92% ⚠️
- **Functions**: 50.86% ⚠️
- **Lines**: 11.38% ❌

---

## 🎯 Priority Action Items

### Phase 1: Quick Wins (Expected: +30-40% coverage)

#### 1. Frontend Components (0% → 60%+)
**Priority: HIGH** | **Impact: +20-25%** | **Effort: Medium**

Add unit tests for key components:
- ✅ `TaskCard.jsx` - Example created
- [ ] `TaskEditModal.jsx` - Test form validation, submit, cancel
- [ ] `TaskDetailsModal.jsx` - Test data display, actions
- [ ] `ProjectCard.jsx` - Test rendering, actions
- [ ] `StatCard.jsx` - Test number formatting, icons
- [ ] `Badge.jsx` - Test color variants, sizes
- [ ] `Alert.jsx` - Test different alert types
- [ ] `Toast.jsx` - Test show/hide, auto-dismiss

**Example command:**
```bash
npm run test:unit tests/unit/components/
```

#### 2. Custom Hooks (0% → 70%+)
**Priority: HIGH** | **Impact: +10-15%** | **Effort: Low-Medium**

Add tests for hooks:
- ✅ `useTasks.js` - Example created
- [ ] `useAuth.js` - Test login, logout, session
- [ ] `useProjects.js` - Test CRUD operations
- [ ] `useNotification.js` - Test notification lifecycle
- [ ] `useManagerTasks.js` - Test task filtering, assignment
- [ ] `useSubtasks.js` - Test subtask operations
- [ ] `useUnreadCount.js` - Test count updates

**Testing Pattern:**
```javascript
import { renderHook, waitFor } from '@testing-library/react';

const { result } = renderHook(() => useYourHook());
await waitFor(() => {
  expect(result.current.data).toBeDefined();
});
```

#### 3. Utility Functions (0% → 80%+)
**Priority: MEDIUM** | **Impact: +5-8%** | **Effort: Low**

Add tests for utilities:
- ✅ `dateUtils.js` - Example created
- [ ] `notificationStore.js` - Test store operations
- [ ] `supabase/client.js` - Test client initialization
- [ ] `supabase/server.js` - Test server-side client

---

### Phase 2: Backend Routes (30% → 80%+)

#### 4. Untested Backend Routes (0% → 75%+)
**Priority: HIGH** | **Impact: +15-20%** | **Effort: Medium-High**

Add integration tests for:
- ✅ `server/routes/users.js` - Example created
- [ ] `server/routes/director.js` (489 lines, 0% coverage!)
- [ ] `server/routes/hr.js` (504 lines, 0% coverage!)
- [ ] `server/routes/manager-projects.js` (198 lines, 0% coverage!)

**Pattern for route tests:**
```javascript
describe('GET /route', () => {
  it('should return data', async () => {
    const response = await request(app)
      .get('/route')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
  });
});
```

#### 5. Improve Existing Route Coverage
**Priority: MEDIUM** | **Impact: +5-10%** | **Effort: Low**

Boost coverage for partially tested routes:
- `server/routes/tasks.js` - 49% → 75%+ (add edge cases)
- `server/routes/subtasks.js` - 70% → 85%+ (add error scenarios)
- `server/routes/projects.js` - 52% → 75%+ (add validation tests)
- `server/routes/notification.js` - 52% → 75%+ (add notification types)

---

### Phase 3: Frontend Pages (0% → 50%+)

#### 6. Page Component Tests
**Priority: MEDIUM** | **Impact: +8-12%** | **Effort: Medium**

Test key pages:
- [ ] `src/app/login/page.js` - Test form, validation, submission
- [ ] `src/app/register/page.js` - Test registration flow
- [ ] `src/app/dashboard/page.js` - Test data loading, role-based rendering
- [ ] `src/app/projects/page.js` - Test project list, filtering
- [ ] `src/app/notifications/page.js` - Test notification display

**Pattern:**
```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

it('should submit form with valid data', async () => {
  render(<LoginPage />);
  
  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' }
  });
  
  fireEvent.click(screen.getByRole('button', { name: /login/i }));
  
  await waitFor(() => {
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboard');
  });
});
```

---

## 🛠️ Testing Best Practices

### Component Testing Checklist:
- [ ] Test rendering with different props
- [ ] Test user interactions (click, input, etc.)
- [ ] Test conditional rendering
- [ ] Test error states
- [ ] Test loading states
- [ ] Mock external dependencies (API calls, hooks)

### Hook Testing Checklist:
- [ ] Test initial state
- [ ] Test data fetching
- [ ] Test error handling
- [ ] Test loading states
- [ ] Test state updates
- [ ] Mock API responses

### Route Testing Checklist:
- [ ] Test successful responses
- [ ] Test error responses (400, 404, 500)
- [ ] Test authentication/authorization
- [ ] Test input validation
- [ ] Test edge cases
- [ ] Test database operations

---

## 📈 Expected Coverage Progression

| Phase | Target Coverage | Timeframe |
|-------|----------------|-----------|
| Current | 11.38% | - |
| After Phase 1 | 40-50% | 1-2 weeks |
| After Phase 2 | 60-70% | 2-3 weeks |
| After Phase 3 | 70-80% | 3-4 weeks |

---

## 🔧 Setup & Commands

### Run specific test types:
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode for development
npm run test:watch

# Specific file
npm run test tests/unit/components/TaskCard.test.jsx
```

### Check coverage for specific directories:
```bash
# Coverage for components only
vitest run --coverage --coverage.include='src/components/**'

# Coverage for hooks only
vitest run --coverage --coverage.include='src/utils/hooks/**'

# Coverage for backend routes only
vitest run --coverage --coverage.include='server/routes/**'
```

---

## 🎓 Resources & Examples

### Example Files Created:
1. ✅ `tests/unit/components/TaskCard.test.jsx` - Component testing example
2. ✅ `tests/unit/hooks/useTasks.test.js` - Hook testing example
3. ✅ `tests/integration/users.test.js` - Route testing example
4. ✅ `tests/unit/utils/dateUtils.test.js` - Utility function testing
5. ✅ `tests/unit/constants/taskConstants.test.js` - Constants testing

### Testing Libraries Used:
- **Vitest** - Test runner
- **@testing-library/react** - React component testing
- **@testing-library/user-event** - Simulating user interactions
- **supertest** - API endpoint testing

---

## 🚀 Quick Start

1. **Pick a component** from the 0% coverage list
2. **Create a test file** in the appropriate directory
3. **Follow the examples** provided above
4. **Run tests** to verify they pass
5. **Check coverage** to see improvement
6. **Repeat** for next component

### Example Workflow:
```bash
# 1. Create test file
touch tests/unit/components/Badge.test.jsx

# 2. Write tests (use examples as template)
# ... edit the file ...

# 3. Run the test
npm run test tests/unit/components/Badge.test.jsx

# 4. Check coverage
npm run test:coverage

# 5. Commit
git add tests/unit/components/Badge.test.jsx
git commit -m "test: add unit tests for Badge component"
```

---

## 📝 Notes

- Focus on **high-impact, low-effort** items first (utilities, constants)
- **Components** will give you the biggest coverage boost
- **Route tests** ensure API reliability
- Don't aim for 100% - **70-80% is excellent**
- Write **meaningful tests**, not just coverage tests
- Test **behavior**, not implementation details

---

## 🎯 Success Metrics

- **Coverage**: 11% → 70%+
- **Test count**: ~100 → 300+ tests
- **CI/CD**: All tests passing
- **Confidence**: Deploy with confidence knowing critical paths are tested

