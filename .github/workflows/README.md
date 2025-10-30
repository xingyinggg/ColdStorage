# GitHub Actions CI/CD Workflow

## Overview

This repository uses GitHub Actions for continuous integration and continuous deployment. The workflow is configured to run different levels of checks based on the type of event.

## Workflow Strategy

### 🔍 On Branch Pushes (All Branches)
**Only linting is performed** to provide quick feedback without consuming excessive CI resources.

```
Push to feature branch → Lint Check ✓
```

**Jobs that run:**
- ✅ **Lint Code** - ESLint checks

**Jobs that are skipped:**
- ⏭️ Unit Tests
- ⏭️ Integration Tests  
- ⏭️ E2E Tests
- ⏭️ Build Check

### 🔄 On Pull Requests to Main/Develop
**Full test suite runs** to ensure code quality before merging.

```
Pull Request → Lint ✓ → Unit Tests ✓ → Integration Tests ✓ → E2E Tests ✓ → Build ✓
```

**Jobs that run:**
- ✅ **Lint Code** - ESLint checks
- ✅ **Unit Tests** - Fast isolated tests
- ✅ **Integration Tests** - Database integration tests (requires Supabase test environment)
- ✅ **E2E Tests** - Playwright browser tests
- ✅ **Build Check** - Verify Next.js builds successfully
- ✅ **Summary** - Final check that all jobs passed

### 🚀 On Push to Main Branch
**Full test suite runs** to verify the main branch remains stable.

```
Push to main → Lint ✓ → Unit Tests ✓ → Integration Tests ✓ → E2E Tests ✓ → Build ✓
```

**Jobs that run:** Same as Pull Requests (all jobs)

## Required GitHub Secrets

To run the full workflow, you need to configure these secrets in your repository:

### For Integration Tests
- `SUPABASE_TEST_URL` - URL of your Supabase test database
- `SUPABASE_TEST_SERVICE_KEY` - Service role key for test database

### For Build
- `NEXT_PUBLIC_SUPABASE_URL` - URL of your Supabase production database
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonymous key for production database

## Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its corresponding value

## Local Development

You can run the same checks locally:

```bash
# Run linting
npm run lint

# Run unit tests
npm run test:unit

# Run integration tests (requires test database)
npm run test:integration

# Run E2E tests
npx playwright test

# Build the application
npm run build

# Run all tests
npm test
```

## Workflow Files

- **`.github/workflows/ci.yml`** - Main CI/CD pipeline configuration

## Benefits of This Approach

✅ **Fast Feedback on Branches** - Developers get quick lint feedback without waiting for full test suite

✅ **Comprehensive Checks on PRs** - Ensures code quality before merging

✅ **Protected Main Branch** - Full test suite runs on every main branch update

✅ **Resource Efficient** - Doesn't waste CI minutes on every branch push

✅ **Clear Status** - GitHub will show which checks passed/failed for each commit

## Troubleshooting

### Tests Failing on CI but Passing Locally

1. **Check secrets are configured** - Integration tests need Supabase credentials
2. **Check Node version** - CI uses Node 20, ensure compatibility
3. **Check environment variables** - Some tests may need specific env vars

### Lint Failures

Run `npm run lint` locally to see and fix issues before pushing.

### Integration Test Failures

Ensure your test database is properly seeded and accessible from GitHub Actions.

### E2E Test Failures

E2E tests use Playwright which may behave differently in CI:
- Tests run in headless mode
- Browser versions may differ
- Timing issues may occur

## Viewing Results

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select a workflow run to see detailed logs
4. Download artifacts (like Playwright reports) from failed E2E test runs

